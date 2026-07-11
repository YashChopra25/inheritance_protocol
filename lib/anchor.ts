import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import idl from "./idl/vault_inheritance.json";
import type { VaultInheritance } from "./idl/vault_inheritance";
import { PROGRAM_ID, SEEDS } from "./config";

export type VaultProgram = Program<VaultInheritance>;

/** Minimal wallet shape AnchorProvider needs (matches wallet-adapter's AnchorWallet). */
export interface SignerWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]>;
}

/** Build an Anchor Program bound to a connection + wallet. */
export function getProgram(
  connection: Connection,
  wallet: SignerWallet
): VaultProgram {
  const provider = new AnchorProvider(connection, wallet as unknown as Wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as VaultInheritance, provider);
}

/** Read-only program (no wallet) for fetching accounts. */
export function getReadonlyProgram(connection: Connection): VaultProgram {
  const dummy: SignerWallet = {
    publicKey: PublicKey.default,
    signTransaction: async <T,>(t: T) => t,
    signAllTransactions: async <T,>(t: T[]) => t,
  };
  const provider = new AnchorProvider(connection, dummy as unknown as Wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as VaultInheritance, provider);
}

// ---- PDA derivation (mirrors the on-chain seeds) ----

export function willPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.WILL, owner.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function custodianPda(will: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.CUSTODIAN, will.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function beneficiaryPda(will: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.BENEFICIARY, will.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function mediaPda(will: PublicKey, index: number): PublicKey {
  // `media_index` is a u16 on-chain, seeded as little-endian bytes
  // (`will.media_index.to_le_bytes()`), so it must be encoded as exactly 2 bytes
  // here — a single byte would derive the wrong PDA.
  const le = Uint8Array.from([index & 0xff, (index >> 8) & 0xff]);
  return PublicKey.findProgramAddressSync(
    [SEEDS.MEDIA, will.toBuffer(), le],
    PROGRAM_ID
  )[0];
}

export function tokenVaultPda(will: PublicKey, tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.TOKEN_VAULT, will.toBuffer(), tokenMint.toBuffer()],
    PROGRAM_ID
  )[0];
}

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export function getAta(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

// ---- Fixed-byte-array helpers for the contract's [u8; N] fields ----

/** Encode a UTF-8 string into a fixed-length byte array (zero-padded). */
export function strToFixedBytes(value: string, len: number): number[] {
  const bytes = new TextEncoder().encode(value);
  // if (bytes.length > len) {
  //   throw new Error(`Value "${value}" is ${bytes.length} bytes; max is ${len}`);
  // }
  const out = new Array<number>(len).fill(0);
  bytes.forEach((b, i) => (out[i] = b));
  return out;
}

/** Decode a fixed byte array back into a string, trimming trailing zero padding. */
export function fixedBytesToStr(bytes: number[] | Uint8Array): string {
  const arr = Array.from(bytes);
  let end = arr.length;
  while (end > 0 && arr[end - 1] === 0) end--;
  return new TextDecoder().decode(Uint8Array.from(arr.slice(0, end)));
}

/**
 * The on-chain `ipfs_cid` field is a fixed `[u8; 64]`, which fits both a CIDv0
 * (46-char base58, `Qm...`) and a CIDv1 (59-char base32, `bafy...`). The CID is
 * stored as zero-padded ASCII; `bytesToCid` trims the padding on the way out.
 */
export const CID_BYTE_LEN = 64;

export function cidToBytes(cid: string): number[] {
  if (cid.length === 0 || cid.length > CID_BYTE_LEN) {
    throw new Error(
      `CID must be 1..=${CID_BYTE_LEN} chars, got ${cid.length}: ${cid}`
    );
  }
  return strToFixedBytes(cid, CID_BYTE_LEN);
}

export function bytesToCid(bytes: number[] | Uint8Array): string {
  return fixedBytesToStr(bytes);
}

export { BN, PublicKey };
