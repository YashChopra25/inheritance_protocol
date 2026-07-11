"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import { willStatusLabel } from "@/lib/utils";
import type { MyRoles, RoleWill } from "@/app/types/roles.types";

// On both child accounts the layout is: 8-byte discriminator, `will` pubkey (32),
// then the member `wallet` pubkey — so the wallet sits at offset 40.
const WALLET_OFFSET = 40;

const EMPTY: MyRoles = { beneficiaryWills: [], custodianWills: [] };

/**
 * Auto-loads every will the connected wallet participates in, split by role:
 * the wills where it is a beneficiary and the wills where it is a custodian.
 * Each entry is enriched with the will's owner and lifecycle status.
 */
export function useMyRoles() {
  const { program, publicKey } = useVault();
  const [data, setData] = useState<MyRoles>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) {
      setData(EMPTY);
      return;
    }
    setLoading(true);
    setError(null);
    const filter = [
      { memcmp: { offset: WALLET_OFFSET, bytes: publicKey.toBase58() } },
    ];
    try {
      const [beneficiaries, custodians] = await Promise.all([
        program.account.beneficiary.all(filter),
        program.account.custodian.all(filter),
      ]);

      // Fetch each referenced will once to read its owner + status.
      const willKeys = Array.from(
        new Set(
          [...beneficiaries, ...custodians].map((c) =>
            c.account.will.toBase58()
          )
        )
      ).map((s) => new PublicKey(s));
      const wills = await program.account.will.fetchMultiple(willKeys);
      const willMap = new Map(
        willKeys.map((k, i) => [k.toBase58(), wills[i]] as const)
      );

      const enrich = (
        will: PublicKey,
        extra: Partial<RoleWill>
      ): RoleWill | null => {
        const w = willMap.get(will.toBase58());
        if (!w) return null;
        return {
          willPubkey: will,
          owner: w.owner,
          status: willStatusLabel(w.willStatus),
          ...extra,
        };
      };

      setData({
        beneficiaryWills: beneficiaries
          .map((b) =>
            enrich(b.account.will, {
              allocationPercentage: b.account.allocationPercentage,
              hasClaimed: b.account.hasClaimed,
            })
          )
          .filter((w): w is RoleWill => w !== null),
        custodianWills: custodians
          .map((c) =>
            enrich(c.account.will, { hasApproved: c.account.hasApproved })
          )
          .filter((w): w is RoleWill => w !== null),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your wills");
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { data, loading, error, refresh: load };
}
