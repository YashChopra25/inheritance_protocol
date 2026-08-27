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
  // Beneficiary-specific
  allocationPercentage?: number;
  hasClaimed?: boolean;
  // Custodian-specific
  hasApproved?: boolean;
}

export interface MyRoles {
  beneficiaryWills: RoleWill[];
  custodianWills: RoleWill[];
}
