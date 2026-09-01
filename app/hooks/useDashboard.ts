"use client";

import { useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { loadWill } from "@/app/store/willSlice";
import {
  selectMyWillEntry,
  selectMyWillIsActive,
  selectMyWillReadiness,
  selectMyWillStatus,
} from "@/app/store/selectors";
import type { WillBundle } from "@/lib/willFetch";
import type { WillReadiness } from "@/lib/willReadiness";

export interface DashboardState {
  /** The connected wallet's will and its children; null before the first load. */
  data: WillBundle | null;
  loading: boolean;
  error: string | null;
  /** Re-read the will from chain — call after any transaction. */
  refresh: () => Promise<void>;
  vault: ReturnType<typeof useVault>;
  /** `"active" | "pendingInheritance" | "claimable"`, or null with no will. */
  status: string | null;
  /** Only an Active will accepts owner mutations. */
  isActive: boolean;
  /** Which setup steps are still outstanding before assets may be added. */
  readiness: WillReadiness;
}

/**
 * Everything a dashboard page needs about the connected wallet's will, read
 * straight from the Redux store.
 *
 * This replaced a React context that was threaded down from the dashboard
 * layout: the data now has a single home in `state.will`, so a component can
 * read it without the layout having to hand it down.
 */
export function useDashboard(): DashboardState {
  const vault = useVault();
  const dispatch = useAppDispatch();

  const entry = useAppSelector(selectMyWillEntry);
  const owner = useAppSelector((s) => s.will.connectedOwner);
  const status = useAppSelector(selectMyWillStatus);
  const isActive = useAppSelector(selectMyWillIsActive);
  const readiness = useAppSelector(selectMyWillReadiness);

  const refresh = useCallback(async () => {
    if (!owner) return;
    await dispatch(
      loadWill({ program: vault.program, owner: new PublicKey(owner) }),
    );
  }, [dispatch, vault.program, owner]);

  return {
    data: entry.bundle,
    loading: entry.status === "loading",
    error: entry.error,
    refresh,
    vault,
    status,
    isActive,
    readiness,
  };
}
