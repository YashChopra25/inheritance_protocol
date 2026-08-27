use crate::constants::WILL_SEED;
use crate::error::ErrorCode;
use crate::state::{Will, WillStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeWill<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    // `init` (not `init_if_needed`) guarantees a fresh account: a second
    // `initialise_will` for the same owner fails because the PDA already exists,
    // which closes the door on reinitialization attacks.
    #[account(
        init,
        payer = owner,
        space = 8 + Will::INIT_SPACE,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump
    )]
    pub will: Account<'info, Will>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateWill<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    // Only the owner may reconfigure or ping the will, and only while it is
    // still Active. Once custodians have started confirming, the owner's route
    // back is `revoke_death_confirmation`, not this instruction.
    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive
    )]
    pub will: Account<'info, Will>,
}

#[derive(Accounts)]
pub struct DeleteWill<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    // The owner can delete the will *while alive* (status Active). `close = owner`
    // refunds the will's rent to the owner (the original payer). Post-death
    // teardown is handled separately by the permissionless `close_will` crank,
    // because a deceased owner can no longer sign.
    #[account(
        mut,
        close = owner,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::UnableToDeleteWill
    )]
    pub will: Account<'info, Will>,

    pub system_program: Program<'info, System>,
}

/// Create the per-owner will and arm the dead-man's switch.
///
/// `inactivity_threshold` (seconds) is how long the owner may be silent before
/// custodians can confirm death; `min_approval` is how many custodian
/// confirmations are required. Both are validated so the will can never be born
/// in an unusable/instantly-claimable configuration.
pub fn initialise_will(
    ctx: Context<InitializeWill>,
    inactivity_threshold: i64,
    min_approval: u8,
) -> Result<()> {
    // C1: a zero/negative threshold would make the owner "inactive" immediately,
    // defeating the dead-man's switch.
    require!(inactivity_threshold > 0, ErrorCode::InvalidThreshold);
    // H3: a will requiring zero approvals could never gate death confirmation.
    // The upper bound (<= custodian_count) cannot be checked here because no
    // custodians exist yet; instead, `Will::require_quorum_reachable` is enforced
    // before any asset is allowed into the will (H1).
    require!(min_approval >= 1, ErrorCode::InvalidMinApproval);

    let will = &mut ctx.accounts.will;
    let clock = Clock::get()?;

    will.owner = ctx.accounts.owner.key();
    will.will_status = WillStatus::Active;

    will.created_at = clock.unix_timestamp;
    will.last_active_at = clock.unix_timestamp; // creation counts as a ping.
    will.inactivity_threshold = inactivity_threshold;
    will.claimable_at = 0;

    will.media_count = 0;
    will.media_index = 0;
    will.custodian_count = 0;
    will.min_approvals = min_approval;
    will.approvals_received = 0;
    will.beneficiaries_claimed = 0;
    will.beneficiary_count = 0;
    will.token_vault_count = 0;

    // Epochs start at 1 so a Custodian's default `approved_epoch` of 0 can never
    // be mistaken for a live confirmation.
    will.approval_epoch = 1;

    will.total_allocated_percentage = 0;
    will.bump = ctx.bumps.will;

    Ok(())
}

/// Owner-only: ping the dead-man's switch and/or reconfigure it.
///
/// Calling this with `None`/`None` is a pure liveness ping: it just refreshes
/// `last_active_at`, resetting the inactivity countdown. Passing values updates
/// the threshold and/or the required approvals (both re-validated).
pub fn update_will(
    ctx: Context<UpdateWill>,
    inactivity_threshold: Option<i64>,
    min_approval: Option<u8>,
) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let clock = Clock::get()?;

    if let Some(threshold_limit) = inactivity_threshold {
        require!(threshold_limit > 0, ErrorCode::InvalidThreshold);
        will.inactivity_threshold = threshold_limit;
    }

    if let Some(min_approval_limit) = min_approval {
        // H3: never below 1.
        require!(min_approval_limit >= 1, ErrorCode::InvalidMinApproval);
        // H1: if custodians already exist, the new minimum must remain reachable.
        // While there are zero custodians (bootstrapping) any >= 1 value is
        // accepted, because `require_quorum_reachable` gates asset entry anyway.
        require!(
            will.custodian_count == 0 || min_approval_limit <= will.custodian_count,
            ErrorCode::MinApprovalsExceedCustodians
        );
        will.min_approvals = min_approval_limit;
    }

    // Any owner-signed update is itself proof of life, so refresh the timer.
    will.last_active_at = clock.unix_timestamp;
    Ok(())
}

/// Owner-only: delete an Active will and refund its rent.
///
/// Child PDAs (media / custodians / beneficiaries / token vaults) are seeded by
/// this will's key and, because the will PDA is derived from the owner, a
/// re-created will reuses the same address. Any leftover children would
/// therefore block re-init, keep holding rent, and — in the case of a token
/// vault — carry a stale `total_amount` into the new will, so deletion is
/// refused until every child is removed first (C2).
pub fn delete_will(ctx: Context<DeleteWill>) -> Result<()> {
    let will = &ctx.accounts.will;

    // C2: escrowed tokens must be withdrawn (via `delete_token`) before the will
    // can go away. The vault ATA's authority IS this PDA; closing the will while
    // a vault still holds a balance would orphan the tokens behind an authority
    // whose account no longer exists.
    require!(will.token_vault_count == 0, ErrorCode::WillHasTokenVaults);

    require!(
        will.media_count == 0 && will.custodian_count == 0 && will.beneficiary_count == 0,
        ErrorCode::WillHasDependents
    );
    Ok(())
}
