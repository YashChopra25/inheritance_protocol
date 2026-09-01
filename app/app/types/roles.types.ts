import type { PublicKey } from "@solana/web3.js";

/** A will the connected wallet is attached to, in one of two roles. */
export interface RoleWill {
  willPubkey: PublicKey;
  owner: PublicKey;
  status: string;
  // From the will itself, so a list can show quorum progress without refetching.
  approvalsReceived: number;
  minApprovals: number;
  mediaCount: number;
  /** How many token vaults are escrowed on the will. */
  tokenVaultCount: number;
  /**
   * Unix seconds at which custodian quorum was reached, or 0 if it never has
   * been. Both post-death deadlines are measured from here.
   */
  claimableAt: number;
  // Beneficiary-specific
  allocationPercentage?: number;
  hasClaimed?: boolean;
  /** Whether this heir has published an X25519 key documents can be sealed to. */
  hasEncryptionKey?: boolean;
  // Custodian-specific
  hasApproved?: boolean;
}

export interface MyRoles {
  beneficiaryWills: RoleWill[];
  custodianWills: RoleWill[];
}
