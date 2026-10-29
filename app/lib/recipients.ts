import type { PublicKey } from "@solana/web3.js";
import type { Recipient } from "./crypto";

/** The slice of a Beneficiary account sealing needs. */
export interface HeirKeyInfo {
  account: { wallet: PublicKey; encryptionPubkey: number[] | Uint8Array };
}

/** An all-zero key means the heir has not registered one yet. */
export function hasEncryptionKey(
  bytes: number[] | Uint8Array | undefined
): boolean {
  if (!bytes) return false;
  const arr = Uint8Array.from(bytes);
  return arr.length === 32 && arr.some((b) => b !== 0);
}

/** Heirs who cannot be sealed to yet, as base58 wallets. */
export function heirsWithoutKey(heirs: HeirKeyInfo[]): string[] {
  return heirs
    .filter((b) => !hasEncryptionKey(b.account.encryptionPubkey))
    .map((b) => b.account.wallet.toBase58());
}

/** The owner plus every heir who has published a key. */
export function recipientsFor(
  ownerWallet: string,
  ownerKey: Uint8Array,
  heirs: HeirKeyInfo[]
): Recipient[] {
  return [
    { wallet: ownerWallet, encryptionPublicKey: ownerKey },
    ...heirs
      .filter((b) => hasEncryptionKey(b.account.encryptionPubkey))
      .map((b) => ({
        wallet: b.account.wallet.toBase58(),
        encryptionPublicKey: Uint8Array.from(b.account.encryptionPubkey),
      })),
  ];
}
