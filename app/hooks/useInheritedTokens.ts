"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVault } from "./useVault";
import { tokenClaimPda } from "@/lib/anchor";
import { tokenMeta, formatUnits, fetchMintInfo } from "@/lib/tokens";
import { MAX_ALLOCATION_BPS } from "@/lib/config";
import type { ProgramItem } from "./useWill";
import type { TokenVaultAccount } from "./useVault";
import type { InheritedTokenDisplay } from "@/app/types/inheritance.types";

interface UseInheritedTokensResult {
  tokenDisplays: InheritedTokenDisplay[];
  loading: boolean;
  /** Set when the vaults could not be read; rows are then not shown at all
   *  rather than shown with guessed decimals. */
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Resolves what an heir can see and claim from a will's escrowed tokens: for
 * each token vault it reads the mint decimals, the live vault balance, computes
 * this heir's share exactly as `claim_token` will pay it —
 * `min(total_amount * allocation_bps / 10000, vault.amount)` — and checks
 * whether the heir's `TokenClaim` PDA already exists (i.e. already claimed).
 *
 * Only the newest load may write state: an older one resolving late (inputs
 * changed, or the component unmounted) is discarded.
 */
/** Stable empty array so the derived "nothing to show" case never re-renders. */
const NONE: never[] = [];

export function useInheritedTokens(
  tokenVaults: ProgramItem<TokenVaultAccount>[],
  allocationBps: number | undefined,
  beneficiary: PublicKey | null
): UseInheritedTokensResult {
  const { connection } = useConnection();
  const { program } = useVault();
  const [tokenDisplays, setTokenDisplays] = useState<InheritedTokenDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumped per load and on cleanup; a load only commits if it is still current. */
  const latest = useRef({ id: 0 });

  // No state is written synchronously in here: a setState in an effect body
  // causes a cascading re-render (react-hooks/set-state-in-effect), so every
  // write happens after the rows have settled.
  const idle = tokenVaults.length === 0 || !beneficiary;

  const load = useCallback(async () => {
    if (idle) return;
    const tracker = latest.current;
    const id = ++tracker.id;
    const fetchRows = async () => {
      const bps = BigInt(allocationBps ?? 0);
      const rows = await Promise.all(
        tokenVaults.map(async (v) => {
          const mintStr = v.account.tokenMint.toBase58();
          const meta = tokenMeta(mintStr);

          // Always the mint's real decimals — no guessed fallback, since a
          // wrong value would misstate the heir's share by orders of magnitude.
          const { decimals } = await fetchMintInfo(connection, v.account.tokenMint);

          let vaultBalance = "0";
          let vaultRaw = BigInt(0);
          try {
            const b = await connection.getTokenAccountBalance(v.account.vault);
            vaultBalance = b.value.uiAmountString ?? "0";
            vaultRaw = BigInt(b.value.amount);
          } catch {
            /* vault empty or uninitialized */
          }

          const total = BigInt(v.account.totalAmount.toString());
          // Same clamp as `claim_token_handler`: a fee-on-transfer mint or
          // earlier claims can leave the vault holding less than the
          // recorded total, and the program never pays more than it holds.
          const entitled = (total * bps) / BigInt(MAX_ALLOCATION_BPS);
          const shareRaw = entitled < vaultRaw ? entitled : vaultRaw;

          let claimed = false;
          let claimedAmount = "0";
          try {
            const claim = await program.account.tokenClaim.fetchNullable(
              tokenClaimPda(v.publicKey, beneficiary)
            );
            if (claim) {
              claimed = true;
              claimedAmount = formatUnits(BigInt(claim.amount.toString()), decimals);
            }
          } catch {
            /* no claim yet */
          }

          return {
            tokenVault: v.publicKey,
            tokenMint: v.account.tokenMint,
            symbol: meta.symbol,
            name: meta.name,
            decimals,
            totalEscrowed: formatUnits(total, decimals),
            vaultBalance,
            myShare: formatUnits(shareRaw, decimals),
            claimed,
            claimedAmount,
          };
        })
      );
      return rows;
    };
    // Settled before any write, so every setState below runs after an await.
    const result = await fetchRows().then(
      (rows) => ({ rows, failure: null }),
      (e: unknown) => ({
        rows: null,
        failure:
          e instanceof Error ? e.message : "Could not load the escrowed tokens",
      })
    );
    // Superseded by a newer load, or unmounted: drop the result.
    if (id !== tracker.id) return;
    if (result.rows) setTokenDisplays(result.rows);
    setError(result.failure);
    setLoading(false);
  }, [idle, tokenVaults, allocationBps, beneficiary, connection, program]);

  useEffect(() => {
    // Started on a microtask (as in `useTokenEscrow`) so the effect body itself
    // never writes state; the idle case is derived below rather than written
    // here — so this effect never triggers a cascading re-render
    // (react-hooks/set-state-in-effect).
    void Promise.resolve().then(load);
    const tracker = latest.current;
    return () => {
      tracker.id++;
    };
  }, [load]);

  // Manual refreshes show the spinner; the initial load already starts with
  // `loading` true, so the effect above never has to write it.
  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  return {
    // Derived, not stored: with no vaults or no beneficiary there is simply
    // nothing to show, and any result left over from a previous input is stale.
    tokenDisplays: idle ? NONE : tokenDisplays,
    loading: idle ? false : loading,
    error: idle ? null : error,
    refresh,
  };
}
