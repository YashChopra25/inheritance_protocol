"use client";

import { useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/hooks";
import { loadMyRoles } from "@/app/store/rolesSlice";
import type { MyRoles } from "@/app/types/roles.types";

/** How long a loaded roles list is trusted before a mount re-fetches it. */
const STALE_MS = 15_000;

interface UseMyRolesResult {
  data: MyRoles;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Auto-loads every will the connected wallet participates in, split by role:
 * the wills where it is a beneficiary and the wills where it is a custodian.
 * The result lives in the Redux store, so the intervene panel and the
 * inheritance list share one fetch.
 */
export function useMyRoles(): UseMyRolesResult {
  const { program, publicKey } = useVault();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const wallet = publicKey?.toBase58() ?? null;

  const { data, status, error } = useAppSelector((s) => s.roles);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    await dispatch(loadMyRoles({ program, wallet: new PublicKey(wallet) }));
  }, [dispatch, program, wallet]);

  // Several components on one page use this hook; only the first mount should
  // fetch. Read the cache imperatively so a landing result cannot re-trigger
  // the effect that fetched it. `refresh()` always re-reads.
  useEffect(() => {
    if (!wallet) return;
    const cached = store.getState().roles;
    if (cached.wallet === wallet) {
      if (cached.status === "loading") return;
      if (
        cached.status === "ready" &&
        cached.fetchedAt !== null &&
        Date.now() - cached.fetchedAt < STALE_MS
      ) {
        return;
      }
    }
    dispatch(loadMyRoles({ program, wallet: new PublicKey(wallet) }));
  }, [dispatch, store, program, wallet]);

  return { data, loading: status === "loading", error, refresh };
}
