"use client";

import { useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { loadMyRoles } from "@/app/store/rolesSlice";
import type { MyRoles } from "@/app/types/roles.types";

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
  const wallet = publicKey?.toBase58() ?? null;

  const { data, status, error } = useAppSelector((s) => s.roles);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    await dispatch(loadMyRoles({ program, wallet: new PublicKey(wallet) }));
  }, [dispatch, program, wallet]);

  useEffect(() => {
    if (!wallet) return;
    dispatch(loadMyRoles({ program, wallet: new PublicKey(wallet) }));
  }, [dispatch, program, wallet]);

  return { data, loading: status === "loading", error, refresh };
}
