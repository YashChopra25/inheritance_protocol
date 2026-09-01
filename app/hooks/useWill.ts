"use client";

import { useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/hooks";
import { loadWill } from "@/app/store/willSlice";
import { selectWillEntry } from "@/app/store/selectors";

// Re-exported so the many components that already import these types from here
// keep working; the definitions now live next to the fetcher.
export type {
  ProgramItem,
  WillBundle,
  WillAccount,
  CustodianAccount,
  BeneficiaryAccount,
  MediaAccount,
  TokenVaultAccount,
} from "@/lib/willFetch";

/**
 * How long a loaded will is trusted before a mount will re-fetch it.
 *
 * Several components (the dashboard layout, the intervene panel, an inheritance
 * detail page) ask for the same owner's will. Without this they would each fire
 * their own `getProgramAccounts` sweep on mount. Mutations call `refresh()`
 * explicitly, so freshness after a write never depends on this window.
 */
const STALE_MS = 15_000;

/**
 * Loads a will (by its owner) and all of its child accounts into the Redux
 * store, and reads it back out. Pass `null` to load nothing.
 *
 * The bundle lives in `state.will.byOwner[owner]`, so every caller asking for
 * the same owner shares one copy and one fetch. `refresh()` re-reads it —
 * call it after any transaction that changes the will.
 */
export function useWill(owner: PublicKey | null) {
  const { program } = useVault();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const ownerKey = owner?.toBase58() ?? null;

  const entry = useAppSelector(selectWillEntry(ownerKey));

  const refresh = useCallback(async () => {
    if (!ownerKey) return;
    await dispatch(loadWill({ program, owner: new PublicKey(ownerKey) }));
  }, [dispatch, program, ownerKey]);

  useEffect(() => {
    if (!ownerKey) return;
    // Read the cache imperatively rather than depending on it, so landing a
    // result cannot re-trigger the effect that fetched it.
    const cached = store.getState().will.byOwner[ownerKey];
    if (cached?.status === "loading") return;
    if (
      cached?.status === "ready" &&
      cached.fetchedAt !== null &&
      Date.now() - cached.fetchedAt < STALE_MS
    ) {
      return;
    }
    dispatch(loadWill({ program, owner: new PublicKey(ownerKey) }));
  }, [dispatch, store, program, ownerKey]);

  return {
    data: entry.bundle,
    loading: entry.status === "loading",
    error: entry.error,
    refresh,
  };
}
