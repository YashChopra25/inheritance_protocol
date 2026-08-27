"use client";

import { useState, useEffect, useCallback } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVault } from "./useVault";
import { tokenClaimPda } from "@/lib/anchor";
import { tokenMeta, formatUnits } from "@/lib/tokens";
import { MAX_ALLOCATION_BPS } from "@/lib/config";
import type { ProgramItem } from "./useWill";
import type { TokenVaultAccount } from "./useVault";
import type { InheritedTokenDisplay } from "@/app/types/inheritance.types";

interface UseInheritedTokensResult {
  tokenDisplays: InheritedTokenDisplay[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resolves what an heir can see and claim from a will's escrowed tokens: for
 * each token vault it reads the mint decimals, the live vault balance, computes
 * this heir's fixed share (`total_amount * allocation_bps / 10000`), and checks
 * whether the heir's `TokenClaim` PDA already exists (i.e. already claimed).
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

  // No state is written synchronously in here: the effect below calls `load`
  // directly, and a setState in an effect body causes a cascading re-render
  // (react-hooks/set-state-in-effect). Everything is written after the awaits.
  const idle = tokenVaults.length === 0 || !beneficiary;

  const load = useCallback(async () => {
    if (idle) return;
    try {
      const bps = BigInt(allocationBps ?? 0);
      const rows = await Promise.all(
        tokenVaults.map(async (v) => {
          const mintStr = v.account.tokenMint.toBase58();
          const meta = tokenMeta(mintStr);

          let decimals = meta.decimals;
          try {
            const mi = await connection.getParsedAccountInfo(v.account.tokenMint);
            const parsed = (mi.value?.data as unknown as { parsed?: { type: string; info: { decimals: number } } })?.parsed;
            if (parsed?.type === "mint") decimals = parsed.info.decimals;
          } catch {
            /* keep fallback decimals */
          }

          let vaultBalance = "0";
          try {
            const b = await connection.getTokenAccountBalance(v.account.vault);
            vaultBalance = b.value.uiAmountString ?? "0";
          } catch {
            /* vault empty or uninitialized */
          }

          const total = BigInt(v.account.totalAmount.toString());
          const shareRaw = (total * bps) / BigInt(MAX_ALLOCATION_BPS);

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
      setTokenDisplays(rows);
    } finally {
      setLoading(false);
    }
  }, [idle, tokenVaults, allocationBps, beneficiary, connection, program]);

  useEffect(() => {
    // `load` writes no state synchronously, and the idle case is derived below
    // rather than written here — so this effect never triggers a cascading
    // re-render (react-hooks/set-state-in-effect).
    load();
  }, [load]);

  return {
    // Derived, not stored: with no vaults or no beneficiary there is simply
    // nothing to show, and any result left over from a previous input is stale.
    tokenDisplays: idle ? NONE : tokenDisplays,
    loading: idle ? false : loading,
    refresh: load,
  };
}
