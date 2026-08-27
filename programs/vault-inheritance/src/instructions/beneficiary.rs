use crate::constants::{BENEFICIARY_SEED, MAX_ALLOCATION_BPS, WILL_SEED};
use crate::error::ErrorCode;
use crate::state::{Beneficiary, Will, WillStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddBeneficiary<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    // Owner-only and only while Active.
    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive
    )]
    pub will: Account<'info, Will>,

    // One beneficiary PDA per (will, wallet); `init` prevents duplicate adds.
    #[account(
        init,
        payer = owner,
        space = 8 + Beneficiary::INIT_SPACE,
        seeds = [BENEFICIARY_SEED, will.key().as_ref(), wallet_key.key().as_ref()],
        bump
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// CHECK: only used to derive the beneficiary PDA; this is the heir's wallet.
    pub wallet_key: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveBeneficiary<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive
    )]
    pub will: Account<'info, Will>,

    // `close = owner` refunds rent to the owner (payer). `has_one = will` ensures
    // the beneficiary belongs to this will before its allocation is subtracted.
    #[account(
        mut,
        close = owner,
        seeds = [BENEFICIARY_SEED, will.key().as_ref(), wallet_key.key().as_ref()],
        bump = beneficiary.bump,
        has_one = will
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// CHECK: only used to derive the beneficiary PDA; this is the heir's wallet.
    pub wallet_key: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ClaimInheritance<'info> {
    // The beneficiary themself signs to claim once the will is Claimable. The
    // beneficiary PDA below is seeded by this signer, so only a registered heir
    // of this will can claim.
    pub beneficiary_signer: Signer<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    #[account(
        mut,
        seeds = [BENEFICIARY_SEED, will.key().as_ref(), beneficiary_signer.key().as_ref()],
        bump = beneficiary.bump,
        has_one = will
    )]
    pub beneficiary: Account<'info, Beneficiary>,
}

/// C5 — the heir publishes the X25519 public key their documents will be
/// wrapped to. Signed by the heir, so nobody else can substitute a key they
/// control and redirect the estate's documents to themselves.
#[derive(Accounts)]
pub struct RegisterRecipientKey<'info> {
    #[account(mut)]
    pub beneficiary_signer: Signer<'info>,

    // Read-only; identifies which will this heir belongs to. The beneficiary
    // PDA below is derived from it and `has_one = will` pins the pair together.
    #[account(seeds = [WILL_SEED, will.owner.as_ref()], bump = will.bump)]
    pub will: Account<'info, Will>,

    #[account(
        mut,
        seeds = [BENEFICIARY_SEED, will.key().as_ref(), beneficiary_signer.key().as_ref()],
        bump = beneficiary.bump,
        has_one = will
    )]
    pub beneficiary: Account<'info, Beneficiary>,
}

/// Owner-only: add an heir with a share of the estate (basis points).
///
/// The running total is checked so all allocations together never exceed 100%.
/// Allocations need not sum to exactly 100% — under-allocation is allowed; any
/// unassigned remainder is swept back to the estate by `sweep_token_vault` once
/// the heirs' claim window closes (M2), so nothing is stranded.
pub fn add_beneficiary(ctx: Context<AddBeneficiary>, allocation_percentage: u16) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let beneficiary = &mut ctx.accounts.beneficiary;

    let new_total = will
        .total_allocated_percentage
        .checked_add(allocation_percentage)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        new_total <= MAX_ALLOCATION_BPS,
        ErrorCode::AllocationExceeded
    );

    beneficiary.will = will.key();
    beneficiary.wallet = ctx.accounts.wallet_key.key();
    beneficiary.allocation_percentage = allocation_percentage;
    beneficiary.has_claimed = false;
    // The heir registers their own key later; all-zero means "not yet".
    beneficiary.encryption_pubkey = [0u8; 32];
    beneficiary.bump = ctx.bumps.beneficiary;

    will.total_allocated_percentage = new_total;
    will.beneficiary_count = will
        .beneficiary_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// Owner-only: remove an heir, freeing their allocation and refunding rent.
pub fn remove_beneficiary(ctx: Context<RemoveBeneficiary>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let beneficiary = &ctx.accounts.beneficiary;

    require!(
        will.beneficiary_count > 0,
        ErrorCode::NoBeneficiaryFoundDeleteError
    );

    will.total_allocated_percentage = will
        .total_allocated_percentage
        .checked_sub(beneficiary.allocation_percentage)
        .ok_or(ErrorCode::MathOverflow)?;
    will.beneficiary_count = will
        .beneficiary_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// Beneficiary-only: accept the inheritance once claims are open.
///
/// Records acceptance (`has_claimed`) and bumps the will's `beneficiaries_claimed`
/// tally. The heir's actual access to the documents does not come from this
/// instruction — it comes from unwrapping the per-file data key that the owner
/// sealed to their `encryption_pubkey` (C5). This marker is what the API layer
/// authorizes document reads against.
pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let beneficiary = &mut ctx.accounts.beneficiary;

    // C3: nothing moves until the owner's revocation window has fully elapsed.
    will.require_claims_open(Clock::get()?.unix_timestamp)?;

    require!(!beneficiary.has_claimed, ErrorCode::AlreadyClaimed);

    beneficiary.has_claimed = true;
    will.beneficiaries_claimed = will
        .beneficiaries_claimed
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// Beneficiary-only: publish (or rotate) the X25519 public key that the owner
/// wraps document data keys to.
///
/// Signed by the heir, so the key always belongs to whoever controls the heir's
/// wallet. Rotation is allowed while the will is `Active` — the owner re-wraps
/// existing documents afterwards; once death confirmation is in flight the key
/// is frozen so an attacker who later compromises an heir's wallet cannot swap
/// in their own key and unseal the estate.
pub fn register_recipient_key(
    ctx: Context<RegisterRecipientKey>,
    encryption_pubkey: [u8; 32],
) -> Result<()> {
    require!(
        ctx.accounts.will.will_status == WillStatus::Active,
        ErrorCode::WillNotActive
    );
    // An all-zero key is the sentinel for "unregistered"; refuse to store it.
    require!(encryption_pubkey != [0u8; 32], ErrorCode::NoEncryptionKey);

    ctx.accounts.beneficiary.encryption_pubkey = encryption_pubkey;
    Ok(())
}
