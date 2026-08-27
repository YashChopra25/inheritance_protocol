"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "./useVault";
import type { VaultProgram } from "@/lib/anchor";
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
 * Like Anchor's `account.all(filter)`, but decodes each account on its own so a
 * single undecodable account can't take down the whole page.
 *
 * This matters after a struct grows: accounts written by an earlier version of
 * the program keep their old (smaller) size, and decoding one with the new
 * layout throws "Trying to access beyond buffer length". Anchor's `.all()`
 * decodes in one pass and rejects the entire batch; here the stale account is
 * skipped and logged instead.
 */
async function allTolerant<T>(
  program: VaultProgram,
  accountName: keyof VaultProgram["account"] & string,
  filters: { memcmp: { offset: number; bytes: string } }[],
): Promise<ProgramItem<T>[]> {
  const { connection } = program.provider;
  // `coder.accounts.memcmp()` returns the memcmp *body* (`{offset, bytes}`), not
  // a filter — it has to be wrapped in `{ memcmp: ... }` the way Anchor's own
  // `.all()` does. Passing it bare produced a filter object the RPC did not
  // recognise, so it returned every program account in the default base58
  // encoding and web3.js threw ("Expected a `Buffer` instance") — which blew up
  // the whole `load()` and left the dashboard showing no will at all.
  const raw = await connection.getProgramAccounts(program.programId, {
    filters: [
      { memcmp: program.coder.accounts.memcmp(accountName) },
      ...filters,
    ],
    encoding: "base64",
  });
  const out: ProgramItem<T>[] = [];
  for (const { pubkey, account } of raw) {
    try {
      out.push({
        publicKey: pubkey,
        account: program.coder.accounts.decode<T>(accountName, account.data),
      });
    } catch (e) {
      console.warn(
        `[useWill] skipping ${accountName} ${pubkey.toBase58()} — ` +
          `stale on-chain layout (${account.data.length} bytes): ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }
  return out;
}

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
      // `allTolerant` rather than Anchor's `.all()`: one account left on an
      // older layout would otherwise reject the entire batch and blank the
      // dashboard, instead of being skipped and logged.
      //
      // `allSettled`, not `all`: the will itself has already been fetched, so a
      // failing child query (RPC hiccup, rate limit) should degrade that one
      // list to empty rather than throw away a will we successfully read.
      const settled = await Promise.allSettled([
        allTolerant<MediaAccount>(program, "mediaReference", filter),
        allTolerant<CustodianAccount>(program, "custodian", filter),
        allTolerant<BeneficiaryAccount>(program, "beneficiary", filter),
        allTolerant<TokenVaultAccount>(program, "tokenVault", filter),
      ]);
      const names = ["media", "custodians", "beneficiaries", "tokenVaults"];
      const failures: string[] = [];
      const [media, custodians, beneficiaries, tokenVaults] = settled.map(
        (r, i) => {
          if (r.status === "fulfilled") return r.value;
          console.error(`[useWill] failed to load ${names[i]}:`, r.reason);
          failures.push(names[i]);
          return [];
        },
      ) as [
        ProgramItem<MediaAccount>[],
        ProgramItem<CustodianAccount>[],
        ProgramItem<BeneficiaryAccount>[],
        ProgramItem<TokenVaultAccount>[],
      ];
      setData({
        willPubkey: willKey,
        will: will as WillAccount,
        media,
        custodians,
        beneficiaries,
        tokenVaults,
      });
      setError(
        failures.length ? `Could not load: ${failures.join(", ")}` : null,
      );
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
