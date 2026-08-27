use crate::constants::{BENEFICIARY_SEED, MAX_ALLOCATION_BPS, WILL_SEED};
use crate::error::ErrorCode;
use crate::{
    Beneficiary, TokenClaim, TokenVault, Will, WillStatus, TOKEN_CLAIM_SEED, TOKEN_VAULT_SEED,
};
use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

#[derive(Accounts)]
pub struct TokenWillAcc<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive,
        constraint = will.custodian_count > 0 @ ErrorCode::NoCustodians
    )]
    pub will: Account<'info, Will>,

    #[account(mint::token_program = token_program)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + TokenVault::INIT_SPACE,
        seeds = [
            TOKEN_VAULT_SEED,
            will.key().as_ref(),
            token_mint.key().as_ref()
        ],
        bump
    )]
    pub token_vault: Box<Account<'info, TokenVault>>, // vault METADATA, not the token account

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = will,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>, // this is the actual vault

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> TokenWillAcc<'info> {
    /// Populate/refresh the vault metadata and accumulate the deposited amount.
    /// `add_token` uses `init_if_needed`, so this runs on both the first deposit
    /// and every top-up; `total_amount` therefore accumulates across deposits.
    ///
    /// Returns `true` when this call created the vault, so the caller can keep
    /// `Will::token_vault_count` exact (C2).
    fn populate_transfer(&mut self, bump: u8, amount: u64) -> Result<bool> {
        // A freshly `init_if_needed`-created account is zeroed, so an all-zero
        // `will` field is an unambiguous "this vault is new". Every populated
        // vault stores a real will pubkey, which can never be the default.
        let is_new = self.token_vault.will == Pubkey::default();

        let new_total = self
            .token_vault
            .total_amount
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.token_vault.set_inner(TokenVault {
            ata: self.ata.key(),
            token_mint: self.token_mint.key(),
            vault: self.vault.key(),
            will: self.will.key(),
            total_amount: new_total,
            bump,
        });
        Ok(is_new)
    }

    fn transfer_chck(&mut self, amount: u64) -> Result<()> {
        transfer_checked(
            CpiContext::new(
                self.token_program.key(),
                TransferChecked {
                    authority: self.owner.to_account_info(),
                    from: self.ata.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    to: self.vault.to_account_info(),
                },
            ),
            amount,
            self.token_mint.decimals,
        )?;
        Ok(())
    }
}

pub fn add_token_will_handler(ctx: Context<TokenWillAcc>, amount: u64) -> Result<()> {
    require_gt!(amount, 0, ErrorCode::InvalidAmount);

    // H1: never escrow assets into a will whose quorum can never be met. Doing so
    // would lock the tokens away from the very heirs the will names, because the
    // will could never reach `Claimable`.
    ctx.accounts.will.require_quorum_reachable()?;

    let bump = ctx.bumps.token_vault;
    let created = ctx.accounts.populate_transfer(bump, amount)?;
    ctx.accounts.transfer_chck(amount)?;

    // C2: keep the counter exact so `delete_will` / `close_will` can refuse to
    // close a will that still has escrowed tokens behind it.
    if created {
        ctx.accounts.will.token_vault_count = ctx
            .accounts
            .will
            .token_vault_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
    }
    Ok(())
}

// ---- Owner withdrawal (while alive) ----

#[derive(Accounts)]
pub struct DeleteTokenWillAcc<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive
    )]
    pub will: Account<'info, Will>,

    #[account(mint::token_program = token_program)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    // `has_one` pins both back-references in addition to the PDA seeds, so a
    // caller cannot pass one will's vault metadata alongside another's mint.
    #[account(
        mut,
        close = owner,
        seeds = [
            TOKEN_VAULT_SEED,
            will.key().as_ref(),
            token_mint.key().as_ref()
        ],
        bump = token_vault.bump,
        has_one = will,
        has_one = token_mint
    )]
    pub token_vault: Box<Account<'info, TokenVault>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = will,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> DeleteTokenWillAcc<'info> {
    pub fn delete_token_will(&mut self) -> Result<()> {
        let owner = self.owner.key();
        let signer_seeds: [&[&[u8]]; 1] = [&[WILL_SEED, owner.as_ref(), &[self.will.bump]]];

        if self.vault.amount > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.key(),
                    TransferChecked {
                        from: self.vault.to_account_info(),
                        to: self.ata.to_account_info(),
                        mint: self.token_mint.to_account_info(),
                        authority: self.will.to_account_info(),
                    },
                    &signer_seeds,
                ),
                self.vault.amount,
                self.token_mint.decimals,
            )?;
        }

        close_account(CpiContext::new_with_signer(
            self.token_program.key(),
            CloseAccount {
                account: self.vault.to_account_info(),
                authority: self.will.to_account_info(),
                destination: self.owner.to_account_info(),
            },
            &signer_seeds,
        ))?;

        Ok(())
    }
}

pub fn delete_token_will_handler(ctx: Context<DeleteTokenWillAcc>) -> Result<()> {
    ctx.accounts.delete_token_will()?;

    // C2: the vault is gone, so drop the counter. Saturating would hide a bug —
    // if this underflows the counter was already wrong, and failing loudly is
    // better than letting `delete_will` run against bad bookkeeping.
    ctx.accounts.will.token_vault_count = ctx
        .accounts
        .will
        .token_vault_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

// ---- Beneficiary token claim (post-death) ----
//
// Once the will is Claimable AND the owner's grace period has expired, each
// beneficiary may pull their proportional share of every escrowed token:
// `total_amount * allocation_percentage / 10_000`. The `token_claim` marker is
// created with `init`, so a second claim of the same token by the same heir
// fails at account creation (double-claim guard). The will PDA signs the
// transfer out of its vault ATA.

#[derive(Accounts)]
pub struct ClaimToken<'info> {
    #[account(mut)]
    pub beneficiary_signer: Signer<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    // Seeded by the signer, so only a registered heir of this will can claim.
    #[account(
        seeds = [BENEFICIARY_SEED, will.key().as_ref(), beneficiary_signer.key().as_ref()],
        bump = beneficiary.bump,
        has_one = will
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(
        mut,
        seeds = [TOKEN_VAULT_SEED, will.key().as_ref(), token_mint.key().as_ref()],
        bump = token_vault.bump,
        has_one = will,
        has_one = token_mint
    )]
    pub token_vault: Box<Account<'info, TokenVault>>,

    #[account(mint::token_program = token_program)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    // The will PDA's ATA that actually holds the escrowed tokens. Boxed to keep
    // `try_accounts` off the SBF stack limit.
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = will,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // Destination ATA for the heir; created on demand if they don't have one.
    #[account(
        init_if_needed,
        payer = beneficiary_signer,
        associated_token::mint = token_mint,
        associated_token::authority = beneficiary_signer,
        associated_token::token_program = token_program
    )]
    pub beneficiary_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // Existence == already claimed. `init` fails on a second claim.
    #[account(
        init,
        payer = beneficiary_signer,
        space = 8 + TokenClaim::INIT_SPACE,
        seeds = [TOKEN_CLAIM_SEED, token_vault.key().as_ref(), beneficiary_signer.key().as_ref()],
        bump
    )]
    pub token_claim: Account<'info, TokenClaim>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn claim_token_handler(ctx: Context<ClaimToken>) -> Result<()> {
    // C3: no asset moves until the owner's revocation window has fully elapsed.
    ctx.accounts
        .will
        .require_claims_open(Clock::get()?.unix_timestamp)?;

    let bps = ctx.accounts.beneficiary.allocation_percentage as u128;
    require!(bps > 0, ErrorCode::NothingToClaim);

    // Fixed share of the snapshotted total, then clamped to whatever is actually
    // left in the vault (guards against rounding drift / partial deposits).
    let total = ctx.accounts.token_vault.total_amount as u128;
    let share = total.checked_mul(bps).ok_or(ErrorCode::MathOverflow)? / MAX_ALLOCATION_BPS as u128;
    let mut amount = u64::try_from(share).map_err(|_| ErrorCode::MathOverflow)?;
    amount = amount.min(ctx.accounts.vault.amount);
    require!(amount > 0, ErrorCode::NothingToClaim);

    // The will PDA is the vault authority; sign the transfer with its seeds.
    let owner = ctx.accounts.will.owner;
    let will_bump = ctx.accounts.will.bump;
    let signer_seeds: [&[&[u8]]; 1] = [&[WILL_SEED, owner.as_ref(), &[will_bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.beneficiary_ata.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                authority: ctx.accounts.will.to_account_info(),
            },
            &signer_seeds,
        ),
        amount,
        ctx.accounts.token_mint.decimals,
    )?;

    ctx.accounts.token_claim.set_inner(TokenClaim {
        token_vault: ctx.accounts.token_vault.key(),
        beneficiary: ctx.accounts.beneficiary_signer.key(),
        amount,
        bump: ctx.bumps.token_claim,
    });

    Ok(())
}

// ---- Post-claim vault sweep (permissionless crank) ----
//
// Fixes C2 and M2 together. Once the heirs' claim window has closed, whatever is
// left in a vault — the deliberately unallocated remainder, the dust left by
// floor-rounding each heir's share, and the share of any heir who never claimed —
// is returned to the estate wallet and both accounts are closed.
//
// Without this, a will could never satisfy `close_will`'s "no token vaults"
// requirement, and any residual balance would sit behind an authority PDA that
// can never sign again.
//
// Permissionless like the other cranks, and safe for the same reasons: the
// destination is pinned to `will.owner`, the accounts are pinned by PDA seeds
// and `has_one`, and the timing gate means it cannot pre-empt a single heir.

#[derive(Accounts)]
pub struct SweepTokenVault<'info> {
    /// Pays the transaction fee and the owner ATA rent if one must be created.
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: estate wallet (original rent payer). Pinned to `will.owner` so the
    /// residual balance and rent cannot be redirected to the caller.
    #[account(mut, address = will.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    #[account(mint::token_program = token_program)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        close = owner,
        seeds = [
            TOKEN_VAULT_SEED,
            will.key().as_ref(),
            token_mint.key().as_ref()
        ],
        bump = token_vault.bump,
        has_one = will,
        has_one = token_mint
    )]
    pub token_vault: Box<Account<'info, TokenVault>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = will,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn sweep_token_vault_handler(ctx: Context<SweepTokenVault>) -> Result<()> {
    // C1: heirs get their full, exclusive claim window before any crank may
    // touch the estate.
    ctx.accounts
        .will
        .require_teardown_open(Clock::get()?.unix_timestamp)?;

    let owner = ctx.accounts.will.owner;
    let will_bump = ctx.accounts.will.bump;
    let signer_seeds: [&[&[u8]]; 1] = [&[WILL_SEED, owner.as_ref(), &[will_bump]]];

    let residual = ctx.accounts.vault.amount;
    if residual > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    authority: ctx.accounts.will.to_account_info(),
                },
                &signer_seeds,
            ),
            residual,
            ctx.accounts.token_mint.decimals,
        )?;
    }

    // Reclaim the vault ATA's rent to the estate as well.
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.will.to_account_info(),
            destination: ctx.accounts.owner.to_account_info(),
        },
        &signer_seeds,
    ))?;

    ctx.accounts.will.token_vault_count = ctx
        .accounts
        .will
        .token_vault_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("swept {} residual base units back to the estate", residual);
    Ok(())
}
