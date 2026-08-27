/**
 * Devnet smoke test for the freshly deployed program.
 *
 * LiteSVM proves the logic; this proves the DEPLOYED artifact — real IDL, real
 * account layouts, real runtime — actually works. It walks the full owner-side
 * lifecycle and asserts the two new on-chain guarantees that were added in this
 * pass, then tears everything down so no rent is left behind.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const { AnchorProvider, Program, BN } = anchor;

const RPC = "https://api.devnet.solana.com";
const here = path.dirname(fileURLToPath(import.meta.url));
const IDL_PATH = path.resolve(here, "../../target/idl/vault_inheritance.json");
// Same keypair `anchor deploy` uses, unless overridden.
const KEY_PATH =
  process.env.SOLANA_KEYPAIR ?? path.join(os.homedir(), ".config/solana/id.json");

const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
const secret = Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, "utf8")));
const payer = Keypair.fromSecretKey(secret);

const connection = new Connection(RPC, "confirmed");
const wallet = {
  publicKey: payer.publicKey,
  signTransaction: async (tx) => {
    tx.sign(payer);
    return tx;
  },
  signAllTransactions: async (txs) => txs.map((t) => (t.sign(payer), t)),
  payer,
};
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
const program = new Program(idl, provider);

const PROGRAM_ID = new PublicKey(idl.address);
const enc = new TextEncoder();
const seed = (s) => enc.encode(s);

const willPda = (owner) =>
  PublicKey.findProgramAddressSync(
    [seed("will"), owner.toBuffer()],
    PROGRAM_ID
  )[0];
const custodianPda = (will, w) =>
  PublicKey.findProgramAddressSync(
    [seed("custodian"), will.toBuffer(), w.toBuffer()],
    PROGRAM_ID
  )[0];
const beneficiaryPda = (will, w) =>
  PublicKey.findProgramAddressSync(
    [seed("beneficiary"), will.toBuffer(), w.toBuffer()],
    PROGRAM_ID
  )[0];
const mediaPda = (will, i) =>
  PublicKey.findProgramAddressSync(
    [
      seed("mediareference"),
      will.toBuffer(),
      Uint8Array.from([i & 0xff, (i >> 8) & 0xff]),
    ],
    PROGRAM_ID
  )[0];

let pass = 0;
let fail = 0;
const ok = (msg) => {
  pass++;
  console.log(`  PASS  ${msg}`);
};
const bad = (msg, err) => {
  fail++;
  console.log(`  FAIL  ${msg}${err ? `\n        ${err}` : ""}`);
};
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

const cid = (text) => {
  const out = new Array(64).fill(0);
  enc.encode(text).forEach((b, i) => (out[i] = b));
  return out;
};
const mediaType = (text) => {
  const out = new Array(16).fill(0);
  enc.encode(text).forEach((b, i) => (out[i] = b));
  return out;
};

console.log(`\nProgram : ${PROGRAM_ID.toBase58()}`);
console.log(`Owner   : ${payer.publicKey.toBase58()}`);
console.log(`Cluster : devnet\n`);

const will = willPda(payer.publicKey);

// Leave no state behind from an interrupted earlier run.
const existing = await program.account.will.fetchNullable(will);
if (existing) {
  console.log("Found a leftover will from a previous run; removing it first.\n");
  try {
    await program.methods
      .deleteWill()
      .accountsPartial({
        owner: payer.publicKey,
        will,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch (e) {
    console.log(`  (could not clean up: ${e.message})`);
  }
}

console.log("1. initialise_will");
await program.methods
  .initialiseWill(new BN(3600), 2)
  .accountsPartial({
    owner: payer.publicKey,
    will,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
let w = await program.account.will.fetch(will);
check(w.minApprovals === 2, "will created with min_approvals = 2");
check(
  Number(w.claimableAt) === 0,
  "claimable_at initialises to 0 (new field present on-chain)"
);
check(
  w.approvalEpoch === 1,
  "approval_epoch starts at 1 (new field present on-chain)"
);
check(
  w.tokenVaultCount === 0,
  "token_vault_count starts at 0 (new field present on-chain)"
);

console.log("\n2. H1 — assets must be refused while quorum is unreachable");
try {
  await program.methods
    .addMediaReference(mediaType("application/vseal"), cid("QmSmokeTestCid"))
    .accountsPartial({
      owner: payer.publicKey,
      will,
      mediaReference: mediaPda(will, 0),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  bad("add_media_reference should have been rejected (0 custodians, needs 2)");
} catch (e) {
  const m = String(e);
  check(
    m.includes("QuorumUnreachable") || m.includes("6025"),
    "add_media_reference rejected with QuorumUnreachable"
  );
}

console.log("\n3. add_custodian x2, then media is accepted");
const c1 = Keypair.generate().publicKey;
const c2 = Keypair.generate().publicKey;
for (const c of [c1, c2]) {
  await program.methods
    .addCustodian()
    .accountsPartial({
      owner: payer.publicKey,
      will,
      custodian: custodianPda(will, c),
      walletKey: c,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
w = await program.account.will.fetch(will);
check(w.custodianCount === 2, "custodian_count = 2");

await program.methods
  .addMediaReference(mediaType("application/vseal"), cid("QmSmokeTestCid"))
  .accountsPartial({
    owner: payer.publicKey,
    will,
    mediaReference: mediaPda(will, 0),
    systemProgram: SystemProgram.programId,
  })
  .rpc();
const media = await program.account.mediaReference.fetch(mediaPda(will, 0));
check(
  Buffer.from(media.ipfsCid).toString("utf8").replace(/\0+$/, "") ===
    "QmSmokeTestCid",
  "media reference stored once quorum is reachable"
);

console.log("\n4. add_beneficiary + register_recipient_key (new instruction)");
const ben = beneficiaryPda(will, payer.publicKey);
await program.methods
  .addBeneficiary(10000)
  .accountsPartial({
    owner: payer.publicKey,
    will,
    beneficiary: ben,
    walletKey: payer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
let b = await program.account.beneficiary.fetch(ben);
check(
  Uint8Array.from(b.encryptionPubkey).every((x) => x === 0),
  "beneficiary starts with no encryption key registered"
);

const encKey = Array.from({ length: 32 }, (_, i) => (i + 7) % 256);
await program.methods
  .registerRecipientKey(encKey)
  .accountsPartial({
    beneficiarySigner: payer.publicKey,
    will,
    beneficiary: ben,
  })
  .rpc();
b = await program.account.beneficiary.fetch(ben);
check(
  Array.from(b.encryptionPubkey).join(",") === encKey.join(","),
  "register_recipient_key stored the X25519 public key on-chain"
);

console.log("\n5. C3 — nothing to revoke while the will is Active");
try {
  await program.methods
    .revokeDeathConfirmation()
    .accountsPartial({ owner: payer.publicKey, will })
    .rpc();
  bad("revoke_death_confirmation should be rejected on an Active will");
} catch (e) {
  const m = String(e);
  check(
    m.includes("NothingToRevoke") || m.includes("6024"),
    "revoke_death_confirmation rejected with NothingToRevoke"
  );
}

console.log("\n6. C2 — teardown, and rent returns to the owner");
const before = await connection.getBalance(payer.publicKey);

await program.methods
  .removeMediaReference(0)
  .accountsPartial({
    owner: payer.publicKey,
    will,
    mediaReference: mediaPda(will, 0),
  })
  .rpc();
await program.methods
  .removeBeneficiary()
  .accountsPartial({
    owner: payer.publicKey,
    will,
    beneficiary: ben,
    walletKey: payer.publicKey,
  })
  .rpc();
// min_approvals is 2, so it must be lowered before custodians can be removed.
await program.methods
  .updateWill(null, 1)
  .accountsPartial({ owner: payer.publicKey, will })
  .rpc();
for (const c of [c1, c2]) {
  await program.methods
    .removeCustodian()
    .accountsPartial({
      owner: payer.publicKey,
      will,
      custodian: custodianPda(will, c),
      walletKey: c,
    })
    .rpc();
}
w = await program.account.will.fetch(will);
check(
  w.mediaCount === 0 && w.custodianCount === 0 && w.beneficiaryCount === 0,
  "all children reclaimed"
);

await program.methods
  .deleteWill()
  .accountsPartial({
    owner: payer.publicKey,
    will,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
const gone = await program.account.will.fetchNullable(will);
check(gone === null, "will closed");

const after = await connection.getBalance(payer.publicKey);
check(
  after > before,
  `rent refunded to the owner (+${((after - before) / 1e9).toFixed(6)} SOL net of fees)`
);

console.log(`\n${"=".repeat(46)}`);
console.log(`Devnet smoke test: ${pass} passed, ${fail} failed`);
console.log(`${"=".repeat(46)}\n`);
process.exit(fail === 0 ? 0 : 1);
