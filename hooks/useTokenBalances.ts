"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAta, TOKEN_PROGRAM_ID } from "@/lib/anchor";
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

export function useTokenBalances(
  tokenVaults: ProgramItem<TokenVaultAccount>[],
  willOwner: PublicKey | null
) {
  const { connection } = useConnection();
  const { publicKey: userWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [vaultDisplays, setVaultDisplays] = useState<TokenVaultDisplay[]>([]);
  const [userTokens, setUserTokens] = useState<UserTokenInfo[]>([]);
  const [loadingUserTokens, setLoadingUserTokens] = useState(false);

  const fetchUserTokens = useCallback(async () => {
    if (!userWallet) {
      setUserTokens([]);
      return;
    }
    setLoadingUserTokens(true);
    try {
      const res = await connection.getParsedTokenAccountsByOwner(userWallet, {
        programId: TOKEN_PROGRAM_ID,
      });
      const tokens: UserTokenInfo[] = res.value
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
      setUserTokens(tokens);
    } catch (e) {
      console.error("Error fetching user wallet tokens:", e);
    } finally {
      setLoadingUserTokens(false);
    }
  }, [userWallet, connection]);

  const fetchBalances = useCallback(async () => {
    await fetchUserTokens();
    if (tokenVaults.length === 0) {
      setVaultDisplays([]);
      return;
    }
    setLoading(true);
    try {
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
            const parsed = (mintInfo.value?.data as any)?.parsed;
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
          } catch (e) {
            // Not initialized or empty balance
          }

          let userBalance = "0";
          if (userWallet) {
            try {
              const userAta = getAta(userWallet, v.account.tokenMint);
              const userBalRes = await connection.getTokenAccountBalance(userAta);
              userBalance = userBalRes.value.uiAmountString ?? "0";
            } catch (e) {
              // User doesn't have ATA or zero balance
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
      setVaultDisplays(displays);
    } catch (e) {
      console.error("Error fetching token balances:", e);
    } finally {
      setLoading(false);
    }
  }, [tokenVaults, userWallet, connection, fetchUserTokens]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    vaultDisplays,
    userTokens,
    loading: loading || loadingUserTokens,
    refreshBalances: fetchBalances,
  };
}
