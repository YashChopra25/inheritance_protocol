use anchor_lang::prelude::*;

use crate::constants::{CLAIM_WINDOW_SECONDS, GRACE_PERIOD_SECONDS};
use crate::error::ErrorCode;

/// The root account of a single user's digital will / inheritance vault.
///
/// One `Will` exists per owner: its PDA is derived from `[WILL_SEED, owner]`,
/// so an owner can hold at most one will at a time. All other accounts
/// (custodians, beneficiaries, media references, token vaults) are children
/// whose PDAs are seeded by this will's key.
///
/// SCOPE: the will escrows SPL tokens (see `TokenVault`) and stores pointers to
/// off-chain media (see `MediaReference`). Media bytes are encrypted client-side
/// before they ever leave the owner's browser; the chain stores only the CID.
#[account]
#[derive(InitSpace)]
pub struct Will {
    // ---- Identity ----
    /// The will's creator and sole administrator. Enforced via `has_one = owner`
    /// on every owner-only instruction.
    pub owner: Pubkey,

    // ---- State machine ----
    pub will_status: WillStatus,

    // ---- Dead-man's switch timestamps (all unix seconds) ----
    /// When the will was first created.
    pub created_at: i64,
    /// Last time the owner proved liveness ("pinged"): set on init and refreshed
    /// on every `update_will`. The dead-man's switch measures silence from here.
    pub last_active_at: i64,
    /// Seconds of owner silence required before custodians may confirm death.
    /// Must be > 0 (see `ErrorCode::InvalidThreshold`). `confirm_death` requires
    /// `now - last_active_at >= inactivity_threshold`.
    pub inactivity_threshold: i64,
    /// Unix timestamp at which custodian quorum was reached and the will became
    /// `Claimable`. Zero while the will has never reached quorum (it is reset to
    /// zero by `revoke_death_confirmation`). This is the anchor for both
    /// post-death windows — see `grace_ends_at` / `claim_window_ends_at`.
    pub claimable_at: i64,

    // ---- Counters ----
    /// Number of MediaReference children currently alive (rent held).
    pub media_count: u8,
    /// Monotonic counter used ONLY to derive collision-free media PDA seeds.
    /// Never decremented, so a removed slot's address is never reused. u16 gives
    /// a 65_535 lifetime ceiling on media uploads (vs. 255 for a u8).
    pub media_index: u16,
    /// Number of Custodian children currently alive.
    pub custodian_count: u8,
    /// How many custodian confirmations are required to make the will Claimable.
    /// Invariant: `1 <= min_approvals`, and `min_approvals <= custodian_count`
    /// before any asset may be escrowed (see `ErrorCode::QuorumUnreachable`).
    pub min_approvals: u8,
    /// Running tally of custodians who have confirmed death **in the current
    /// approval epoch**. Reset to zero by `revoke_death_confirmation`.
    pub approvals_received: u8,
    /// Number of beneficiaries who have called `claim_inheritance`.
    pub beneficiaries_claimed: u8,
    /// Number of Beneficiary children currently alive.
    pub beneficiary_count: u32,
    /// Number of TokenVault children currently alive. C2: `delete_will` and
    /// `close_will` both refuse to run while this is non-zero, so a will can
    /// never be closed out from under escrowed tokens (which would strand them
    /// permanently — the vault's authority is this very PDA).
    pub token_vault_count: u16,

    // ---- Approval epoch (C3) ----
    /// Monotonically increasing counter that invalidates every prior custodian
    /// confirmation in O(1). A custodian counts as having confirmed only when
    /// `custodian.has_approved && custodian.approved_epoch == will.approval_epoch`.
    /// `revoke_death_confirmation` bumps this, so a revoked confirmation round
    /// can never be replayed and no per-custodian account has to be touched.
    /// Starts at 1 so the default `approved_epoch` of 0 never matches.
    pub approval_epoch: u16,

    // ---- Allocation (basis points, 0..=10000) ----
    /// Sum of all beneficiaries' allocations; never allowed to exceed 10_000.
    pub total_allocated_percentage: u16,

    /// Cached PDA bump for this will.
    pub bump: u8,
}

impl Will {
    /// End of the owner's revocation window. Until this instant nothing may be
    /// claimed and the owner may still call `revoke_death_confirmation`.
    pub fn grace_ends_at(&self) -> Result<i64> {
        self.claimable_at
            .checked_add(GRACE_PERIOD_SECONDS)
            .ok_or_else(|| error!(ErrorCode::MathOverflow))
    }

    /// End of the heirs' exclusive claim window. Only after this instant may the
    /// permissionless teardown cranks close beneficiary accounts or sweep vaults.
    pub fn claim_window_ends_at(&self) -> Result<i64> {
        self.grace_ends_at()?
            .checked_add(CLAIM_WINDOW_SECONDS)
            .ok_or_else(|| error!(ErrorCode::MathOverflow))
    }

    /// Guard for `claim_inheritance` / `claim_token`: the grace period must have
    /// fully elapsed, so a wrongly-confirmed living owner always gets a chance to
    /// revoke before a single asset can move.
    pub fn require_claims_open(&self, now: i64) -> Result<()> {
        require!(
            now >= self.grace_ends_at()?,
            ErrorCode::GracePeriodNotElapsed
        );
        Ok(())
    }

    /// Guard for every permissionless teardown crank: the heirs' claim window
    /// must have fully elapsed. This is what stops a stranger from closing the
    /// heirs' accounts before they have had a chance to claim (C1).
    pub fn require_teardown_open(&self, now: i64) -> Result<()> {
        require!(
            now >= self.claim_window_ends_at()?,
            ErrorCode::ClaimWindowStillOpen
        );
        Ok(())
    }

    /// H1: a will whose quorum can never be met would lock the estate forever.
    /// Checked before any asset (token or media reference) enters the will.
    pub fn require_quorum_reachable(&self) -> Result<()> {
        require!(
            self.custodian_count > 0 && self.min_approvals <= self.custodian_count,
            ErrorCode::QuorumUnreachable
        );
        Ok(())
    }
}

/// Lifecycle of a will.
///
/// Happy path: `Active` --(some confirmations)--> `PendingInheritance`
///             --(quorum)--> `Claimable` --(grace, then claims)--> closed.
///
/// While `Active`, only the owner mutates the will (add/remove children, ping).
/// Once quorum is reached the owner can no longer configure it, but until the
/// grace period expires they may still `revoke_death_confirmation` and return
/// the will to `Active`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum WillStatus {
    /// Owner is alive (or at least not yet confirmed dead); fully mutable by owner.
    Active,
    /// At least one custodian confirmed death, but `min_approvals` not yet met.
    PendingInheritance,
    /// Quorum reached at `claimable_at`. Claims open once the grace period ends;
    /// teardown opens once the claim window ends.
    Claimable,
}

/// A custodian is a trusted party who can confirm the owner's death. Death is
/// only actionable once `min_approvals` distinct custodians confirm AND the
/// owner has been inactive past `inactivity_threshold`.
#[account]
#[derive(InitSpace)]
pub struct Custodian {
    /// Back-reference to the parent will (validated with `has_one = will`).
    pub will: Pubkey,
    /// The custodian's signing wallet; also part of this account's PDA seed.
    pub wallet: Pubkey,
    /// Unix timestamp of this custodian's confirmation (0 if not yet approved).
    pub last_approved_time: i64,
    /// Whether this custodian has confirmed death. Only meaningful together with
    /// `approved_epoch` — see `is_current_approval`.
    pub has_approved: bool,
    /// The `Will::approval_epoch` this confirmation was cast in. A confirmation
    /// from a superseded epoch (i.e. one the owner revoked) does not count.
    pub approved_epoch: u16,
    pub bump: u8,
}

impl Custodian {
    /// True only when this custodian's confirmation belongs to the will's
    /// current approval epoch. Stale confirmations from a revoked round are
    /// ignored without having to rewrite every custodian account.
    pub fn is_current_approval(&self, will_epoch: u16) -> bool {
        self.has_approved && self.approved_epoch == will_epoch
    }
}

/// A beneficiary inherits a share of the estate. `allocation_percentage` is the
/// share in basis points; `has_claimed` records acceptance of the media estate.
#[account]
#[derive(InitSpace)]
pub struct Beneficiary {
    /// Back-reference to the parent will (validated with `has_one = will`).
    pub will: Pubkey,
    /// The beneficiary's wallet; also part of this account's PDA seed.
    pub wallet: Pubkey,
    /// Share of the estate in basis points, 0..=10000.
    pub allocation_percentage: u16,
    /// Whether this beneficiary has accepted their inheritance. Blocks double-claim.
    pub has_claimed: bool,
    /// X25519 public key this heir published for key agreement, or all-zero if
    /// they have not registered one yet (C5). The owner wraps each document's
    /// data key to this key, so the ciphertext on IPFS can only be opened by the
    /// matching secret — which never leaves the heir's browser. Registered by
    /// the beneficiary themselves via `register_recipient_key`.
    pub encryption_pubkey: [u8; 32],
    pub bump: u8,
}

impl Beneficiary {
    pub fn has_encryption_key(&self) -> bool {
        self.encryption_pubkey != [0u8; 32]
    }
}

/// An off-chain media object (document, image, video, ...) referenced by its
/// IPFS content identifier.
///
/// The bytes on IPFS are AES-256-GCM ciphertext produced in the owner's browser
/// (C5); the per-file data key is wrapped separately to the owner and to each
/// registered beneficiary. Publishing the CID on-chain therefore reveals only
/// that a document exists, never its contents.
#[account]
#[derive(InitSpace)]
pub struct MediaReference {
    /// Back-reference to the parent will (validated with `has_one = will`).
    pub will: Pubkey,
    /// Monotonic index baked into this account's PDA seed (see `Will::media_index`).
    pub media_index: u16,
    /// MIME type, e.g. "application/pdf", "image/png", "video/mp4". Fixed 16
    /// bytes, right-padded with zeros by the client.
    pub media_type: [u8; 16],
    /// IPFS CID, zero-padded. 64 bytes accommodates both CIDv0 (46-char base58,
    /// `Qm...`) and CIDv1 (59-char base32, `bafy...`).
    pub ipfs_cid: [u8; 64],
    pub bump: u8,
}

/// Metadata for a single escrowed SPL token. The tokens themselves live in the
/// `vault` associated-token account (authority = the will PDA); this account only
/// records the pointers plus `total_amount`.
#[account]
#[derive(InitSpace)]
pub struct TokenVault {
    pub will: Pubkey,
    pub token_mint: Pubkey,
    pub ata: Pubkey,
    pub vault: Pubkey,
    /// Cumulative amount ever escrowed for this mint (raw base units). Each
    /// beneficiary's claimable share is `total_amount * allocation_bps / 10_000`.
    /// Snapshotting the total (rather than reading the live `vault` balance)
    /// keeps every heir's share fixed even as earlier heirs drain the vault.
    pub total_amount: u64,
    pub bump: u8,
}

/// Per-(token vault, beneficiary) claim marker. Created with `init` inside
/// `claim_token`, so its existence is itself the double-claim guard: a second
/// claim of the same token by the same heir fails because the PDA already exists.
#[account]
#[derive(InitSpace)]
pub struct TokenClaim {
    pub token_vault: Pubkey,
    pub beneficiary: Pubkey,
    /// Amount actually transferred to the beneficiary (raw base units).
    pub amount: u64,
    pub bump: u8,
}
