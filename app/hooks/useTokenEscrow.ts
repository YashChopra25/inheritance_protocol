"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@/lib/anchor";
import { humanizeError } from "@/lib/utils";

const COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "wSOL", name: "Wrapped SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USDT", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXh3tRe6J3gBChcumHGg3bGz56": { symbol: "BONK", name: "Bonk Token", decimals: 5 },
};

import type { UserTokenInfo } from "./useTokenBalances";

export function useTokenEscrow(
  addToken: (mint: PublicKey, amount: BN) => Promise<string>,
  refresh: () => void,
  userTokens: UserTokenInfo[],
) {
  const { connection } = useConnection();
  const [mintAddress, setMintAddress] = useState("");
  const [amount, setAmount] = useState("");
  /**
   * Result of the last completed mint lookup, tagged with the address it was
   * for. Tagging lets the reset-on-change be DERIVED during render instead of
   * written from an effect: a stale result is simply ignored. That is the React
   * idiom for adjusting state when an input changes, and it is what keeps this
   * hook free of setState-in-effect cascades.
   */
  const [mintProbe, setMintProbe] = useState<{
    mint: string;
    decimals: number | null;
    symbol: string | null;
    valid: boolean;
    error: string | null;
  } | null>(null);
  const [checkingMint, setCheckingMint] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only a probe for the address currently in the box counts.
  const probe = mintProbe?.mint === mintAddress ? mintProbe : null;
  const mintDecimals = probe?.decimals ?? null;
  const mintSymbol = probe?.symbol ?? null;
  const isValidMint = probe?.valid ?? false;
  const error = submitError ?? probe?.error ?? null;
  const setError = setSubmitError;
  const [successSig, setSuccessSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Nothing is set synchronously here; the empty-input case needs no write at
    // all because `probe` above already derives the reset.
    if (!mintAddress) return;

    let active = true;
    const record = (
      next: Omit<NonNullable<typeof mintProbe>, "mint">
    ) => {
      if (active) setMintProbe({ mint: mintAddress, ...next });
    };

    const checkMint = async () => {
      try {
        const pubkey = new PublicKey(mintAddress);

        // Well-known mints skip the round trip.
        const common = COMMON_TOKENS[pubkey.toBase58()];
        if (common) {
          record({
            decimals: common.decimals,
            symbol: common.symbol,
            valid: true,
            error: null,
          });
          return;
        }

        const info = await connection.getParsedAccountInfo(pubkey);
        if (!info.value) {
          throw new Error("No account exists at that address");
        }

        // `data` is a Buffer for raw accounts and a ParsedAccountData for
        // parsed ones; only the latter carries `parsed`.
        const data = info.value.data;
        const parsed = "parsed" in data ? data.parsed : null;
        if (!parsed || parsed.type !== "mint") {
          throw new Error("That address is not a token mint");
        }
        record({
          decimals: parsed.info.decimals,
          symbol: "Custom SPL",
          valid: true,
          error: null,
        });
      } catch (e) {
        record({
          decimals: null,
          symbol: null,
          valid: false,
          error: e instanceof Error ? e.message : "Invalid mint address",
        });
      } finally {
        if (active) setCheckingMint(false);
      }
    };

    // Flip the spinner on a microtask so the effect body itself stays free of
    // state writes, then run the lookup.
    void Promise.resolve().then(() => {
      if (active) setCheckingMint(true);
      return checkMint();
    });

    return () => {
      active = false;
    };
  }, [mintAddress, connection]);

  const submitEscrow = useCallback(async () => {
    if (!isValidMint || !mintAddress || !amount || mintDecimals === null) {
      setError("Please fill out all fields correctly");
      return;
    }
    setError(null);
    setSuccessSig(null);
    setSubmitting(true);
    try {
      const mintPubKey = new PublicKey(mintAddress);
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      // Check balance
      const tokenInfo = userTokens.find((t) => t.mint === mintAddress);
      if (tokenInfo && parsedAmount > parseFloat(tokenInfo.balance)) {
        throw new Error(
          `Insufficient balance. You have ${tokenInfo.balance} ${tokenInfo.symbol}`,
        );
      }

      const rawAmount = new BN(
        Math.round(parsedAmount * Math.pow(10, mintDecimals)).toString(),
      );

      const sig = await addToken(mintPubKey, rawAmount);
      setSuccessSig(sig);
      setMintAddress("");
      setAmount("");
      refresh();
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    mintAddress,
    amount,
    mintDecimals,
    isValidMint,
    addToken,
    refresh,
    setError,
    userTokens,
  ]);

  return {
    mintAddress,
    setMintAddress,
    amount,
    setAmount,
    mintSymbol,
    mintDecimals,
    isValidMint,
    checkingMint,
    error,
    successSig,
    submitting,
    submitEscrow,
  };
}

export function useTokenEscrowRemove(
  removeToken: (mint: PublicKey) => Promise<string>,
  refresh: () => void,
) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSig, setSuccessSig] = useState<string | null>(null);

  const submitRemove = useCallback(
    async (mintAddress: string) => {
      setError(null);
      setSuccessSig(null);
      setRemoving(true);
      try {
        const mintPubKey = new PublicKey(mintAddress);
        const sig = await removeToken(mintPubKey);
        setSuccessSig(sig);
        refresh();
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        setRemoving(false);
      }
    },
    [removeToken, refresh],
  );

  return {
    removing,
    error,
    successSig,
    submitRemove,
  };
} 