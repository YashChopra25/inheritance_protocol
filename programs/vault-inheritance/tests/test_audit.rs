// Independent audit/behaviour suite for vault-inheritance.
//
// Unlike a happy-path test, every security invariant is exercised from both
// sides: the action is shown to FAIL when it must and SUCCEED when it may.
// Time is advanced via the Clock sysvar to drive the dead-man's switch.

use {
    anchor_lang::{
        prelude::Clock, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    vault_inheritance::state::{Will, WillStatus},
};

use anchor_lang::prelude::Pubkey;

const WILL_SEED: &[u8] = b"will";
const CUSTODIAN_SEED: &[u8] = b"custodian";
const BENEFICIARY_SEED: &[u8] = b"beneficiary";
const MEDIA_SEED: &[u8] = b"mediareference";
const THRESHOLD: i64 = 1_000; // seconds of silence before death may be confirmed
/// Mirrors `constants::GRACE_PERIOD_SECONDS` — the owner's revocation window.
const GRACE: i64 = 7 * 24 * 60 * 60;
/// Mirrors `constants::CLAIM_WINDOW_SECONDS` — the heirs' exclusive claim window.
const CLAIM_WINDOW: i64 = 90 * 24 * 60 * 60;

struct Env {
    svm: LiteSVM,
    program_id: Pubkey,
}

fn setup() -> Env {
    let program_id = vault_inheritance::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/vault_inheritance.so");
    svm.add_program(program_id, bytes).unwrap();
    Env { svm, program_id }
}

fn fund(svm: &mut LiteSVM) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    kp
}

fn send(
    svm: &mut LiteSVM,
    payer: &Keypair,
    signers: &[&Keypair],
    ix: Instruction,
) -> std::result::Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers)
        .map_err(|e| e.to_string())?;
    svm.send_transaction(tx)
        .map_err(|e| format!("{:?}", e.err))?;
    Ok(())
}

fn load<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    let acct = svm.get_account(key).expect("account should exist");
    T::try_deserialize(&mut acct.data.as_slice()).expect("deserialize")
}

/// Advance the on-chain clock by `secs` seconds.
fn warp(svm: &mut LiteSVM, secs: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp += secs;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
}

fn will_pda(program_id: &Pubkey, owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[WILL_SEED, owner.as_ref()], program_id).0
}

fn init_will(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    threshold: i64,
    min: u8,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, &owner.pubkey());
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::InitializeWill {
                owner: owner.pubkey(),
                will,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::InitialiseWill {
                inactivity_threshold: threshold,
                min_approval: min,
            }
            .data(),
        },
    )
}

fn update_will(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    threshold: Option<i64>,
    min: Option<u8>,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, &owner.pubkey());
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::UpdateWill {
                owner: owner.pubkey(),
                will,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::UpdateWill {
                inactivity_threshold: threshold,
                min_approval: min,
            }
            .data(),
        },
    )
}

fn add_custodian(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    wallet: &Pubkey,
) -> Pubkey {
    let will = will_pda(program_id, &owner.pubkey());
    let cpda = Pubkey::find_program_address(
        &[CUSTODIAN_SEED, will.as_ref(), wallet.as_ref()],
        program_id,
    )
    .0;
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::AddCustodian {
                owner: owner.pubkey(),
                will,
                custodian: cpda,
                wallet_key: *wallet,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::AddCustodian {}.data(),
        },
    )
    .unwrap();
    cpda
}

fn remove_custodian(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    wallet: &Pubkey,
    cpda: Pubkey,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, &owner.pubkey());
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::RemoveCustodian {
                owner: owner.pubkey(),
                will,
                custodian: cpda,
                wallet_key: *wallet,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::RemoveCustodian {}.data(),
        },
    )
}

fn confirm_death(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner_pk: &Pubkey,
    signer: &Keypair,
    cpda: Pubkey,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, owner_pk);
    send(
        svm,
        signer,
        &[signer],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::ConfirmDeath {
                custodian_signer: signer.pubkey(),
                will,
                custodian: cpda,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::ConfirmDeath {}.data(),
        },
    )
}

fn add_beneficiary(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    wallet: &Pubkey,
    bps: u16,
) -> std::result::Result<Pubkey, String> {
    let will = will_pda(program_id, &owner.pubkey());
    let ben = Pubkey::find_program_address(
        &[BENEFICIARY_SEED, will.as_ref(), wallet.as_ref()],
        program_id,
    )
    .0;
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::AddBeneficiary {
                owner: owner.pubkey(),
                will,
                beneficiary: ben,
                wallet_key: *wallet,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::AddBeneficiary {
                allocation_percentage: bps,
            }
            .data(),
        },
    )
    .map(|_| ben)
}

fn add_media(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    idx: u16,
    cid: [u8; 64],
) -> Pubkey {
    let will = will_pda(program_id, &owner.pubkey());
    let media =
        Pubkey::find_program_address(&[MEDIA_SEED, will.as_ref(), &idx.to_le_bytes()], program_id)
            .0;
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::AddMediaReference {
                owner: owner.pubkey(),
                will,
                media_reference: media,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::AddMediaReference {
                media_type: [0u8; 16],
                ipfs_cid: cid,
            }
            .data(),
        },
    )
    .unwrap();
    media
}

fn claim(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner_pk: &Pubkey,
    heir: &Keypair,
    ben: Pubkey,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, owner_pk);
    send(
        svm,
        heir,
        &[heir],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::ClaimInheritance {
                beneficiary_signer: heir.pubkey(),
                will,
                beneficiary: ben,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::ClaimInheritance {}.data(),
        },
    )
}

// =========================================================================
// C1 — the dead-man's switch is now enforced.
// =========================================================================

#[test]
fn death_blocked_while_owner_active_then_allowed_after_threshold() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    // Owner just created the will -> still active. Confirming MUST fail now.
    let early = confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda);
    assert!(
        early.is_err(),
        "death must be blocked while owner is active"
    );

    // Not quite enough silence yet.
    warp(&mut svm, THRESHOLD - 1);
    assert!(confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).is_err());

    // Threshold elapsed -> now allowed.
    warp(&mut svm, 2);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
    assert_eq!(
        load::<Will>(&svm, &will_pda(&program_id, &owner.pubkey())).will_status,
        WillStatus::Claimable
    );
}

#[test]
fn ping_resets_the_dead_mans_switch() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    // Almost expired...
    warp(&mut svm, THRESHOLD - 10);
    // ...owner pings (proves life), resetting the timer.
    update_will(&mut svm, &program_id, &owner, None, None).unwrap();

    // Advancing past the *original* deadline is no longer enough.
    warp(&mut svm, 20);
    assert!(
        confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).is_err(),
        "ping should have reset the inactivity timer"
    );

    // Only after a fresh full window does it open up.
    warp(&mut svm, THRESHOLD);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
}

#[test]
fn init_rejects_bad_config() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    // Non-positive threshold rejected.
    assert!(init_will(&mut svm, &program_id, &owner, 0, 1).is_err());
    assert!(init_will(&mut svm, &program_id, &owner, -5, 1).is_err());
    // Zero min approval rejected.
    assert!(init_will(&mut svm, &program_id, &owner, THRESHOLD, 0).is_err());
    // Valid config succeeds.
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
}

// =========================================================================
// H1/H3 — min_approvals invariant.
// =========================================================================

#[test]
fn update_will_enforces_min_approval_bounds() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let c1 = fund(&mut svm);
    let c2 = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &c1.pubkey());
    add_custodian(&mut svm, &program_id, &owner, &c2.pubkey());

    // H3: zero rejected.
    assert!(update_will(&mut svm, &program_id, &owner, None, Some(0)).is_err());
    // H1: cannot require more approvals than custodians (2).
    assert!(update_will(&mut svm, &program_id, &owner, None, Some(3)).is_err());
    // Exactly custodian_count is allowed.
    update_will(&mut svm, &program_id, &owner, None, Some(2)).unwrap();
    assert_eq!(
        load::<Will>(&svm, &will_pda(&program_id, &owner.pubkey())).min_approvals,
        2
    );
}

#[test]
fn remove_custodian_cannot_break_min_approvals() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 2).unwrap();
    let c1 = fund(&mut svm);
    let c2 = fund(&mut svm);
    let cpda1 = add_custodian(&mut svm, &program_id, &owner, &c1.pubkey());
    let cpda2 = add_custodian(&mut svm, &program_id, &owner, &c2.pubkey());

    // min=2, count=2: removing one would leave count=1 < 2 -> blocked.
    assert!(remove_custodian(&mut svm, &program_id, &owner, &c2.pubkey(), cpda2).is_err());
    svm.expire_blockhash();

    // Lower the requirement first, then removal is allowed.
    update_will(&mut svm, &program_id, &owner, None, Some(1)).unwrap();
    svm.expire_blockhash();
    remove_custodian(&mut svm, &program_id, &owner, &c2.pubkey(), cpda2).unwrap();
    svm.expire_blockhash();
    // The last custodian (count 1 -> 0) is always removable for full teardown.
    remove_custodian(&mut svm, &program_id, &owner, &c1.pubkey(), cpda1).unwrap();
    assert_eq!(
        load::<Will>(&svm, &will_pda(&program_id, &owner.pubkey())).custodian_count,
        0
    );
}

// =========================================================================
// H2 — full lifecycle + permissionless teardown reclaims ALL rent to estate.
// =========================================================================

#[test]
fn full_lifecycle_and_estate_teardown_refunds_rent() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 2).unwrap();

    // H1: custodians first — no asset may enter a will whose quorum is
    // unreachable, and min_approvals is 2, so both must exist before add_media.
    let c1 = fund(&mut svm);
    let c2 = fund(&mut svm);
    let cpda1 = add_custodian(&mut svm, &program_id, &owner, &c1.pubkey());
    let cpda2 = add_custodian(&mut svm, &program_id, &owner, &c2.pubkey());

    // Media (CIDv1-sized to prove the 64-byte CID field works).
    let mut cid = [0u8; 64];
    cid[..59].copy_from_slice(b"bafybeib4ftq6m7d2x3c5n7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5");
    let media = add_media(&mut svm, &program_id, &owner, 0, cid);
    let heir = fund(&mut svm);
    let ben = add_beneficiary(&mut svm, &program_id, &owner, &heir.pubkey(), 6_000).unwrap();

    // Owner goes silent past the threshold; both custodians confirm.
    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &c1, cpda1).unwrap();
    assert_eq!(
        load::<Will>(&svm, &will).will_status,
        WillStatus::PendingInheritance
    );
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &c2, cpda2).unwrap();
    assert_eq!(load::<Will>(&svm, &will).will_status, WillStatus::Claimable);

    // C3: quorum alone does not open claims — the owner's grace period runs first.
    assert!(
        claim(&mut svm, &program_id, &owner.pubkey(), &heir, ben).is_err(),
        "claims must be frozen during the owner's revocation window"
    );
    warp(&mut svm, GRACE + 1);

    // Heir claims.
    claim(&mut svm, &program_id, &owner.pubkey(), &heir, ben).unwrap();
    assert!(load::<Will>(&svm, &will).beneficiaries_claimed == 1);
    // Double-claim rejected.
    svm.expire_blockhash();
    assert!(claim(&mut svm, &program_id, &owner.pubkey(), &heir, ben).is_err());

    // C1: the heirs' claim window must close before ANY crank may run.
    let cranker = fund(&mut svm);
    let premature = send(
        &mut svm,
        &cranker,
        &[&cranker],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::CleanupBeneficiary {
                cranker: cranker.pubkey(),
                owner: owner.pubkey(),
                will,
                beneficiary: ben,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::CleanupBeneficiary {}.data(),
        },
    );
    assert!(
        premature.is_err(),
        "cranks must not run while the claim window is open"
    );
    warp(&mut svm, CLAIM_WINDOW + 1);

    // A random third party cranks the teardown; rent must flow to the OWNER.
    let owner_before = svm.get_account(&owner.pubkey()).unwrap().lamports;

    let cleanup = |svm: &mut LiteSVM,
                   accounts: Vec<anchor_lang::solana_program::instruction::AccountMeta>,
                   data: Vec<u8>| {
        send(
            svm,
            &cranker,
            &[&cranker],
            Instruction {
                program_id,
                accounts,
                data,
            },
        )
    };
    cleanup(
        &mut svm,
        vault_inheritance::accounts::CleanupMedia {
            cranker: cranker.pubkey(),
            owner: owner.pubkey(),
            will,
            media_reference: media,
        }
        .to_account_metas(None),
        vault_inheritance::instruction::CleanupMedia {}.data(),
    )
    .unwrap();
    cleanup(
        &mut svm,
        vault_inheritance::accounts::CleanupBeneficiary {
            cranker: cranker.pubkey(),
            owner: owner.pubkey(),
            will,
            beneficiary: ben,
        }
        .to_account_metas(None),
        vault_inheritance::instruction::CleanupBeneficiary {}.data(),
    )
    .unwrap();
    for cpda in [cpda1, cpda2] {
        cleanup(
            &mut svm,
            vault_inheritance::accounts::CleanupCustodian {
                cranker: cranker.pubkey(),
                owner: owner.pubkey(),
                will,
                custodian: cpda,
            }
            .to_account_metas(None),
            vault_inheritance::instruction::CleanupCustodian {}.data(),
        )
        .unwrap();
    }

    let w = load::<Will>(&svm, &will);
    assert_eq!(w.media_count, 0);
    assert_eq!(w.custodian_count, 0);
    assert_eq!(w.beneficiary_count, 0);

    // close_will only succeeds now that all children are gone.
    cleanup(
        &mut svm,
        vault_inheritance::accounts::CloseWill {
            cranker: cranker.pubkey(),
            owner: owner.pubkey(),
            will,
        }
        .to_account_metas(None),
        vault_inheritance::instruction::CloseWill {}.data(),
    )
    .unwrap();

    // Will account is gone and ALL reclaimed rent landed on the owner (estate),
    // not the cranker.
    assert!(svm
        .get_account(&will)
        .map(|a| a.data.is_empty())
        .unwrap_or(true));
    let owner_after = svm.get_account(&owner.pubkey()).unwrap().lamports;
    assert!(
        owner_after > owner_before,
        "all rent must be refunded to the estate/owner"
    );
}

#[test]
fn close_will_blocked_while_children_remain() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();

    let cranker = fund(&mut svm);
    // custodian still alive -> close_will must fail.
    let res = send(
        &mut svm,
        &cranker,
        &[&cranker],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::CloseWill {
                cranker: cranker.pubkey(),
                owner: owner.pubkey(),
                will,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::CloseWill {}.data(),
        },
    );
    assert!(res.is_err(), "cannot close estate while children remain");
}

// =========================================================================
// Access control & misc invariants (unchanged behaviours, re-verified).
// =========================================================================

#[test]
fn non_custodian_cannot_confirm_death() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let real = fund(&mut svm);
    let _real = add_custodian(&mut svm, &program_id, &owner, &real.pubkey());
    warp(&mut svm, THRESHOLD + 1);

    let attacker = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    let fake = Pubkey::find_program_address(
        &[CUSTODIAN_SEED, will.as_ref(), attacker.pubkey().as_ref()],
        &program_id,
    )
    .0;
    assert!(confirm_death(&mut svm, &program_id, &owner.pubkey(), &attacker, fake).is_err());
}

#[test]
fn allocation_cannot_exceed_100_percent() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let (h1, h2, h3) = (fund(&mut svm), fund(&mut svm), fund(&mut svm));
    assert!(add_beneficiary(&mut svm, &program_id, &owner, &h1.pubkey(), 7_000).is_ok());
    // 7000 + 4000 > 10000 -> rejected.
    assert!(add_beneficiary(&mut svm, &program_id, &owner, &h2.pubkey(), 4_000).is_err());
    // 7000 + 3000 == 10000 -> allowed.
    assert!(add_beneficiary(&mut svm, &program_id, &owner, &h3.pubkey(), 3_000).is_ok());
    assert_eq!(
        load::<Will>(&svm, &will_pda(&program_id, &owner.pubkey())).total_allocated_percentage,
        10_000
    );
}

#[test]
fn delete_will_refunds_rent_to_owner_while_active() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let after_init = svm.get_account(&owner.pubkey()).unwrap().lamports;

    svm.expire_blockhash();
    send(
        &mut svm,
        &owner,
        &[&owner],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::DeleteWill {
                owner: owner.pubkey(),
                will,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::DeleteWill {}.data(),
        },
    )
    .unwrap();
    let after_delete = svm.get_account(&owner.pubkey()).unwrap().lamports;
    assert!(
        after_delete > after_init,
        "rent should be refunded on delete"
    );
    assert!(svm
        .get_account(&will)
        .map(|a| a.data.is_empty())
        .unwrap_or(true));
}

#[test]
fn media_index_is_monotonic_after_remove() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    // H1: quorum must be reachable before any media may be added.
    let cust = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    let m0 = add_media(&mut svm, &program_id, &owner, 0, [1u8; 64]);
    assert_eq!(load::<Will>(&svm, &will).media_index, 1);
    // remove index 0
    send(
        &mut svm,
        &owner,
        &[&owner],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::RemoveMediaReference {
                owner: owner.pubkey(),
                will,
                media_reference: m0,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::RemoveMediaReference { media_index: 0 }.data(),
        },
    )
    .unwrap();
    assert_eq!(load::<Will>(&svm, &will).media_count, 0);
    // next add must use index 1 (monotonic) -> no PDA collision
    let _m1 = add_media(&mut svm, &program_id, &owner, 1, [2u8; 64]);
    assert_eq!(load::<Will>(&svm, &will).media_index, 2);
    assert_eq!(load::<Will>(&svm, &will).media_count, 1);
}

#[test]
fn test_token_escrow_lifecycle() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();

    let create_ata_ix = |payer: Pubkey, authority: Pubkey, mint: Pubkey| -> Instruction {
        Instruction {
            program_id: anchor_spl::associated_token::ID,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(payer, true),
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    anchor_spl::associated_token::get_associated_token_address(&authority, &mint),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    authority, false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(mint, false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    anchor_lang::system_program::ID,
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    anchor_spl::token::ID,
                    false,
                ),
            ],
            data: vec![],
        }
    };

    // 1. Setup Token Mint and owner ATA
    let mint_keypair = Keypair::new();
    let mint_pubkey = mint_keypair.pubkey();

    let rent = 2_000_000;
    let create_mint_idx = anchor_lang::solana_program::system_instruction::create_account(
        &owner.pubkey(),
        &mint_pubkey,
        rent,
        82,
        &anchor_spl::token::ID,
    );
    let init_mint_idx = anchor_spl::token::spl_token::instruction::initialize_mint(
        &anchor_spl::token::ID,
        &mint_pubkey,
        &owner.pubkey(),
        None,
        9,
    )
    .unwrap();

    send(&mut svm, &owner, &[&owner, &mint_keypair], create_mint_idx).unwrap();
    send(&mut svm, &owner, &[&owner], init_mint_idx).unwrap();

    // Create owner's ATA
    let ata =
        anchor_spl::associated_token::get_associated_token_address(&owner.pubkey(), &mint_pubkey);
    let create_ata_idx = create_ata_ix(owner.pubkey(), owner.pubkey(), mint_pubkey);
    send(&mut svm, &owner, &[&owner], create_ata_idx).unwrap();

    // Mint some tokens to owner's ATA
    let mint_to_idx = anchor_spl::token::spl_token::instruction::mint_to(
        &anchor_spl::token::ID,
        &mint_pubkey,
        &ata,
        &owner.pubkey(),
        &[],
        100_000_000,
    )
    .unwrap();
    send(&mut svm, &owner, &[&owner], mint_to_idx).unwrap();

    // 2. Try calling add_token BEFORE adding any custodian.
    // It should fail with NoCustodians.
    let token_vault = Pubkey::find_program_address(
        &[b"tokenvault", will.as_ref(), mint_pubkey.as_ref()],
        &program_id,
    )
    .0;
    let vault = anchor_spl::associated_token::get_associated_token_address(&will, &mint_pubkey);

    let add_token_ix = Instruction {
        program_id,
        accounts: vault_inheritance::accounts::TokenWillAcc {
            owner: owner.pubkey(),
            will,
            token_mint: mint_pubkey,
            token_vault,
            ata,
            vault,
            token_program: anchor_spl::token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: vault_inheritance::instruction::AddToken { amount: 50_000_000 }.data(),
    };

    let err = send(&mut svm, &owner, &[&owner], add_token_ix.clone()).unwrap_err();
    assert!(
        err.contains("NoCustodians") || err.contains("6015"),
        "Should fail with NoCustodians: {}",
        err
    );

    // 3. Add custodian and verify add_token now succeeds
    let cust = Keypair::new();
    add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    svm.expire_blockhash();
    send(&mut svm, &owner, &[&owner], add_token_ix).unwrap();

    // 4. Verify balances
    let owner_ata: anchor_spl::token::TokenAccount = load(&svm, &ata);
    let vault_ata: anchor_spl::token::TokenAccount = load(&svm, &vault);
    assert_eq!(owner_ata.amount, 50_000_000);
    assert_eq!(vault_ata.amount, 50_000_000);

    // 5. Verify TokenVault account state
    let tv: vault_inheritance::state::TokenVault = load(&svm, &token_vault);
    assert_eq!(tv.will, will);
    assert_eq!(tv.token_mint, mint_pubkey);
    assert_eq!(tv.ata, ata);
    assert_eq!(tv.vault, vault);

    // 6. Try adding 0 amount. It should fail with InvalidAmount.
    let mint_keypair2 = Keypair::new();
    let mint_pubkey2 = mint_keypair2.pubkey();
    let create_mint_idx2 = anchor_lang::solana_program::system_instruction::create_account(
        &owner.pubkey(),
        &mint_pubkey2,
        rent,
        82,
        &anchor_spl::token::ID,
    );
    let init_mint_idx2 = anchor_spl::token::spl_token::instruction::initialize_mint(
        &anchor_spl::token::ID,
        &mint_pubkey2,
        &owner.pubkey(),
        None,
        9,
    )
    .unwrap();
    send(
        &mut svm,
        &owner,
        &[&owner, &mint_keypair2],
        create_mint_idx2,
    )
    .unwrap();
    send(&mut svm, &owner, &[&owner], init_mint_idx2).unwrap();

    let ata2 =
        anchor_spl::associated_token::get_associated_token_address(&owner.pubkey(), &mint_pubkey2);
    let create_ata_idx2 = create_ata_ix(owner.pubkey(), owner.pubkey(), mint_pubkey2);
    send(&mut svm, &owner, &[&owner], create_ata_idx2).unwrap();

    let token_vault2 = Pubkey::find_program_address(
        &[b"tokenvault", will.as_ref(), mint_pubkey2.as_ref()],
        &program_id,
    )
    .0;
    let vault2 = anchor_spl::associated_token::get_associated_token_address(&will, &mint_pubkey2);

    let add_zero_ix2 = Instruction {
        program_id,
        accounts: vault_inheritance::accounts::TokenWillAcc {
            owner: owner.pubkey(),
            will,
            token_mint: mint_pubkey2,
            token_vault: token_vault2,
            ata: ata2,
            vault: vault2,
            token_program: anchor_spl::token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: vault_inheritance::instruction::AddToken { amount: 0 }.data(),
    };

    let err2 = send(&mut svm, &owner, &[&owner], add_zero_ix2).unwrap_err();
    assert!(
        err2.contains("InvalidAmount") || err2.contains("6019"),
        "Should fail with InvalidAmount: {}",
        err2
    );
}

// =========================================================================
// Hardening suite — one test per issue found in the production-readiness
// audit. Each is written so that it FAILS against the pre-fix program.
// =========================================================================

use anchor_lang::solana_program::program_pack::Pack;
use vault_inheritance::state::{Beneficiary, TokenVault};

const TOKEN_CLAIM_SEED: &[u8] = b"tokenclaim";
const TOKEN_VAULT_SEED: &[u8] = b"tokenvault";

// ---- SPL helpers -------------------------------------------------------

fn create_ata_ix(payer: Pubkey, authority: Pubkey, mint: Pubkey) -> Instruction {
    use anchor_lang::solana_program::instruction::AccountMeta;
    Instruction {
        program_id: anchor_spl::associated_token::ID,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(
                anchor_spl::associated_token::get_associated_token_address(&authority, &mint),
                false,
            ),
            AccountMeta::new_readonly(authority, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data: vec![],
    }
}

/// Create a 9-decimal mint owned by `owner` and mint `amount` into their ATA.
fn mint_with_balance(svm: &mut LiteSVM, owner: &Keypair, amount: u64) -> (Pubkey, Pubkey) {
    let mint_kp = Keypair::new();
    let mint = mint_kp.pubkey();

    let create = anchor_lang::solana_program::system_instruction::create_account(
        &owner.pubkey(),
        &mint,
        2_000_000,
        82,
        &anchor_spl::token::ID,
    );
    let init = anchor_spl::token::spl_token::instruction::initialize_mint(
        &anchor_spl::token::ID,
        &mint,
        &owner.pubkey(),
        None,
        9,
    )
    .unwrap();
    send(svm, owner, &[owner, &mint_kp], create).unwrap();
    send(svm, owner, &[owner], init).unwrap();

    let ata = anchor_spl::associated_token::get_associated_token_address(&owner.pubkey(), &mint);
    send(
        svm,
        owner,
        &[owner],
        create_ata_ix(owner.pubkey(), owner.pubkey(), mint),
    )
    .unwrap();

    let mint_to = anchor_spl::token::spl_token::instruction::mint_to(
        &anchor_spl::token::ID,
        &mint,
        &ata,
        &owner.pubkey(),
        &[],
        amount,
    )
    .unwrap();
    send(svm, owner, &[owner], mint_to).unwrap();
    (mint, ata)
}

fn token_balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    match svm.get_account(ata) {
        Some(a) if !a.data.is_empty() => {
            anchor_spl::token::spl_token::state::Account::unpack(&a.data)
                .map(|t| t.amount)
                .unwrap_or(0)
        }
        _ => 0,
    }
}

fn token_vault_pda(program_id: &Pubkey, will: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[TOKEN_VAULT_SEED, will.as_ref(), mint.as_ref()],
        program_id,
    )
    .0
}

fn escrow_token(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
    mint: Pubkey,
    ata: Pubkey,
    amount: u64,
) -> std::result::Result<Pubkey, String> {
    let will = will_pda(program_id, &owner.pubkey());
    let token_vault = token_vault_pda(program_id, &will, &mint);
    let vault = anchor_spl::associated_token::get_associated_token_address(&will, &mint);
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::TokenWillAcc {
                owner: owner.pubkey(),
                will,
                token_mint: mint,
                token_vault,
                ata,
                vault,
                token_program: anchor_spl::token::ID,
                associated_token_program: anchor_spl::associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::AddToken { amount }.data(),
        },
    )
    .map(|_| token_vault)
}

fn claim_token(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner_pk: &Pubkey,
    heir: &Keypair,
    mint: Pubkey,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, owner_pk);
    let token_vault = token_vault_pda(program_id, &will, &mint);
    send(
        svm,
        heir,
        &[heir],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::ClaimToken {
                beneficiary_signer: heir.pubkey(),
                will,
                beneficiary: Pubkey::find_program_address(
                    &[BENEFICIARY_SEED, will.as_ref(), heir.pubkey().as_ref()],
                    program_id,
                )
                .0,
                token_vault,
                token_mint: mint,
                vault: anchor_spl::associated_token::get_associated_token_address(&will, &mint),
                beneficiary_ata: anchor_spl::associated_token::get_associated_token_address(
                    &heir.pubkey(),
                    &mint,
                ),
                token_claim: Pubkey::find_program_address(
                    &[
                        TOKEN_CLAIM_SEED,
                        token_vault.as_ref(),
                        heir.pubkey().as_ref(),
                    ],
                    program_id,
                )
                .0,
                token_program: anchor_spl::token::ID,
                associated_token_program: anchor_spl::associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::ClaimToken {}.data(),
        },
    )
}

fn sweep_vault(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner_pk: &Pubkey,
    cranker: &Keypair,
    mint: Pubkey,
) -> std::result::Result<(), String> {
    let will = will_pda(program_id, owner_pk);
    send(
        svm,
        cranker,
        &[cranker],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::SweepTokenVault {
                cranker: cranker.pubkey(),
                owner: *owner_pk,
                will,
                token_mint: mint,
                token_vault: token_vault_pda(program_id, &will, &mint),
                vault: anchor_spl::associated_token::get_associated_token_address(&will, &mint),
                owner_ata: anchor_spl::associated_token::get_associated_token_address(
                    owner_pk, &mint,
                ),
                token_program: anchor_spl::token::ID,
                associated_token_program: anchor_spl::associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::SweepTokenVault {}.data(),
        },
    )
}

fn cleanup_beneficiary(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner_pk: &Pubkey,
    cranker: &Keypair,
    ben: Pubkey,
) -> std::result::Result<(), String> {
    send(
        svm,
        cranker,
        &[cranker],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::CleanupBeneficiary {
                cranker: cranker.pubkey(),
                owner: *owner_pk,
                will: will_pda(program_id, owner_pk),
                beneficiary: ben,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::CleanupBeneficiary {}.data(),
        },
    )
}

fn revoke(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    owner: &Keypair,
) -> std::result::Result<(), String> {
    send(
        svm,
        owner,
        &[owner],
        Instruction {
            program_id: *program_id,
            accounts: vault_inheritance::accounts::RevokeDeathConfirmation {
                owner: owner.pubkey(),
                will: will_pda(program_id, &owner.pubkey()),
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::RevokeDeathConfirmation {}.data(),
        },
    )
}

/// Owner + custodians + one escrowed mint, wound forward to `Claimable`.
struct Estate {
    owner: Keypair,
    will: Pubkey,
    mint: Pubkey,
}

fn estate_at_quorum(svm: &mut LiteSVM, program_id: &Pubkey, escrow: u64) -> Estate {
    let owner = fund(svm);
    let will = will_pda(program_id, &owner.pubkey());
    init_will(svm, program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(svm);
    let cpda = add_custodian(svm, program_id, &owner, &cust.pubkey());
    let (mint, ata) = mint_with_balance(svm, &owner, escrow * 2);
    escrow_token(svm, program_id, &owner, mint, ata, escrow).unwrap();
    let _ = ata;
    warp(svm, THRESHOLD + 1);
    confirm_death(svm, program_id, &owner.pubkey(), &cust, cpda).unwrap();
    assert_eq!(load::<Will>(svm, &will).will_status, WillStatus::Claimable);
    Estate { owner, will, mint }
}

// ---- C1: permissionless cleanup must not front-run the heirs -----------

#[test]
fn c1_cleanup_cannot_front_run_a_pending_token_claim() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    // The heir and the escrow are both registered while the will is Active,
    // because nothing may be configured once quorum is reached.
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let heir = fund(&mut svm);
    let ben = add_beneficiary(&mut svm, &program_id, &owner, &heir.pubkey(), 10_000).unwrap();
    let (mint, ata) = mint_with_balance(&mut svm, &owner, 200_000_000);
    escrow_token(&mut svm, &program_id, &owner, mint, ata, 100_000_000).unwrap();

    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
    warp(&mut svm, GRACE + 1); // claims now open

    // An unrelated stranger tries to destroy the heir's claim by closing their
    // Beneficiary account. Pre-fix this SUCCEEDED and the tokens were lost.
    let attacker = fund(&mut svm);
    assert!(
        cleanup_beneficiary(&mut svm, &program_id, &owner.pubkey(), &attacker, ben).is_err(),
        "a stranger must not be able to close a beneficiary during the claim window"
    );

    // The heir's claim still works, and they receive their full 100% share.
    claim_token(&mut svm, &program_id, &owner.pubkey(), &heir, mint).unwrap();
    let heir_ata =
        anchor_spl::associated_token::get_associated_token_address(&heir.pubkey(), &mint);
    assert_eq!(token_balance(&svm, &heir_ata), 100_000_000);
}

#[test]
fn c1_cleanup_opens_only_after_the_claim_window_closes() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let heir = fund(&mut svm);
    let ben = add_beneficiary(&mut svm, &program_id, &owner, &heir.pubkey(), 5_000).unwrap();
    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();

    let cranker = fund(&mut svm);
    // During grace: blocked.
    assert!(cleanup_beneficiary(&mut svm, &program_id, &owner.pubkey(), &cranker, ben).is_err());
    // During the claim window: still blocked.
    warp(&mut svm, GRACE + 1);
    assert!(cleanup_beneficiary(&mut svm, &program_id, &owner.pubkey(), &cranker, ben).is_err());
    // One second before the window closes: still blocked.
    warp(&mut svm, CLAIM_WINDOW - 2);
    assert!(cleanup_beneficiary(&mut svm, &program_id, &owner.pubkey(), &cranker, ben).is_err());
    // After it closes: allowed.
    warp(&mut svm, 2);
    cleanup_beneficiary(&mut svm, &program_id, &owner.pubkey(), &cranker, ben).unwrap();
}

// ---- C2: a will can never be closed out from under escrowed tokens -----

#[test]
fn c2_delete_will_blocked_while_a_token_vault_lives() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let (mint, ata) = mint_with_balance(&mut svm, &owner, 50_000);
    escrow_token(&mut svm, &program_id, &owner, mint, ata, 50_000).unwrap();
    assert_eq!(load::<Will>(&svm, &will).token_vault_count, 1);

    // Even with every other child removed, the live vault must block deletion.
    remove_custodian(&mut svm, &program_id, &owner, &cust.pubkey(), cpda).unwrap();
    let err = send(
        &mut svm,
        &owner,
        &[&owner],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::DeleteWill {
                owner: owner.pubkey(),
                will,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::DeleteWill {}.data(),
        },
    )
    .unwrap_err();
    assert!(
        err.contains("6026") || err.contains("WillHasTokenVaults"),
        "expected WillHasTokenVaults, got {err}"
    );
}

#[test]
fn c2_close_will_blocked_while_a_token_vault_lives() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let e = estate_at_quorum(&mut svm, &program_id, 10_000);
    assert_eq!(load::<Will>(&svm, &e.will).token_vault_count, 1);

    warp(&mut svm, GRACE + CLAIM_WINDOW + 2);
    let cranker = fund(&mut svm);
    let close = |svm: &mut LiteSVM| {
        send(
            svm,
            &cranker,
            &[&cranker],
            Instruction {
                program_id,
                accounts: vault_inheritance::accounts::CloseWill {
                    cranker: cranker.pubkey(),
                    owner: e.owner.pubkey(),
                    will: e.will,
                }
                .to_account_metas(None),
                data: vault_inheritance::instruction::CloseWill {}.data(),
            },
        )
    };

    let err = close(&mut svm).unwrap_err();
    assert!(
        err.contains("6026") || err.contains("WillHasTokenVaults"),
        "expected WillHasTokenVaults, got {err}"
    );

    // Sweeping the vault clears the blocker (custodian still remains, so the
    // close now fails on EstateNotEmpty instead — a different, correct error).
    sweep_vault(&mut svm, &program_id, &e.owner.pubkey(), &cranker, e.mint).unwrap();
    assert_eq!(load::<Will>(&svm, &e.will).token_vault_count, 0);
    svm.expire_blockhash();
    let err2 = close(&mut svm).unwrap_err();
    assert!(
        err2.contains("6018") || err2.contains("EstateNotEmpty"),
        "expected EstateNotEmpty, got {err2}"
    );
}

#[test]
fn c2_token_vault_count_tracks_add_topup_and_delete() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let (mint, ata) = mint_with_balance(&mut svm, &owner, 900);

    let tv = escrow_token(&mut svm, &program_id, &owner, mint, ata, 300).unwrap();
    assert_eq!(load::<Will>(&svm, &will).token_vault_count, 1);
    // A top-up must NOT double-count the vault, but must accumulate the total.
    escrow_token(&mut svm, &program_id, &owner, mint, ata, 200).unwrap();
    assert_eq!(load::<Will>(&svm, &will).token_vault_count, 1);
    assert_eq!(load::<TokenVault>(&svm, &tv).total_amount, 500);

    // Owner withdraws everything: balance returns and the counter drops to 0.
    let before = token_balance(&svm, &ata);
    send(
        &mut svm,
        &owner,
        &[&owner],
        Instruction {
            program_id,
            accounts: vault_inheritance::accounts::DeleteTokenWillAcc {
                owner: owner.pubkey(),
                will,
                token_mint: mint,
                token_vault: tv,
                ata,
                vault: anchor_spl::associated_token::get_associated_token_address(&will, &mint),
                token_program: anchor_spl::token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: vault_inheritance::instruction::DeleteToken {}.data(),
        },
    )
    .unwrap();
    assert_eq!(load::<Will>(&svm, &will).token_vault_count, 0);
    assert_eq!(token_balance(&svm, &ata), before + 500);
}

// ---- C3: a living owner can always undo a premature confirmation -------

#[test]
fn c3_owner_can_revoke_and_reuse_the_will() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
    assert_eq!(load::<Will>(&svm, &will).will_status, WillStatus::Claimable);

    // Pre-fix, the owner was locked out here forever. Now they can revoke.
    revoke(&mut svm, &program_id, &owner).unwrap();
    let w = load::<Will>(&svm, &will);
    assert_eq!(w.will_status, WillStatus::Active);
    assert_eq!(w.approvals_received, 0);
    assert_eq!(w.claimable_at, 0);
    assert_eq!(
        w.approval_epoch, 2,
        "epoch must advance to void old approvals"
    );

    // The will is fully usable again: the owner can ping and reconfigure.
    update_will(&mut svm, &program_id, &owner, Some(THRESHOLD * 2), None).unwrap();

    // The custodian's stale confirmation does not count any more, and because
    // revoking was proof of life they must wait out the switch all over again.
    svm.expire_blockhash();
    assert!(
        confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).is_err(),
        "the dead-man's switch must restart after a revocation"
    );

    // After genuine silence the same custodian may confirm again (new epoch).
    warp(&mut svm, THRESHOLD * 2 + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
    let w2 = load::<Will>(&svm, &will);
    assert_eq!(w2.will_status, WillStatus::Claimable);
    assert_eq!(w2.approvals_received, 1, "tally must not double-count");
}

#[test]
fn c3_revoke_expires_with_the_grace_period() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();

    // Once heirs may be mid-claim, unwinding is no longer safe.
    warp(&mut svm, GRACE + 1);
    let err = revoke(&mut svm, &program_id, &owner).unwrap_err();
    assert!(
        err.contains("6024") || err.contains("NothingToRevoke"),
        "expected NothingToRevoke, got {err}"
    );
}

#[test]
fn c3_nothing_can_be_claimed_during_the_grace_period() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let heir = fund(&mut svm);
    let ben = add_beneficiary(&mut svm, &program_id, &owner, &heir.pubkey(), 10_000).unwrap();
    let (mint, ata) = mint_with_balance(&mut svm, &owner, 10_000);
    escrow_token(&mut svm, &program_id, &owner, mint, ata, 10_000).unwrap();

    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();

    // Both claim paths are frozen while the owner may still revoke.
    assert!(claim(&mut svm, &program_id, &owner.pubkey(), &heir, ben).is_err());
    assert!(claim_token(&mut svm, &program_id, &owner.pubkey(), &heir, mint).is_err());

    // A revocation therefore costs the estate nothing.
    revoke(&mut svm, &program_id, &owner).unwrap();
    let heir_ata =
        anchor_spl::associated_token::get_associated_token_address(&heir.pubkey(), &mint);
    assert_eq!(token_balance(&svm, &heir_ata), 0);
}

// ---- H1: no asset may enter a will whose quorum is unreachable ---------

#[test]
fn h1_assets_rejected_while_quorum_is_unreachable() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    // Requires 3 approvals but has no custodians yet.
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 3).unwrap();
    let (mint, ata) = mint_with_balance(&mut svm, &owner, 5_000);

    // No custodians at all: neither tokens nor media may enter the will.
    assert!(escrow_token(&mut svm, &program_id, &owner, mint, ata, 1_000).is_err());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        add_media(&mut svm, &program_id, &owner, 0, [7u8; 64])
    }))
    .is_err());

    // Two custodians is still short of the three required.
    let c1 = fund(&mut svm);
    let c2 = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &c1.pubkey());
    add_custodian(&mut svm, &program_id, &owner, &c2.pubkey());
    svm.expire_blockhash();
    let err = escrow_token(&mut svm, &program_id, &owner, mint, ata, 1_000).unwrap_err();
    assert!(
        err.contains("6025") || err.contains("QuorumUnreachable"),
        "expected QuorumUnreachable, got {err}"
    );

    // The third custodian makes the quorum reachable and unblocks escrow.
    let c3 = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &c3.pubkey());
    svm.expire_blockhash();
    escrow_token(&mut svm, &program_id, &owner, mint, ata, 1_000).unwrap();
}

// ---- M2 + token math: proportional shares, then residual swept --------

#[test]
fn m2_shares_are_proportional_and_the_remainder_returns_to_the_estate() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    let cpda = add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());

    // Deliberately under-allocated: 50% + 25% leaves 25% unassigned.
    let h1 = fund(&mut svm);
    let h2 = fund(&mut svm);
    add_beneficiary(&mut svm, &program_id, &owner, &h1.pubkey(), 5_000).unwrap();
    add_beneficiary(&mut svm, &program_id, &owner, &h2.pubkey(), 2_500).unwrap();

    let escrowed: u64 = 1_000_000_003; // odd total, so floor-rounding leaves dust
    let (mint, ata) = mint_with_balance(&mut svm, &owner, escrowed);
    escrow_token(&mut svm, &program_id, &owner, mint, ata, escrowed).unwrap();

    warp(&mut svm, THRESHOLD + 1);
    confirm_death(&mut svm, &program_id, &owner.pubkey(), &cust, cpda).unwrap();
    warp(&mut svm, GRACE + 1);

    claim_token(&mut svm, &program_id, &owner.pubkey(), &h1, mint).unwrap();
    claim_token(&mut svm, &program_id, &owner.pubkey(), &h2, mint).unwrap();

    let a1 = anchor_spl::associated_token::get_associated_token_address(&h1.pubkey(), &mint);
    let a2 = anchor_spl::associated_token::get_associated_token_address(&h2.pubkey(), &mint);
    assert_eq!(token_balance(&svm, &a1), escrowed / 2);
    assert_eq!(token_balance(&svm, &a2), escrowed / 4);

    // Double-claim is rejected by the TokenClaim marker.
    svm.expire_blockhash();
    assert!(claim_token(&mut svm, &program_id, &owner.pubkey(), &h1, mint).is_err());

    let vault = anchor_spl::associated_token::get_associated_token_address(&will, &mint);
    let residual = token_balance(&svm, &vault);
    assert!(residual > 0, "unallocated 25% + dust should remain");

    // Before the claim window closes the sweep must not run.
    let cranker = fund(&mut svm);
    assert!(sweep_vault(&mut svm, &program_id, &owner.pubkey(), &cranker, mint).is_err());

    // After it closes, every last base unit returns to the estate wallet.
    warp(&mut svm, CLAIM_WINDOW + 1);
    let owner_before = token_balance(&svm, &ata);
    sweep_vault(&mut svm, &program_id, &owner.pubkey(), &cranker, mint).unwrap();
    assert_eq!(token_balance(&svm, &ata), owner_before + residual);
    assert_eq!(load::<Will>(&svm, &will).token_vault_count, 0);
    // Both the vault ATA and its metadata account are gone.
    assert!(svm
        .get_account(&vault)
        .map(|a| a.data.is_empty())
        .unwrap_or(true));
}

// ---- C5 (on-chain half): heirs own their encryption key ----------------

#[test]
fn c5_only_the_heir_can_register_their_encryption_key() {
    let Env {
        mut svm,
        program_id,
    } = setup();
    let owner = fund(&mut svm);
    let will = will_pda(&program_id, &owner.pubkey());
    init_will(&mut svm, &program_id, &owner, THRESHOLD, 1).unwrap();
    let cust = fund(&mut svm);
    add_custodian(&mut svm, &program_id, &owner, &cust.pubkey());
    let heir = fund(&mut svm);
    let ben = add_beneficiary(&mut svm, &program_id, &owner, &heir.pubkey(), 10_000).unwrap();

    assert_eq!(load::<Beneficiary>(&svm, &ben).encryption_pubkey, [0u8; 32]);

    let register = |svm: &mut LiteSVM, signer: &Keypair, key: [u8; 32]| {
        send(
            svm,
            signer,
            &[signer],
            Instruction {
                program_id,
                accounts: vault_inheritance::accounts::RegisterRecipientKey {
                    beneficiary_signer: signer.pubkey(),
                    will,
                    beneficiary: Pubkey::find_program_address(
                        &[BENEFICIARY_SEED, will.as_ref(), signer.pubkey().as_ref()],
                        &program_id,
                    )
                    .0,
                }
                .to_account_metas(None),
                data: vault_inheritance::instruction::RegisterRecipientKey {
                    encryption_pubkey: key,
                }
                .data(),
            },
        )
    };

    // An impostor cannot register a key they control against this heir's slot:
    // the beneficiary PDA is seeded by the signer, so they simply miss.
    let attacker = fund(&mut svm);
    assert!(register(&mut svm, &attacker, [9u8; 32]).is_err());

    // The heir registers their own key.
    register(&mut svm, &heir, [4u8; 32]).unwrap();
    assert_eq!(load::<Beneficiary>(&svm, &ben).encryption_pubkey, [4u8; 32]);

    // The all-zero sentinel is refused, so "registered" is never ambiguous.
    svm.expire_blockhash();
    assert!(register(&mut svm, &heir, [0u8; 32]).is_err());
}
