import { PublicKey } from "@solana/web3.js";

/** Public, client-safe configuration. */

/**
 * Program address.
 *
 * No fallback (M6): the previous default pointed at a stale address, so any
 * environment missing the variable silently talked to the wrong program and
 * every account lookup came back empty with no error. Failing at startup is the
 * only safe behaviour for a value this consequential.
 */
function requiredProgramId(): PublicKey {
  const raw = process.env.NEXT_PUBLIC_PROGRAM_ID?.trim();
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_PROGRAM_ID is not set. Refusing to guess a program address."
    );
  }
  try {
    return new PublicKey(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_PROGRAM_ID is not a valid address: ${raw}`);
  }
}

export const PROGRAM_ID = requiredProgramId();

export type Cluster = "devnet" | "mainnet-beta" | "testnet" | "localnet";

export const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim() ??
  "devnet") as Cluster;

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim() ??
  "https://api.devnet.solana.com";

/**
 * The cluster label and the RPC endpoint have to agree (M6). They previously
 * did not — `localnet` was paired with a devnet URL — which made every
 * explorer link in the UI point at the wrong network.
 */
function assertClusterMatchesEndpoint() {
  const host = RPC_ENDPOINT.toLowerCase();
  const isLocal = host.includes("127.0.0.1") || host.includes("localhost");
  const expected: Cluster | null = isLocal
    ? "localnet"
    : host.includes("devnet")
      ? "devnet"
      : host.includes("testnet")
        ? "testnet"
        : host.includes("mainnet")
          ? "mainnet-beta"
          : null; // a private RPC we cannot classify — trust the label

  if (expected && expected !== CLUSTER) {
    throw new Error(
      `Configuration mismatch: NEXT_PUBLIC_SOLANA_CLUSTER is "${CLUSTER}" but ` +
        `NEXT_PUBLIC_RPC_ENDPOINT points at ${expected}. Fix one of them.`
    );
  }
}
assertClusterMatchesEndpoint();

/** PDA seeds — must match the on-chain program constants. Uint8Array avoids
 *  relying on a global `Buffer`, which isn't present in the browser. */
const enc = new TextEncoder();
export const SEEDS = {
  WILL: enc.encode("will"),
  CUSTODIAN: enc.encode("custodian"),
  BENEFICIARY: enc.encode("beneficiary"),
  MEDIA: enc.encode("mediareference"),
  TOKEN_VAULT: enc.encode("tokenvault"),
  TOKEN_CLAIM: enc.encode("tokenclaim"),
};

export const MAX_ALLOCATION_BPS = 10_000;

/**
 * Post-death timeline. MUST match `constants.rs` — the UI uses these to render
 * countdowns and to disable actions the program would reject anyway, and the API
 * uses `GRACE_PERIOD_SECONDS` to decide when an heir may read documents.
 */
export const GRACE_PERIOD_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const CLAIM_WINDOW_SECONDS = 90 * 24 * 60 * 60; // 90 days

/**
 * On-chain `ipfs_cid` is a fixed `[u8; 64]`, which fits both a CIDv0 (46-char
 * base58, `Qm...`) and a CIDv1 (base32, `b...`).
 */
export const CID_BYTE_LEN = 64;

/** Explorer link for the configured cluster. */
export function explorerUrl(address: string, kind: "address" | "tx" = "address") {
  const suffix =
    CLUSTER === "mainnet-beta"
      ? ""
      : CLUSTER === "localnet"
        ? `?cluster=custom&customUrl=${encodeURIComponent(RPC_ENDPOINT)}`
        : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/${kind}/${address}${suffix}`;
}
