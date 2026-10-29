/**
 * Compute-budget instructions for every transaction the app sends.
 *
 * Without a compute-unit price a transaction competes at the base fee only,
 * and under any congestion it simply never lands — the wallet shows "sent",
 * the blockhash expires, and the user retries an action that may or may not
 * have gone through. Pricing from recent fees on the accounts the transaction
 * actually writes keeps it competitive without overpaying on a quiet cluster.
 */

import {
  ComputeBudgetProgram,
  type Connection,
  type PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";

/** micro-lamports per compute unit. */
const MIN_PRICE = 1_000;
const MAX_PRICE = 200_000;
/** Used whenever the RPC cannot answer (unsupported method, rate limit, …). */
const DEFAULT_PRICE = 10_000;
/** Which percentile of recent fees to bid at. */
const PERCENTILE = 0.75;
const CACHE_MS = 15_000;

/** Compute-unit limits, sized with headroom over measured usage. */
export const CU = {
  /** Instructions touching only program accounts (will, custodian, …). */
  SIMPLE: 100_000,
  /** Token CPIs, ATA creation, Token-2022 — the heavier paths. */
  TOKEN: 300_000,
  /** Wrap SOL + escrow in one transaction. */
  WRAP_AND_ESCROW: 400_000,
} as const;

const cache = new Map<string, { price: number; at: number }>();

function clamp(n: number): number {
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, Math.round(n)));
}

/**
 * A compute-unit price from recent prioritization fees on `writable`. Never
 * throws: any RPC failure falls back to `DEFAULT_PRICE`.
 */
export async function getPriorityFee(
  connection: Connection,
  writable: PublicKey[],
): Promise<number> {
  const key = writable
    .map((k) => k.toBase58())
    .sort()
    .join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.price;

  let price = DEFAULT_PRICE;
  try {
    const recent = await connection.getRecentPrioritizationFees({
      // The RPC accepts at most 128 accounts.
      lockedWritableAccounts: writable.slice(0, 128),
    });
    const fees = recent
      .map((f) => f.prioritizationFee)
      .sort((a, b) => a - b);
    if (fees.length > 0) {
      price = clamp(fees[Math.min(fees.length - 1, Math.floor(fees.length * PERCENTILE))]);
    }
  } catch {
    // Fall through to the default; a fee estimate must never block a send.
  }
  cache.set(key, { price, at: Date.now() });
  return price;
}

/**
 * `setComputeUnitLimit` + `setComputeUnitPrice`, ready for Anchor's
 * `.preInstructions(...)`.
 */
export async function computeBudgetIxs(
  connection: Connection,
  writable: PublicKey[],
  units: number = CU.SIMPLE,
): Promise<TransactionInstruction[]> {
  const microLamports = await getPriorityFee(connection, writable);
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  ];
}
