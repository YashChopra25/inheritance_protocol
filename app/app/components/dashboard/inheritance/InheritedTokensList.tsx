"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { RefreshCw } from "lucide-react";
import { InheritedTokenRow } from "./InheritedTokenRow";
import type { InheritedTokenDisplay } from "@/app/types/inheritance.types";

interface InheritedTokensListProps {
  owner: PublicKey;
  tokens: InheritedTokenDisplay[];
  loading: boolean;
  /** Load failure from `useInheritedTokens`; shown instead of an empty list. */
  error?: string | null;
  /** Whether `claim_token` would be accepted right now. */
  canClaim: boolean;
  refresh: () => void;
}

export const InheritedTokensList: FC<InheritedTokensListProps> = ({
  owner,
  tokens,
  loading,
  error,
  canClaim,
  refresh,
}) => {
  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-400">
        <span>Could not load escrowed tokens: {error}</span>
        <button onClick={refresh} disabled={loading} className="font-semibold underline">
          Retry
        </button>
      </div>
    );
  }
  if (tokens.length === 0) {
    if (loading) return <p className="text-xs text-muted">Loading escrowed tokens…</p>;
    return (
      <p className="text-xs text-muted">
        No tokens were escrowed on this will.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-black/10 p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Inherited tokens ({tokens.length})
        </h4>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh balances"
          aria-label="Refresh balances"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-muted">
        Your allocation percentage applies to these escrowed tokens only. Claim
        each one to transfer your share into your wallet.
      </p>
      <ul className="flex flex-col gap-2.5">
        {tokens.map((t) => (
          <InheritedTokenRow
            key={t.tokenVault.toBase58()}
            owner={owner}
            token={t}
            canClaim={canClaim}
            refresh={refresh}
          />
        ))}
      </ul>
    </div>
  );
};
