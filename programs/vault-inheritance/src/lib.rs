// The `#[program]` macro generates wrapper fns whose names match the re-exported
// instruction handlers below; the glob re-export is harmless and resolved
// deterministically (we only call handlers via their module path).
#![allow(ambiguous_glob_reexports)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
pub use constants::*;
pub use instructions::*;
pub use state::*;
declare_id!("6sgj9jnnFcYem1u3N4wCfMdtTeeQRf7uT2AGWRU5EhtY");

/// # vault-inheritance
///
/// A non-custodial digital-will / dead-man's-switch program.
///
/// ## Lifecycle
/// 1. **Create** — `initialise_will` sets the inactivity threshold (dead-man's
///    switch window) and the number of custodian approvals required.
/// 2. **Configure** — while `Active`, the owner adds/removes media references
///    (IPFS CIDs of client-encrypted files), custodians (who can confirm death),
///    beneficiaries (heirs, with basis-point shares) and escrowed SPL tokens.
///    Heirs register their own `encryption_pubkey` so the owner can seal each
///    document's data key to them.
/// 3. **Ping** — `update_will` refreshes the liveness timer (and can re-tune the
///    threshold / approvals). Each ping proves the owner is alive.
/// 4. **Confirm death** — once the owner has been silent past the threshold,
///    custodians call `confirm_death`. At quorum the will becomes `Claimable`
///    and `claimable_at` starts the clock.
/// 5. **Grace period** — for `GRACE_PERIOD_SECONDS` nothing may be claimed and a
///    living owner may `revoke_death_confirmation`, returning the will to
///    `Active` and invalidating every confirmation cast so far.
/// 6. **Claim** — once grace expires, beneficiaries call `claim_inheritance`
///    (unlocking their document keys) and `claim_token` (their proportional
///    share of each escrowed mint).
/// 7. **Teardown** — after `CLAIM_WINDOW_SECONDS` the permissionless
///    `sweep_token_vault` + `cleanup_*` + `close_will` cranks return every
///    residual token and all rent to the estate.
///
/// ## Timing invariants that make this safe
/// * Nothing is claimable before `claimable_at + GRACE_PERIOD_SECONDS` — a
///   mistaken or malicious death confirmation can never move an asset before the
///   owner has had the chance to undo it.
/// * No teardown crank may run before `claimable_at + GRACE + CLAIM_WINDOW` — a
///   stranger can never close an heir's account out from under a pending claim.
/// * No asset may enter a will whose quorum is unreachable
///   (`min_approvals <= custodian_count`), so an estate can never be locked away
///   from the heirs it names.
/// * A will can never be closed while it still owns a token vault, because the
///   will PDA is the vault's only possible authority.
///
/// ## Confidentiality
/// Media bytes are encrypted in the owner's browser (AES-256-GCM) before upload;
/// the per-file data key is wrapped to the owner and to each heir's registered
/// X25519 key. The chain stores only the CID, so publishing it reveals the
/// existence of a document and nothing more. The program is never trusted with
/// plaintext or with a decryption key.
#[program]
pub mod vault_inheritance {
    use super::*;

    // ---- Will lifecycle ----
    pub fn initialise_will(
        ctx: Context<InitializeWill>,
        inactivity_threshold: i64,
        min_approval: u8,
    ) -> Result<()> {
        will::initialise_will(ctx, inactivity_threshold, min_approval)
    }

    pub fn update_will(
        ctx: Context<UpdateWill>,
        inactivity_threshold: Option<i64>,
        min_approval: Option<u8>,
    ) -> Result<()> {
        will::update_will(ctx, inactivity_threshold, min_approval)
    }

    pub fn delete_will(ctx: Context<DeleteWill>) -> Result<()> {
        will::delete_will(ctx)
    }

    // ---- Media references (IPFS CIDs of client-encrypted files) ----
    pub fn add_media_reference(
        ctx: Context<AddMediaReference>,
        media_type: [u8; 16],
        ipfs_cid: [u8; 64],
    ) -> Result<()> {
        mediareference::add_media_reference(ctx, media_type, ipfs_cid)
    }

    pub fn remove_media_reference(
        ctx: Context<RemoveMediaReference>,
        media_index: u16,
    ) -> Result<()> {
        mediareference::remove_media_reference(ctx, media_index)
    }

    // ---- Custodians (death confirmation) ----
    pub fn add_custodian(ctx: Context<AddCustodian>) -> Result<()> {
        custodian::add_custodian(ctx)
    }

    pub fn remove_custodian(ctx: Context<RemoveCustodian>) -> Result<()> {
        custodian::remove_custodian(ctx)
    }

    pub fn confirm_death(ctx: Context<ConfirmDeath>) -> Result<()> {
        custodian::confirm_death(ctx)
    }

    /// Owner-only escape hatch: cancel an in-flight death confirmation while the
    /// grace period is still running and return the will to `Active`.
    pub fn revoke_death_confirmation(ctx: Context<RevokeDeathConfirmation>) -> Result<()> {
        custodian::revoke_death_confirmation(ctx)
    }

    // ---- Beneficiaries (inheritance) ----
    pub fn add_beneficiary(ctx: Context<AddBeneficiary>, allocation_percentage: u16) -> Result<()> {
        beneficiary::add_beneficiary(ctx, allocation_percentage)
    }

    pub fn remove_beneficiary(ctx: Context<RemoveBeneficiary>) -> Result<()> {
        beneficiary::remove_beneficiary(ctx)
    }

    pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
        beneficiary::claim_inheritance(ctx)
    }

    /// Beneficiary-only: publish the X25519 public key that document data keys
    /// are sealed to. Without this the owner cannot share encrypted media.
    pub fn register_recipient_key(
        ctx: Context<RegisterRecipientKey>,
        encryption_pubkey: [u8; 32],
    ) -> Result<()> {
        beneficiary::register_recipient_key(ctx, encryption_pubkey)
    }

    // ---- Token escrow ----
    pub fn add_token(ctx: Context<TokenWillAcc>, amount: u64) -> Result<()> {
        token::add_token_will_handler(ctx, amount)
    }

    pub fn delete_token(ctx: Context<DeleteTokenWillAcc>) -> Result<()> {
        token::delete_token_will_handler(ctx)
    }

    /// Beneficiary-only: claim this heir's proportional share of an escrowed
    /// token once the will is Claimable and the grace period has elapsed.
    pub fn claim_token(ctx: Context<ClaimToken>) -> Result<()> {
        token::claim_token_handler(ctx)
    }

    // ---- Post-inheritance teardown (permissionless cranks, value -> estate) ----

    /// Return every residual token (unallocated remainder, rounding dust, and
    /// unclaimed shares) to the estate and close the vault. Only after the
    /// heirs' claim window has closed.
    pub fn sweep_token_vault(ctx: Context<SweepTokenVault>) -> Result<()> {
        token::sweep_token_vault_handler(ctx)
    }

    pub fn cleanup_custodian(ctx: Context<CleanupCustodian>) -> Result<()> {
        cleanup::cleanup_custodian(ctx)
    }

    pub fn cleanup_beneficiary(ctx: Context<CleanupBeneficiary>) -> Result<()> {
        cleanup::cleanup_beneficiary(ctx)
    }

    pub fn cleanup_media(ctx: Context<CleanupMedia>) -> Result<()> {
        cleanup::cleanup_media(ctx)
    }

    pub fn close_will(ctx: Context<CloseWill>) -> Result<()> {
        cleanup::close_will(ctx)
    }
}
