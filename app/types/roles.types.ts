import type { PublicKey } from "@solana/web3.js";

/** A will the connected wallet is attached to, in one of two roles. */
export interface RoleWill {
  willPubkey: PublicKey;
  owner: PublicKey;
  status: string;
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
