"use client";

import { useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import {
  deriveRecipientKeypair,
  type RecipientKeypair,
} from "@/lib/crypto";

/**
 * Two wallet-derived capabilities the app needs, kept separate on purpose.
 *
 * **Session** (C4) authenticates the caller to our API: a signed challenge in
 * exchange for an HttpOnly cookie. It proves "this wallet is here right now".
 *
 * **Identity** (C5) is the X25519 keypair that unseals documents. It never
 * leaves the browser and the server never sees it. It proves "this wallet can
 * decrypt".
 *
 * Neither is derived from the other, and a compromised session cannot yield the
 * identity — which is the property that makes the encryption meaningful.
 */

// ---- API session -------------------------------------------------------

async function fetchSession(): Promise<string | null> {
  const res = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!res.ok) return null;
  const json = await res.json();
  return json.wallet ?? null;
}

export function useVaultSession() {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();
  const wallet = publicKey?.toBase58() ?? null;

  const sessionQuery = useQuery({
    queryKey: ["authSession"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });

  /** True when the cookie belongs to the wallet currently connected. */
  const signedIn = !!wallet && sessionQuery.data === wallet;

  const signIn = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("Connect a wallet first");
      if (!signMessage) {
        throw new Error(
          "This wallet cannot sign messages, which is required to sign in."
        );
      }

      const challengeRes = await fetch(
        `/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`,
        { credentials: "same-origin" }
      );
      if (!challengeRes.ok) {
        const { error } = await challengeRes.json().catch(() => ({}));
        throw new Error(error ?? "Could not start sign-in");
      }
      const { message, token } = await challengeRes.json();

      const signature = await signMessage(new TextEncoder().encode(message));

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          wallet,
          message,
          signature: bs58.encode(signature),
        }),
      });
      if (!verifyRes.ok) {
        const { error } = await verifyRes.json().catch(() => ({}));
        throw new Error(error ?? "Sign-in failed");
      }
      return wallet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authSession"] });
    },
  });

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    await queryClient.invalidateQueries({ queryKey: ["authSession"] });
  }, [queryClient]);

  return {
    wallet,
    signedIn,
    checking: sessionQuery.isLoading,
    signIn: signIn.mutateAsync,
    signingIn: signIn.isPending,
    signInError: signIn.error instanceof Error ? signIn.error.message : null,
    signOut,
  };
}

// ---- document identity (X25519) ----------------------------------------

/**
 * In-memory cache of the derived identity, keyed by wallet.
 *
 * Deliberately NOT persisted: writing a decryption key to localStorage would
 * hand it to any script that ever runs on this origin, which is the failure
 * this whole design exists to avoid. The cost is one wallet signature per
 * page load, which is the right trade for an inheritance vault.
 */
const identityCache = new Map<string, RecipientKeypair>();

export function useVaultIdentity() {
  const { publicKey, signMessage } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const cached = wallet ? identityCache.get(wallet) ?? null : null;

  const unlock = useCallback(async (): Promise<RecipientKeypair> => {
    if (!wallet) throw new Error("Connect a wallet first");
    const existing = identityCache.get(wallet);
    if (existing) return existing;
    if (!signMessage) {
      throw new Error(
        "This wallet cannot sign messages, which is required to unseal documents."
      );
    }
    const identity = await deriveRecipientKeypair(signMessage);
    identityCache.set(wallet, identity);
    return identity;
  }, [wallet, signMessage]);

  /** Forget the in-memory key — call on disconnect. */
  const lock = useCallback(() => {
    if (wallet) identityCache.delete(wallet);
  }, [wallet]);

  return useMemo(
    () => ({ wallet, identity: cached, unlocked: !!cached, unlock, lock }),
    [wallet, cached, unlock, lock]
  );
}
