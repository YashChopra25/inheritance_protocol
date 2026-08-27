"use client";

import { useMemo } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useWill, type ProgramItem, type WillBundle } from "./useWill";
import { useParsedKey } from "./useParsedKey";
import { willStatusLabel } from "@/lib/utils";
import { lockStateOf } from "@/lib/inheritance";
import type { BeneficiaryAccount } from "./useVault";
import type { LockState } from "@/app/types/inheritance.types";

interface UseInheritedWillResult {
  owner: PublicKey | null;
  /** The address in the URL could not be parsed as a public key. */
  invalidOwner: boolean;
  data: WillBundle | null;
  /** The will PDA exists on-chain. */
  exists: boolean;
  lock: LockState | null;
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

  const will = data?.will ?? null;

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
    lock: will ? lockStateOf(willStatusLabel(will.willStatus)) : null,
    me: publicKey,
    myBeneficiary,
    loading,
    error,
    refresh,
  };
}
