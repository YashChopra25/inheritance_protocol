"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { Archive } from "lucide-react";
import { useEstateTeardown } from "@/hooks/useEstateTeardown";
import type { WillBundle } from "@/hooks/useWill";

interface EstateTeardownCardProps {
  owner: PublicKey;
  data: WillBundle;
  refresh: () => Promise<void> | void;
}

/**
 * Shown once the heirs' claim window has closed. Anyone may run the teardown,
 * so an heir can settle the estate rather than leaving rent and residual
 * tokens stranded on-chain indefinitely. Render only in the `closed` phase.
 */
export const EstateTeardownCard: FC<EstateTeardownCardProps> = ({
  owner,
  data,
  refresh,
}) => {
  const { stepCount, done, busy, run } = useEstateTeardown(owner, data, refresh);
  if (stepCount === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-black/10 p-4">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="text-xs leading-relaxed text-muted">
          <p className="font-semibold text-foreground">Close out the estate</p>
          <p className="mt-1">
            The claim window has ended. Closing the estate returns any unclaimed
            tokens, rounding dust and account rent to the owner&apos;s wallet
            (the estate) and removes the will. Anyone may do this; you receive
            nothing and pay only network fees.
          </p>
          <p className="mt-1">
            This takes {stepCount} transaction{stepCount === 1 ? "" : "s"}, each
            approved in your wallet.
            {busy && ` ${done} of ${stepCount} done.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex h-9 w-fit items-center justify-center rounded-lg border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? "Closing…" : "Close out estate"}
      </button>
    </div>
  );
};
