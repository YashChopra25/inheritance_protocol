use anchor_lang::prelude::*;

// Anchor allows only ONE `#[error_code]` enum per program (custom codes start at
// 6000), so every error the program can raise lives here. Keeping them in one
// place also makes it easy to map on-chain codes to client-side messages.
//
// NOTE: variants are append-only. Existing discriminants must never be
// reordered or removed once deployed, or clients decoding older transactions
// will report the wrong error.
#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("A mathematical overflow or underflow occurred.")]
    MathOverflow,

    // ---- Will ----
    #[msg("The will should be active, the current will is not active")]
    WillNotActive,
    #[msg("Invalid state transition for the digital will.")]
    InvalidStatusTransition,
    #[msg("Media count is zero for current will")]
    MediaCountIsZero,
    #[msg("Will is PendingInheritance, Claimable, or Closed; it cannot be deleted now.")]
    UnableToDeleteWill,
    #[msg("The will still has media, custodians, or beneficiaries; remove them before deleting.")]
    WillHasDependents,
    #[msg("The will is not in a Claimable state.")]
    WillNotClaimable,
    #[msg("Total beneficiary allocation would exceed 100%.")]
    AllocationExceeded,

    // ---- Dead-man's switch / configuration validation ----
    // The inactivity threshold is the heart of the dead-man's switch: it is the
    // number of seconds of owner silence after which custodians are allowed to
    // confirm death. A non-positive value would let death be confirmed
    // instantly, so it is rejected at write time.
    #[msg("Inactivity threshold must be greater than zero seconds.")]
    InvalidThreshold,
    // A will that requires zero approvals could never gate death confirmation,
    // so at least one approval is always required.
    #[msg("Minimum approvals must be at least 1.")]
    InvalidMinApproval,
    // If `min_approvals` could exceed the number of custodians, the Claimable
    // state would be unreachable and the estate would be permanently bricked.
    #[msg("Minimum approvals cannot exceed the number of custodians.")]
    MinApprovalsExceedCustodians,
    // Guards C1: custodians may only confirm death once the owner has actually
    // been silent for longer than `inactivity_threshold`.
    #[msg("The owner is still active; the inactivity window has not elapsed yet.")]
    OwnerStillActive,

    // ---- Custodian ----
    #[msg("No Custodian is available to delete")]
    NoCustodianFoundDeleteError,
    #[msg("This custodian has already confirmed the owner's death.")]
    AlreadyApproved,
    #[msg("The will has no custodians; at least one custodian is required.")]
    NoCustodians,

    // ---- Beneficiary ----
    #[msg("No beneficiary is available to delete")]
    NoBeneficiaryFoundDeleteError,
    #[msg("This beneficiary has already claimed the inheritance.")]
    AlreadyClaimed,

    // ---- Estate teardown (post-inheritance cleanup) ----
    // close_will may only run once every child account (media, custodians,
    // beneficiaries, token vaults) has been reclaimed, otherwise orphaned PDAs
    // would be left behind holding rent and blocking a future re-init.
    #[msg("The will still has children; reclaim them before closing the estate.")]
    EstateNotEmpty,

    #[msg("Invalid amount for token transfer")]
    InvalidAmount,

    // ---- Token inheritance ----
    #[msg("This beneficiary has no allocation or there are no tokens left to claim.")]
    NothingToClaim,
    // Retired: the legacy TokenVault migration path was removed before mainnet.
    // The variant is kept so downstream discriminants do not shift.
    #[msg("Deprecated error code; no longer raised by this program.")]
    DeprecatedVaultMigration,

    // ---- Post-death timeline (C1 / C3) ----
    // Nothing may be claimed until the owner's revocation window has fully
    // elapsed, so a mistaken or malicious death confirmation can never move an
    // asset before the living owner has had the chance to undo it.
    #[msg("The grace period has not elapsed yet; claims are not open.")]
    GracePeriodNotElapsed,
    // The permissionless teardown cranks must not be able to close a
    // beneficiary's account (and with it their ability to claim) while the
    // heirs' claim window is still running.
    #[msg("The heirs' claim window is still open; teardown cannot start yet.")]
    ClaimWindowStillOpen,
    // Raised by `revoke_death_confirmation` when there is nothing to revoke, or
    // when the grace period has already expired and heirs may be mid-claim.
    #[msg("There is no revocable death confirmation, or the grace period has expired.")]
    NothingToRevoke,

    // ---- Quorum reachability (H1) ----
    // A will whose `min_approvals` exceeds its custodian count can never become
    // Claimable, so its estate would be locked forever. Checked before any asset
    // is allowed into the will.
    #[msg("Quorum is unreachable: add custodians or lower the required approvals first.")]
    QuorumUnreachable,

    // ---- Token vault teardown (C2) ----
    #[msg("The will still holds token vaults; sweep them before closing the estate.")]
    WillHasTokenVaults,
    #[msg("This beneficiary has not registered an encryption key.")]
    NoEncryptionKey,
}
