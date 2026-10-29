import { PublicKey } from "@solana/web3.js";
import type { VaultProgram } from "@/lib/anchor";
import { willStatusLabel } from "@/lib/utils";
import {
  allTolerant,
  type BeneficiaryAccount,
  type CustodianAccount,
  type WillAccount,
} from "@/lib/willFetch";
import type { MyRoles, RoleWill } from "@/app/types/roles.types";

// On both child accounts the layout is: 8-byte discriminator, `will` pubkey (32),
// then the member `wallet` pubkey — so the wallet sits at offset 40.
const WALLET_OFFSET = 40;

/** An all-zero key is the on-chain sentinel for "never registered". */
function hasPublishedKey(bytes: number[] | Uint8Array | undefined): boolean {
  if (!bytes) return false;
  const arr = Uint8Array.from(bytes);
  return arr.length === 32 && arr.some((b) => b !== 0);
}

export const EMPTY_ROLES: MyRoles = {
  beneficiaryWills: [],
  custodianWills: [],
};

/**
 * Every will the given wallet participates in, split by role: the wills where
 * it is a beneficiary and the wills where it is a custodian. Each entry is
 * enriched with the will's owner and lifecycle status so a list can render
 * quorum progress without a second round trip.
 */
export async function fetchMyRoles(
  program: VaultProgram,
  wallet: PublicKey,
): Promise<MyRoles> {
  const filter = [
    { memcmp: { offset: WALLET_OFFSET, bytes: wallet.toBase58() } },
  ];
  // Tolerant decoding (see `allTolerant`): one account left on an older layout
  // must not blank every role this wallet holds.
  const [beneficiaries, custodians] = await Promise.all([
    allTolerant<BeneficiaryAccount>(program, "beneficiary", filter),
    allTolerant<CustodianAccount>(program, "custodian", filter),
  ]);

  // Fetch each referenced will once to read its owner + status, decoding each
  // on its own for the same reason.
  const willKeys = Array.from(
    new Set(
      [...beneficiaries, ...custodians].map((c) => c.account.will.toBase58()),
    ),
  ).map((s) => new PublicKey(s));
  const infos = await program.provider.connection.getMultipleAccountsInfo(willKeys);
  const willMap = new Map<string, WillAccount>();
  infos.forEach((info, i) => {
    if (!info || !info.owner.equals(program.programId)) return;
    try {
      willMap.set(
        willKeys[i].toBase58(),
        program.coder.accounts.decode<WillAccount>("will", info.data),
      );
    } catch (e) {
      console.warn(
        `[rolesFetch] skipping will ${willKeys[i].toBase58()} — stale layout:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  });

  const enrich = (
    will: PublicKey,
    extra: Partial<RoleWill>,
  ): RoleWill | null => {
    const w = willMap.get(will.toBase58());
    if (!w) return null;
    return {
      willPubkey: will,
      owner: w.owner,
      status: willStatusLabel(w.willStatus),
      approvalsReceived: w.approvalsReceived,
      minApprovals: w.minApprovals,
      mediaCount: w.mediaCount,
      tokenVaultCount: w.tokenVaultCount,
      claimableAt: w.claimableAt.toNumber(),
      ...extra,
    };
  };

  return {
    beneficiaryWills: beneficiaries
      .map((b) =>
        enrich(b.account.will, {
          allocationPercentage: b.account.allocationPercentage,
          hasClaimed: b.account.hasClaimed,
          hasEncryptionKey: hasPublishedKey(b.account.encryptionPubkey),
        }),
      )
      .filter((w): w is RoleWill => w !== null),
    custodianWills: custodians
      .map((c) => {
        // A confirmation from a revoked round (older approval epoch) is void.
        const will = willMap.get(c.account.will.toBase58());
        return enrich(c.account.will, {
          hasApproved:
            c.account.hasApproved && c.account.approvedEpoch === will?.approvalEpoch,
        });
      })
      .filter((w): w is RoleWill => w !== null),
  };
}
