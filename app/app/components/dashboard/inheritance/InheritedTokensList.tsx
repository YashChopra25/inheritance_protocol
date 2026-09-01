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
  /** Whether `claim_token` would be accepted right now. */
  canClaim: boolean;
  refresh: () => void;
}

export const InheritedTokensList: FC<InheritedTokensListProps> = ({
  owner,
  tokens,
  loading,
  canClaim,
  refresh,
}) => {
  if (tokens.length === 0) {
    return (
      <p className="text-xs text-muted">
        No tokens were escrowed on this will.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
          Inherited tokens ({tokens.length})
        </h4>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh balances"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-white"
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
