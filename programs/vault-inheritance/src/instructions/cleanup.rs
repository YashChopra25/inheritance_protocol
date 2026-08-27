//! Post-inheritance estate teardown.
//!
//! The owner-driven `remove_*` / `delete_will` instructions only work while the
//! will is `Active`. After death is confirmed the owner can no longer sign, so
//! without these cranks every child account's rent — and the will's own rent —
//! would be stranded on-chain forever.
//!
//! Design: these instructions are *permissionless cranks*. Anyone may call them
//! (they pay only the tx fee), but the reclaimed rent is ALWAYS sent to the
//! owner's wallet (`will.owner`, the estate / original payer), never to the
//! caller. This is safe because:
//!   * they only run once the will is `Claimable`, and
//!   * **C1: only after the heirs' claim window has fully closed** — see
//!     `Will::require_teardown_open`. This is the critical gate. Closing a
//!     `Beneficiary` account also destroys that heir's ability to call
//!     `claim_token` (which requires the account to exist), so without the
//!     timing gate any stranger could front-run the heirs the instant the will
//!     became claimable and lock the escrowed tokens away permanently.
//!   * `has_one = will` ties each child to this exact will, so a cranker cannot
//!     point the instruction at another will's accounts, and
//!   * the rent destination is pinned to `will.owner` via `address`, so it
//!     cannot be redirected to the caller.
//!
//! Recommended order: sweep token vaults (`sweep_token_vault`), then media,
//! custodians and beneficiaries in any order, then `close_will` once every
//! counter has reached zero.

use crate::constants::WILL_SEED;
use crate::error::ErrorCode;
use crate::state::{Beneficiary, Custodian, MediaReference, Will, WillStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CleanupCustodian<'info> {
    /// Pays the transaction fee; receives nothing else.
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: estate wallet (original rent payer). Pinned to `will.owner` so rent
    /// cannot be redirected; receives the closed account's lamports.
    #[account(mut, address = will.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    #[account(mut, close = owner, has_one = will)]
    pub custodian: Account<'info, Custodian>,
}

pub fn cleanup_custodian(ctx: Context<CleanupCustodian>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.will.require_teardown_open(now)?;

    let will = &mut ctx.accounts.will;
    will.custodian_count = will
        .custodian_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct CleanupBeneficiary<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: estate wallet, pinned to `will.owner`; receives reclaimed rent.
    #[account(mut, address = will.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    #[account(mut, close = owner, has_one = will)]
    pub beneficiary: Account<'info, Beneficiary>,
}

pub fn cleanup_beneficiary(ctx: Context<CleanupBeneficiary>) -> Result<()> {
    // C1: this is THE instruction the timing gate exists for. Closing a
    // beneficiary account revokes that heir's ability to claim tokens, so it must
    // never be possible while the claim window is still running.
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.will.require_teardown_open(now)?;

    let will = &mut ctx.accounts.will;
    will.beneficiary_count = will
        .beneficiary_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct CleanupMedia<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: estate wallet, pinned to `will.owner`; receives reclaimed rent.
    #[account(mut, address = will.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,

    #[account(mut, close = owner, has_one = will)]
    pub media_reference: Account<'info, MediaReference>,
}

pub fn cleanup_media(ctx: Context<CleanupMedia>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.will.require_teardown_open(now)?;

    let will = &mut ctx.accounts.will;
    will.media_count = will
        .media_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct CloseWill<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: estate wallet, pinned to `will.owner`; receives the will's rent.
    #[account(mut, address = will.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = will.will_status == WillStatus::Claimable @ ErrorCode::WillNotClaimable
    )]
    pub will: Account<'info, Will>,
}

pub fn close_will(ctx: Context<CloseWill>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.will.require_teardown_open(now)?;

    let will = &ctx.accounts.will;

    // C2: the will PDA is the authority on every vault ATA. Closing it while any
    // vault survives would strand that balance behind an authority that can never
    // sign again — an unrecoverable loss. Sweep every vault first.
    require!(will.token_vault_count == 0, ErrorCode::WillHasTokenVaults);

    // Refuse to close while children still exist; their PDAs are seeded by this
    // will's key and would be orphaned (rent stranded, re-init blocked).
    require!(
        will.media_count == 0 && will.custodian_count == 0 && will.beneficiary_count == 0,
        ErrorCode::EstateNotEmpty
    );
    Ok(())
}
