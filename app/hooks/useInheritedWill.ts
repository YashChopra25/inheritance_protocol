"use client";

import { useMemo } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useWill, type ProgramItem, type WillBundle } from "./useWill";
import { useParsedKey } from "./useParsedKey";
import { willStatusLabel } from "@/lib/utils";
import { claimTimeline, lockStateOf } from "@/lib/inheritance";
import { useNow } from "./useNow";
import type { BeneficiaryAccount } from "./useVault";
import type { ClaimTimeline, LockState } from "@/app/types/inheritance.types";

interface UseInheritedWillResult {
  owner: PublicKey | null;
  /** The address in the URL could not be parsed as a public key. */
  invalidOwner: boolean;
  data: WillBundle | null;
  /** The will PDA exists on-chain. */
  exists: boolean;
  lock: LockState | null;
  /**
   * Where the will sits on the post-death timeline. Null with no will. The
   * claim buttons key off `timeline.canClaimNow`, which mirrors the program's
   * `require_claims_open` guard exactly.
   */
  timeline: ClaimTimeline | null;
  me: PublicKey | null;
  myBeneficiary: ProgramItem<BeneficiaryAccount> | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads one will by its owner address and resolves the connected wallet's
 * standing on it as an heir. `myBeneficiary` is undefined when this wallet is
 * not named on the will at all.
 */
export function useInheritedWill(ownerStr: string): UseInheritedWillResult {
  const { publicKey } = useVault();
  const owner = useParsedKey(ownerStr);
  const { data, loading, error, refresh } = useWill(owner);
  // One-second tick: this page shows a live countdown to the next deadline.
  const now = useNow(1000);

  const will = data?.will ?? null;
  const status = will ? willStatusLabel(will.willStatus) : null;

  const timeline = useMemo(
    () =>
      will && status
        ? claimTimeline(status, will.claimableAt.toNumber(), now)
        : null,
    [will, status, now],
  );

  const myBeneficiary = useMemo(
    () =>
      data?.beneficiaries.find((b) => publicKey && b.account.wallet.equals(publicKey)),
    [data, publicKey]
  );

  return {
    owner,
    invalidOwner: ownerStr.length > 0 && owner === null,
    data,
    exists: will !== null,
    lock: status ? lockStateOf(status) : null,
    timeline,
    me: publicKey,
    myBeneficiary,
    loading,
    error,
    refresh,
  };
}
