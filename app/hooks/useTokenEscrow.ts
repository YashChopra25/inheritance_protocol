"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { BN, NATIVE_MINT, tokenVaultPda, willPda } from "@/lib/anchor";
import { humanizeError, isUncertainTxError, txSignatureOf } from "@/lib/utils";
import {
  fetchMintInfo,
  isKnownToken,
  mintRisks,
  parseUnits,
  tokenMeta,
} from "@/lib/tokens";
import { useVault } from "./useVault";

import type { UserTokenInfo } from "./useTokenBalances";

const NATIVE_MINT_STR = NATIVE_MINT.toBase58();
const SOL_DECIMALS = 9;
/**
 * SOL kept back when wrapping: rent for the wSOL account, the will's vault and
 * its TokenVault record on a first deposit, plus fees. Comfortably above what
 * a single deposit costs.
 */
const SOL_RESERVE_LAMPORTS = BigInt(10_000_000);
/** How long to keep looking for a deposit whose confirmation timed out. */
const LANDED_CHECKS = 4;
const LANDED_GAP_MS = 2_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface EscrowSuccess {
  /** Null when the deposit was found on-chain but its signature was not known. */
  sig: string | null;
  /** True when confirmation timed out and the deposit was verified by re-reading the vault. */
  recovered: boolean;
}

/**
 * State and submit logic for the token escrow form.
 *
 * `add_token` ACCUMULATES into `total_amount`, so it is not idempotent: a
 * deposit whose confirmation timed out may have landed, and a blind retry
 * would escrow twice. The vault's recorded total is snapshotted before
 * sending; on an uncertain error it is re-read, and if it grew by the amount
 * the deposit is reported as the success it was.
 *
 * Selecting the native mint escrows SOL: whatever the owner's existing wSOL
 * does not cover is wrapped in the same transaction.
 */
export function useTokenEscrow(
  refresh: () => void,
  userTokens: UserTokenInfo[],
  solLamports: number | null,
) {
  const { connection } = useConnection();
  const { addToken, escrowNativeSol, program, publicKey } = useVault();
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
    warnings: string[];
    severe: string[];
    error: string | null;
  } | null>(null);
  const [checkingMint, setCheckingMint] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** The mint whose severe risks the owner ticked "I understand" for. */
  const [ackMint, setAckMint] = useState<string | null>(null);

  // Only a probe for the address currently in the box counts.
  const probe = mintProbe?.mint === mintAddress ? mintProbe : null;
  const mintDecimals = probe?.decimals ?? null;
  const mintSymbol = probe?.symbol ?? null;
  const isValidMint = probe?.valid ?? false;
  const mintWarnings = probe?.warnings ?? [];
  const mintSevere = probe?.severe ?? [];
  const severeAcknowledged = mintSevere.length === 0 || ackMint === mintAddress;
  const acknowledgeSevere = useCallback(
    (ok: boolean) => setAckMint(ok ? mintAddress : null),
    [mintAddress],
  );
  const error = submitError ?? probe?.error ?? null;
  const setError = setSubmitError;
  const [success, setSuccess] = useState<EscrowSuccess | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isNative = mintAddress === NATIVE_MINT_STR;
  const wsolRaw = BigInt(
    userTokens.find((t) => t.mint === NATIVE_MINT_STR)?.rawBalance ?? "0",
  );

  /**
   * For native SOL: how many lamports of the entered amount must be wrapped
   * (the owner's existing wSOL is used first). Null when not applicable or the
   * amount does not parse yet.
   */
  let wrapLamports: bigint | null = null;
  if (isNative && amount) {
    try {
      const raw = parseUnits(amount, SOL_DECIMALS);
      wrapLamports = raw > wsolRaw ? raw - wsolRaw : BigInt(0);
    } catch {
      wrapLamports = null;
    }
  }

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
        // Every mint — well-known or not — is read from the chain: decimals
        // come from the mint itself, and a mainnet address on devnet fails
        // here instead of in the transaction.
        const info = await fetchMintInfo(connection, pubkey);
        const { blocking, severe, warnings } = mintRisks(info);
        const mint = pubkey.toBase58();
        record({
          decimals: info.decimals,
          symbol: isKnownToken(mint) ? tokenMeta(mint).symbol : "Custom SPL",
          valid: blocking.length === 0,
          warnings,
          severe,
          error: blocking[0] ? `${blocking[0]} It cannot be escrowed safely.` : null,
        });
      } catch (e) {
        record({
          decimals: null,
          symbol: null,
          valid: false,
          warnings: [],
          severe: [],
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

  /** The vault's recorded `total_amount` for `mint`; 0 when no vault exists yet. */
  const readEscrowedTotal = useCallback(
    async (mint: PublicKey): Promise<bigint> => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const tv = await program.account.tokenVault.fetchNullable(
        tokenVaultPda(willPda(publicKey), mint),
        "confirmed",
      );
      return tv ? BigInt(tv.totalAmount.toString()) : BigInt(0);
    },
    [program, publicKey],
  );

  /** Whether the recorded total has grown by at least `raw` since `before`. */
  const depositLanded = useCallback(
    async (mint: PublicKey, before: bigint, raw: bigint) => {
      for (let i = 0; i < LANDED_CHECKS; i++) {
        if (i > 0) await sleep(LANDED_GAP_MS);
        try {
          if ((await readEscrowedTotal(mint)) >= before + raw) return true;
        } catch {
          /* transient read failure — try again */
        }
      }
      return false;
    },
    [readEscrowedTotal],
  );

  const submitEscrow = useCallback(async () => {
    if (!isValidMint || !mintAddress || !amount || mintDecimals === null) {
      setError("Please fill out all fields correctly");
      return;
    }
    if (!severeAcknowledged) {
      setError("Confirm that you understand this token's risks first");
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    let uncertain = false;
    try {
      const mintPubKey = new PublicKey(mintAddress);
      const rawAmount = parseUnits(amount, mintDecimals);
      if (rawAmount <= BigInt(0)) {
        throw new Error("Amount must be greater than zero");
      }

      let wrap = BigInt(0);
      if (isNative) {
        wrap = rawAmount > wsolRaw ? rawAmount - wsolRaw : BigInt(0);
        if (
          wrap > BigInt(0) &&
          solLamports !== null &&
          wrap + SOL_RESERVE_LAMPORTS > BigInt(solLamports)
        ) {
          throw new Error(
            "Insufficient SOL. Keep about 0.01 SOL aside for rent and fees.",
          );
        }
      } else {
        // Compared in raw base units, so the check is exact at any size.
        const tokenInfo = userTokens.find((t) => t.mint === mintAddress);
        if (tokenInfo && rawAmount > BigInt(tokenInfo.rawBalance)) {
          throw new Error(
            `Insufficient balance. You have ${tokenInfo.balance} ${tokenInfo.symbol}`,
          );
        }
      }

      // Snapshot before sending; null if it could not be read, in which case a
      // timed-out deposit cannot be verified and is reported as uncertain.
      const before = await readEscrowedTotal(mintPubKey).catch(() => null);

      let result: EscrowSuccess;
      try {
        const sig = isNative
          ? await escrowNativeSol(
            new BN(rawAmount.toString()),
            new BN(wrap.toString()),
          )
          : await addToken(mintPubKey, new BN(rawAmount.toString()));
        result = { sig, recovered: false };
      } catch (e) {
        if (!isUncertainTxError(e)) throw e;
        uncertain = true;
        if (before === null || !(await depositLanded(mintPubKey, before, rawAmount))) {
          // An expired blockhash can never land later, so once the vault has
          // been re-read and shows no deposit, a retry is known to be safe.
          const expired =
            e instanceof Error &&
            (e.name === "TransactionExpiredBlockheightExceededError" ||
              /block height exceeded/i.test(e.message));
          if (expired && before !== null) {
            throw new Error(
              "The transaction expired before it was confirmed and nothing was deposited. It is safe to try again.",
            );
          }
          throw e;
        }
        result = { sig: txSignatureOf(e), recovered: true };
        toast.success(
          "Deposit confirmed — the network was slow to confirm, but the tokens are in the vault. Do not resend.",
        );
      }

      setSuccess(result);
      setMintAddress("");
      setAmount("");
      refresh();
    } catch (e) {
      setError(humanizeError(e));
      // Whatever happened, show the vault as it really is now.
      if (uncertain) refresh();
    } finally {
      setSubmitting(false);
    }
  }, [
    mintAddress,
    amount,
    mintDecimals,
    isValidMint,
    severeAcknowledged,
    isNative,
    wsolRaw,
    solLamports,
    addToken,
    escrowNativeSol,
    readEscrowedTotal,
    depositLanded,
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
    mintWarnings,
    mintSevere,
    severeAcknowledged,
    acknowledgeSevere,
    isValidMint,
    isNative,
    wrapLamports,
    checkingMint,
    error,
    success,
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
