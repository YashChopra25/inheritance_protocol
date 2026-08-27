use crate::constants::{CUSTODIAN_SEED, WILL_SEED};
use crate::error::ErrorCode;
use crate::state::{Custodian, Will, WillStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddCustodian<'info> {
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

    // One custodian PDA per (will, wallet). `init` makes adding the same wallet
    // twice impossible, so `custodian_count` can never be inflated by duplicates.
    #[account(
        init,
        payer = owner,
        space = 8 + Custodian::INIT_SPACE,
        seeds = [CUSTODIAN_SEED, will.key().as_ref(), wallet_key.key().as_ref()],
        bump
    )]
    pub custodian: Account<'info, Custodian>,

    /// CHECK: only used to derive the custodian PDA; this is the custodian's wallet.
    pub wallet_key: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveCustodian<'info> {
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

    // `close = owner` refunds the custodian account's rent to the owner (payer).
    // `has_one = will` ties the custodian to this exact will so an owner cannot
    // pass another will's custodian and corrupt this will's counter.
    #[account(
        mut,
        close = owner,
        seeds = [CUSTODIAN_SEED, will.key().as_ref(), wallet_key.key().as_ref()],
        bump = custodian.bump,
        has_one = will
    )]
    pub custodian: Account<'info, Custodian>,

    /// CHECK: only used to derive the custodian PDA; this is the custodian's wallet.
    pub wallet_key: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ConfirmDeath<'info> {
    // The custodian themself signs to confirm the owner's death. Because the
    // custodian PDA below is seeded by this signer's key, only a registered
    // custodian of this will can pass the `has_one`/seed checks.
    pub custodian_signer: Signer<'info>,

    // The will is located via its stored owner. Status must still be open to
    // confirmations (Active or already PendingInheritance).
    #[account(
        mut,
        seeds = [WILL_SEED, will.owner.as_ref()],
        bump = will.bump,
        constraint = (will.will_status == WillStatus::Active
            || will.will_status == WillStatus::PendingInheritance) @ ErrorCode::WillNotActive
    )]
    pub will: Account<'info, Will>,

    #[account(
        mut,
        seeds = [CUSTODIAN_SEED, will.key().as_ref(), custodian_signer.key().as_ref()],
        bump = custodian.bump,
        has_one = will
    )]
    pub custodian: Account<'info, Custodian>,
}

/// C3 — the owner's escape hatch. Signed by the owner, so it is itself proof of
/// life: it rolls the will back to `Active` and invalidates every confirmation
/// cast so far by bumping the approval epoch.
#[derive(Accounts)]
pub struct RevokeDeathConfirmation<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    // Deliberately NOT gated on status: this instruction exists precisely for the
    // non-Active states. The handler decides what is revocable.
    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner
    )]
    pub will: Account<'info, Will>,
}

/// Owner-only: register a custodian who will be able to confirm death later.
pub fn add_custodian(ctx: Context<AddCustodian>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let custodian = &mut ctx.accounts.custodian;

    custodian.will = will.key();
    custodian.wallet = ctx.accounts.wallet_key.key();
    custodian.last_approved_time = 0;
    custodian.has_approved = false;
    // 0 never matches a live `Will::approval_epoch` (which starts at 1), so a
    // freshly added custodian is unambiguously "has not confirmed".
    custodian.approved_epoch = 0;
    custodian.bump = ctx.bumps.custodian;

    will.custodian_count = will
        .custodian_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

/// Owner-only: deregister a custodian and refund its rent.
///
/// To keep the H1 invariant (`min_approvals <= custodian_count`) intact, an
/// owner may not remove a custodian if doing so would drop the count below the
/// required approvals while custodians still remain — that would make the will
/// unconfirmable. They must lower `min_approvals` via `update_will` first. The
/// final custodian (count 1 -> 0) is always removable so the will can be torn
/// down and deleted.
pub fn remove_custodian(ctx: Context<RemoveCustodian>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let custodian = &ctx.accounts.custodian;

    require!(
        will.custodian_count > 0,
        ErrorCode::NoCustodianFoundDeleteError
    );

    let new_count = will
        .custodian_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // H1: keep the will confirmable. Removing down to zero (full teardown) is
    // exempt; otherwise the remaining custodians must still be able to meet
    // `min_approvals`.
    require!(
        new_count == 0 || will.min_approvals <= new_count,
        ErrorCode::MinApprovalsExceedCustodians
    );

    // If this custodian's confirmation is live in the CURRENT epoch, undo it so
    // the running tally stays consistent. A confirmation from a revoked epoch was
    // already discounted when the epoch was bumped, so it must not be subtracted
    // a second time.
    if custodian.is_current_approval(will.approval_epoch) && will.approvals_received > 0 {
        will.approvals_received = will
            .approvals_received
            .checked_sub(1)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    will.custodian_count = new_count;
    Ok(())
}

/// Custodian-only: confirm the owner's death.
///
/// C1 — the dead-man's switch: a custodian may only confirm once the owner has
/// actually been silent for at least `inactivity_threshold` seconds since their
/// last ping (`last_active_at`). This is the invariant that makes the vault
/// safe; without it any custodian could mark a living owner dead.
///
/// Each custodian counts once per approval epoch. When `approvals_received`
/// reaches `min_approvals` the will becomes Claimable and `claimable_at` starts
/// the grace period — heirs still cannot claim until that grace period expires,
/// which is the window in which a living owner can revoke.
pub fn confirm_death(ctx: Context<ConfirmDeath>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let custodian = &mut ctx.accounts.custodian;

    let now = Clock::get()?.unix_timestamp;
    // Seconds elapsed since the owner's last proof of life. Saturating at 0 keeps
    // a (clock-skew) negative delta from underflowing into a huge positive value.
    let elapsed = now.saturating_sub(will.last_active_at);
    require!(
        elapsed >= will.inactivity_threshold,
        ErrorCode::OwnerStillActive
    );

    // A custodian cannot confirm twice within the same epoch. After a revocation
    // the epoch has moved on, so they may confirm again if the owner falls silent
    // once more.
    require!(
        !custodian.is_current_approval(will.approval_epoch),
        ErrorCode::AlreadyApproved
    );

    custodian.has_approved = true;
    custodian.approved_epoch = will.approval_epoch;
    custodian.last_approved_time = now;

    will.approvals_received = will
        .approvals_received
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // `min_approvals` is always >= 1 (enforced at init/update), so once the tally
    // reaches it the estate enters its post-death timeline; otherwise it is
    // pending more approvals.
    if will.approvals_received >= will.min_approvals {
        will.will_status = WillStatus::Claimable;
        // Anchor for BOTH post-death windows. Set once, on the transition into
        // Claimable, so repeated confirmations cannot push the timeline out.
        will.claimable_at = now;
        msg!(
            "quorum reached: claims open at {}, teardown opens at {}",
            will.grace_ends_at()?,
            will.claim_window_ends_at()?
        );
    } else {
        will.will_status = WillStatus::PendingInheritance;
    }
    Ok(())
}

/// Owner-only: cancel an in-flight death confirmation and return the will to
/// `Active` (C3).
///
/// Without this, a single premature `confirm_death` permanently locked a LIVING
/// owner out of their own will: every owner instruction is gated on `Active`, so
/// they could no longer ping, reconfigure, withdraw tokens or delete the will,
/// while the remaining custodians walked it to `Claimable` and distributed the
/// estate of someone who was still alive.
///
/// Revocable while:
///   * `PendingInheritance` — quorum was never reached, always revocable; or
///   * `Claimable` — but only until the grace period expires. After that heirs
///     may already be claiming, and unwinding settled transfers is not possible.
///
/// The reset is O(1) regardless of custodian count: bumping `approval_epoch`
/// invalidates every existing confirmation at once (see `Custodian::approved_epoch`).
pub fn revoke_death_confirmation(ctx: Context<RevokeDeathConfirmation>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    let now = Clock::get()?.unix_timestamp;

    let revocable = match will.will_status {
        // Nothing in flight to revoke.
        WillStatus::Active => false,
        // Quorum never reached — the owner can always pull it back.
        WillStatus::PendingInheritance => true,
        // Quorum reached: only while claims are still frozen.
        WillStatus::Claimable => now < will.grace_ends_at()?,
    };
    require!(revocable, ErrorCode::NothingToRevoke);

    will.will_status = WillStatus::Active;
    will.approvals_received = 0;
    will.claimable_at = 0;
    // Invalidate every confirmation cast in the epoch just revoked.
    will.approval_epoch = will
        .approval_epoch
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    // Signing this transaction is itself proof of life, so restart the switch.
    will.last_active_at = now;

    msg!(
        "death confirmation revoked; will active again, approval epoch now {}",
        will.approval_epoch
    );
    Ok(())
}
