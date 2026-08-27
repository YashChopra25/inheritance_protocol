"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAta,
  resolveTokenProgram,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@/lib/anchor";
import type { TokenVaultDisplay } from "@/app/types/token.types";
import type { ProgramItem } from "./useWill";
import type { TokenVaultAccount } from "./useVault";

export interface UserTokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
}

const COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "wSOL", name: "Wrapped SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USDT", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXh3tRe6J3gBChcumHGg3bGz56": { symbol: "BONK", name: "Bonk Token", decimals: 5 },
};

/** Stable empty array so the derived "nothing to show" case never re-renders. */
const NONE: never[] = [];

export function useTokenBalances(
  tokenVaults: ProgramItem<TokenVaultAccount>[]
) {
  const { connection } = useConnection();
  const { publicKey: userWallet } = useWallet();
  const queryClient = useQueryClient();

  // Stable cache key: the vault set is identified by its account addresses, so
  // a re-rendered parent passing a fresh array does not refetch.
  const vaultKey = useMemo(
    () => tokenVaults.map((v) => v.publicKey.toBase58()).sort().join(","),
    [tokenVaults]
  );

  const fetchUserTokens = useCallback(async (): Promise<UserTokenInfo[]> => {
    if (!userWallet) return [];
    {
      // M7: a wallet's holdings can sit under either token program, so both are
      // queried. Listing only the legacy program hid every Token-2022 balance.
      const [legacy, token2022] = await Promise.all(
        [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
          connection
            .getParsedTokenAccountsByOwner(userWallet, { programId })
            .catch(() => ({ value: [] as never[] }))
        )
      );
      const tokens: UserTokenInfo[] = [...legacy.value, ...token2022.value]
        .map((item) => {
          const parsedInfo = item.account.data.parsed.info;
          const mint = parsedInfo.mint;
          const decimals = parsedInfo.tokenAmount.decimals;
          const balance = parsedInfo.tokenAmount.uiAmountString || "0";
          const common = COMMON_TOKENS[mint] || {
            symbol: mint.slice(0, 4).toUpperCase() + "…",
            name: "SPL Token",
          };
          return {
            mint,
            symbol: common.symbol,
            name: common.name,
            decimals,
            balance,
          };
        })
        .filter((t) => parseFloat(t.balance) > 0);
      return tokens;
    }
  }, [userWallet, connection]);

  const fetchVaultDisplays = useCallback(async (): Promise<
    TokenVaultDisplay[]
  > => {
    if (tokenVaults.length === 0) return [];
    {
      const displays: TokenVaultDisplay[] = await Promise.all(
        tokenVaults.map(async (v) => {
          const mintStr = v.account.tokenMint.toBase58();
          const info = COMMON_TOKENS[mintStr] || {
            symbol: mintStr.slice(0, 4).toUpperCase() + "…",
            name: "SPL Token",
            decimals: 9,
          };

          let decimals = info.decimals;
          try {
            const mintInfo = await connection.getParsedAccountInfo(v.account.tokenMint);
            const mintData = mintInfo.value?.data;
            const parsed =
              mintData && "parsed" in mintData ? mintData.parsed : null;
            if (parsed && parsed.type === "mint") {
              decimals = parsed.info.decimals;
            }
          } catch (e) {
            console.error("Failed to fetch mint decimals for", mintStr, e);
          }

          let vaultBalance = "0";
          try {
            const vaultBalRes = await connection.getTokenAccountBalance(v.account.vault);
            vaultBalance = vaultBalRes.value.uiAmountString ?? "0";
          } catch {
            // Vault ATA not initialized yet, or holds nothing.
          }

          let userBalance = "0";
          if (userWallet) {
            try {
              // M7: Token-2022 mints derive a different ATA, so ask the chain
              // which program owns this mint rather than assuming the legacy one.
              const tokenProgram = await resolveTokenProgram(
                connection,
                v.account.tokenMint
              );
              const userAta = getAta(userWallet, v.account.tokenMint, tokenProgram);
              const userBalRes = await connection.getTokenAccountBalance(userAta);
              userBalance = userBalRes.value.uiAmountString ?? "0";
            } catch {
              // The user has no ATA for this mint, or its balance is zero.
            }
          }

          return {
            publicKey: v.publicKey,
            tokenMint: v.account.tokenMint,
            vault: v.account.vault,
            ata: v.account.ata,
            symbol: info.symbol,
            name: info.name,
            decimals,
            vaultBalance,
            userBalance,
          };
        })
      );
      return displays;
    }
  }, [tokenVaults, userWallet, connection]);

  // React Query owns the fetch lifecycle. This replaces a hand-rolled
  // effect + loading-state pair that wrote state from the effect body
  // (react-hooks/set-state-in-effect), and it deduplicates the RPC traffic
  // these two queries generate when several components mount at once.
  const walletKey = userWallet?.toBase58() ?? null;

  const userTokensQuery = useQuery({
    queryKey: ["userTokens", walletKey],
    queryFn: fetchUserTokens,
    enabled: !!userWallet,
    staleTime: 30_000,
  });

  const vaultQuery = useQuery({
    queryKey: ["tokenVaultBalances", vaultKey, walletKey],
    queryFn: fetchVaultDisplays,
    enabled: tokenVaults.length > 0,
    staleTime: 30_000,
  });

  const refreshBalances = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["userTokens", walletKey] }),
      queryClient.invalidateQueries({
        queryKey: ["tokenVaultBalances", vaultKey, walletKey],
      }),
    ]);
  }, [queryClient, vaultKey, walletKey]);

  return {
    vaultDisplays: vaultQuery.data ?? NONE,
    userTokens: userTokensQuery.data ?? NONE,
    loading: userTokensQuery.isFetching || vaultQuery.isFetching,
    refreshBalances,
  };
}
