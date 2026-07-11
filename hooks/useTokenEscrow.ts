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
  const [mintDecimals, setMintDecimals] = useState<number | null>(null);
  const [mintSymbol, setMintSymbol] = useState<string | null>(null);
  const [isValidMint, setIsValidMint] = useState(false);
  const [checkingMint, setCheckingMint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSig, setSuccessSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mintAddress) {
      setIsValidMint(false);
      setMintDecimals(null);
      setMintSymbol(null);
      setError(null);
      return;
    }

    let active = true;
    const checkMint = async () => {
      setCheckingMint(true);
      setError(null);
      try {
        const pubkey = new PublicKey(mintAddress);

        // Check common tokens first
        const common = COMMON_TOKENS[pubkey.toBase58()];
        if (common) {
          if (active) {
            setMintDecimals(common.decimals);
            setMintSymbol(common.symbol);
            setIsValidMint(true);
          }
          return;
        }

        const info = await connection.getParsedAccountInfo(pubkey);
        if (!info.value) {
          throw new Error("Account does not exist on-chain");
        }

        const parsed = (info.value.data as any)?.parsed;
        if (parsed && parsed.type === "mint") {
          if (active) {
            setMintDecimals(parsed.info.decimals);
            setMintSymbol("Custom SPL");
            setIsValidMint(true);
          }
        } else {
          throw new Error("Address is not a token mint account");
        }
      } catch (e) {
        if (active) {
          setIsValidMint(false);
          setMintDecimals(null);
          setMintSymbol(null);
          setError(e instanceof Error ? e.message : "Invalid mint address");
        }
      } finally {
        if (active) setCheckingMint(false);
      }
    };

    checkMint();
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
  }, [mintAddress, amount, mintDecimals, isValidMint, addToken, refresh]);

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