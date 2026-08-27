use anchor_lang::prelude::*;

// PDA seed prefixes. Each child account namespaces its PDA under one of these so
// that, combined with the will key and the entity's wallet/index, every address
// is unique and deterministically re-derivable by the client.

/// Seed for the per-owner will PDA: `[WILL_SEED, owner]`.
#[constant]
pub const WILL_SEED: &[u8] = b"will";

/// Seed for a custodian PDA: `[CUSTODIAN_SEED, will, custodian_wallet]`.
#[constant]
pub const CUSTODIAN_SEED: &[u8] = b"custodian";

/// Seed for a beneficiary PDA: `[BENEFICIARY_SEED, will, beneficiary_wallet]`.
#[constant]
pub const BENEFICIARY_SEED: &[u8] = b"beneficiary";

#[constant]
pub const TOKEN_VAULT_SEED: &[u8] = b"tokenvault";

/// Seed for a token-claim marker PDA: `[TOKEN_CLAIM_SEED, token_vault, beneficiary_wallet]`.
#[constant]
pub const TOKEN_CLAIM_SEED: &[u8] = b"tokenclaim";

/// Seed for a media-reference PDA: `[MEDIA_REFERENCE_SEED, will, media_index_le]`.
#[constant]
pub const MEDIA_REFERENCE_SEED: &[u8] = b"mediareference";

/// Maximum total allocation across all beneficiaries, in basis points (100%).
#[constant]
pub const MAX_ALLOCATION_BPS: u16 = 10_000;

// ---- Post-death timeline ----
//
// Reaching custodian quorum does NOT immediately release the estate. Two windows
// run back-to-back from `Will::claimable_at`, and they are what make the
// dead-man's switch safe to operate:
//
//   quorum reached ──┬── GRACE_PERIOD ──┬── CLAIM_WINDOW ──┬── teardown
//   (claimable_at)   │                  │                  │
//                    │ owner may still  │ heirs claim      │ permissionless
//                    │ REVOKE; no       │ assets & media   │ cranks reclaim
//                    │ claim may run    │                  │ rent + sweep dust
//
// GRACE_PERIOD (C3) is the living owner's last line of defence: if custodians
// confirm death by mistake or malice, the owner has this long to sign a
// `revoke_death_confirmation` and put the will back to Active. Nothing may be
// claimed until it expires, so a false confirmation cannot move any asset.
//
// CLAIM_WINDOW (C1) guarantees every heir a bounded, exclusive period to claim
// before ANY permissionless cleanup crank may close their Beneficiary account.
// Without it, a stranger could close the heirs' accounts the instant the will
// became claimable and strand the escrowed tokens forever.

/// Seconds the owner has to revoke a death confirmation after quorum is reached.
/// Claims are frozen for this entire window.
#[constant]
pub const GRACE_PERIOD_SECONDS: i64 = 7 * 24 * 60 * 60; // 7 days

/// Seconds heirs have to claim, starting when the grace period ends. Only after
/// this expires may the permissionless teardown cranks run.
#[constant]
pub const CLAIM_WINDOW_SECONDS: i64 = 90 * 24 * 60 * 60; // 90 days
