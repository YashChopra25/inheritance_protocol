import type { PublicKey } from "@solana/web3.js";
import type { RoleWill } from "./roles.types";

/**
 * One escrowed token as it reads to an heir on a claimable will.
 *
 * The heir's `myShare` is a fixed slice of `totalEscrowed`
 * (`totalEscrowed * allocation% `) — it does NOT shrink as other heirs claim.
 * `vaultBalance` is what is actually left in the vault right now.
 */
export interface InheritedTokenDisplay {
  tokenVault: PublicKey;
  tokenMint: PublicKey;
  symbol: string;
  name: string;
  decimals: number;
  /** Total ever escrowed for this mint (UI amount). */
  totalEscrowed: string;
  /** Currently remaining in the vault (UI amount). */
  vaultBalance: string;
  /** This heir's claimable slice of the snapshot (UI amount). */
  myShare: string;
  /** Whether this heir has already claimed this token. */
  claimed: boolean;
  /** Amount this heir already claimed (UI amount, "0" if not claimed). */
  claimedAmount: string;
}

/**
 * How a will reads to the heir looking at it.
 *
 * `active`   — the owner is still checking in.
 * `pending`  — some custodians have confirmed the passing, but not enough.
 * `unlocked` — quorum reached; the will is claimable and its media is shown.
 *
 * This mirrors `WillStatus` on-chain, but is named for what the heir sees
 * rather than for the lifecycle stage.
 */
export type LockState = "active" | "pending" | "unlocked";

export interface InheritanceSummary {
  will: RoleWill;
  lock: LockState;
  /** One line explaining why this will is open, or why it is not. */
  note: string;
}
