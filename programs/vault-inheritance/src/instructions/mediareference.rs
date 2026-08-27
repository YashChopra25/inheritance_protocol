use crate::constants::{MEDIA_REFERENCE_SEED, WILL_SEED};
use crate::error::ErrorCode;
use crate::state::{MediaReference, Will};
use crate::WillStatus;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddMediaReference<'info> {
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

    // The PDA is seeded by the will's *monotonic* `media_index` (little-endian),
    // so each new media account gets a unique, never-reused address even after
    // earlier slots are removed.
    #[account(
        init,
        payer = owner,
        space = 8 + MediaReference::INIT_SPACE,
        seeds = [MEDIA_REFERENCE_SEED, will.key().as_ref(), will.media_index.to_le_bytes().as_ref()],
        bump
    )]
    pub media_reference: Account<'info, MediaReference>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(media_index: u16)]
pub struct RemoveMediaReference<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
        constraint = will.will_status == WillStatus::Active @ ErrorCode::WillNotActive,
        constraint = will.media_count > 0 @ ErrorCode::MediaCountIsZero
    )]
    pub will: Account<'info, Will>,

    // `media_index` (from instruction args) selects which media PDA to close.
    // `close = owner` refunds its rent to the owner (payer). `has_one = will`
    // prevents closing a media account that belongs to a different will.
    #[account(
        mut,
        close = owner,
        seeds = [MEDIA_REFERENCE_SEED, will.key().as_ref(), media_index.to_le_bytes().as_ref()],
        bump = media_reference.bump,
        has_one = will
    )]
    pub media_reference: Account<'info, MediaReference>,
}

/// Owner-only: store an IPFS CID reference.
///
/// The bytes on IPFS are ciphertext: the file is encrypted in the owner's
/// browser before upload and the CID published here reveals nothing but the
/// existence of a document (C5).
pub fn add_media_reference(
    ctx: Context<AddMediaReference>,
    media_type: [u8; 16],
    ipfs_cid: [u8; 64],
) -> Result<()> {
    // H1: refuse to put anything into a will whose quorum can never be met —
    // its estate would be permanently unreachable by the heirs it names.
    ctx.accounts.will.require_quorum_reachable()?;

    let will = &mut ctx.accounts.will;
    let media = &mut ctx.accounts.media_reference;

    media.will = will.key();
    media.media_index = will.media_index;
    media.media_type = media_type;
    media.ipfs_cid = ipfs_cid;
    media.bump = ctx.bumps.media_reference;

    // `media_index` is monotonic (never reused) so PDAs never collide after a
    // removal; `media_count` tracks how many are currently active (rent held).
    will.media_index = will
        .media_index
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    will.media_count = will
        .media_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// Owner-only: remove a media reference and refund its rent. The account is
/// closed by the `close = owner` constraint; here we only adjust the counter.
/// `media_index` is consumed by the account-context seed derivation above.
pub fn remove_media_reference(ctx: Context<RemoveMediaReference>, _media_index: u16) -> Result<()> {
    let will = &mut ctx.accounts.will;
    will.media_count = will
        .media_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}
