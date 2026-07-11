"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import type {
  WillAccount,
  CustodianAccount,
  BeneficiaryAccount,
  MediaAccount,
  TokenVaultAccount,
} from "./useVault";

export type ProgramItem<T> = { publicKey: PublicKey; account: T };

export interface WillBundle {
  willPubkey: PublicKey;
  will: WillAccount | null;
  media: ProgramItem<MediaAccount>[];
  custodians: ProgramItem<CustodianAccount>[];
  beneficiaries: ProgramItem<BeneficiaryAccount>[];
  tokenVaults: ProgramItem<TokenVaultAccount>[];
}

// `will` is the first field after the 8-byte discriminator on every child account.
const WILL_OFFSET = 8;

/**
 * Loads a will (by its owner) and all of its child accounts. Pass `null` to
 * load nothing. Returns a `refresh()` to re-fetch after a mutation.
 */
export function useWill(owner: PublicKey | null) {
  const { program, willPda } = useVault();
  const [data, setData] = useState<WillBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const willKey = willPda(owner);
    try {
      const will = await program.account.will.fetchNullable(willKey);
      if (!will) {
        setData({
          willPubkey: willKey,
          will: null,
          media: [],
          custodians: [],
          beneficiaries: [],
          tokenVaults: [],
        });
        return;
      }
      const filter = [
        { memcmp: { offset: WILL_OFFSET, bytes: willKey.toBase58() } },
      ];
      const [media, custodians, beneficiaries, tokenVaults] = await Promise.all([
        program.account.mediaReference.all(filter),
        program.account.custodian.all(filter),
        program.account.beneficiary.all(filter),
        program.account.tokenVault.all(filter),
      ]);
      setData({
        willPubkey: willKey,
        will: will as WillAccount,
        media: media as ProgramItem<MediaAccount>[],
        custodians: custodians as ProgramItem<CustodianAccount>[],
        beneficiaries: beneficiaries as ProgramItem<BeneficiaryAccount>[],
        tokenVaults: tokenVaults as ProgramItem<TokenVaultAccount>[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load will");
    } finally {
      setLoading(false);
    }
  }, [owner, program, willPda]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { data, loading, error, refresh: load };
}
