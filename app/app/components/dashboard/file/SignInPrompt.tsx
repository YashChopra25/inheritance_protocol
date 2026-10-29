"use client";

import { FC } from "react";
import { useVaultSession } from "@/hooks/useVaultSession";

/**
 * Inline prompt for the API session that document details need. Shown instead
 * of signing in automatically, so opening a page never springs a wallet popup.
 */
export const SignInPrompt: FC<{ what: string }> = ({ what }) => {
  const session = useVaultSession();
  if (session.signedIn || !session.wallet) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white/[0.02] px-3 py-2 text-[11px] text-muted">
      <span>Sign in with your wallet to load {what}.</span>
      <button
        type="button"
        onClick={() => void session.signIn().catch(() => undefined)}
        disabled={session.signingIn}
        className="h-7 rounded-lg px-3 text-[11px] font-semibold btn-primary disabled:opacity-50 cursor-pointer"
      >
        {session.signingIn ? "Waiting for wallet…" : "Sign in"}
      </button>
      {session.signInError && (
        <span role="alert" className="w-full text-[var(--danger)]">
          {session.signInError}
        </span>
      )}
    </div>
  );
};
