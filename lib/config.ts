import { PublicKey } from "@solana/web3.js";

/** Public, client-safe configuration. */
// Must match the program's `declare_id!` (and the deploy keypair). Override per
// environment via NEXT_PUBLIC_PROGRAM_ID if you redeploy to a different address.
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "Gh2DEa9dE9rNS79Ts2YvFZ8j3ZJ5ADEQh3KTNFbx32Za",
);

export const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta"
  | "testnet"
  | "localnet";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? "https://api.devnet.solana.com";

/** Gateway used to read pinned files back from IPFS. */
export const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY?.trim() || "gateway.pinata.cloud";

export function ipfsUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}

/** PDA seeds — must match the on-chain program constants. Uint8Array avoids
 *  relying on a global `Buffer`, which isn't present in the browser. */
const enc = new TextEncoder();
export const SEEDS = {
  WILL: enc.encode("will"),
  CUSTODIAN: enc.encode("custodian"),
  BENEFICIARY: enc.encode("beneficiary"),
  MEDIA: enc.encode("mediareference"),
  TOKEN_VAULT: enc.encode("tokenvault"),
};

export const MAX_ALLOCATION_BPS = 10_000;

console.log(
  "PROGRAM_ID",
  PROGRAM_ID.toBase58(),
  "CLUSTER",
  CLUSTER,
  "RPC_ENDPOINT",
  RPC_ENDPOINT,
);
