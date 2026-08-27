"use client";

import { FC } from "react";
import { Inbox } from "lucide-react";
import { useInheritance } from "@/hooks/useInheritance";
import { InheritanceCard } from "./InheritanceCard";

export const InheritanceList: FC = () => {
  const { items, unlockedCount, loading, error } = useInheritance();

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted">
        <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-accent" />
        <span>Searching Solana for wills that name you…</span>
      </div>
    );
  }

  if (error) {
    return <p className="py-4 font-mono text-xs text-red-400">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-black/10 py-10 text-center">
        <Inbox className="size-5 text-muted" />
        <p className="text-xs font-semibold text-white">No wills name you as an heir</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted">
          When someone adds your wallet as a beneficiary, their will appears here
          automatically — no invitation to accept.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Wills naming your wallet as an heir. Sealed files open once custodians
          confirm the owner&apos;s passing.
        </p>
        {unlockedCount > 0 && (
          <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-400">
            {unlockedCount} open
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <InheritanceCard key={item.will.willPubkey.toBase58()} item={item} />
        ))}
      </div>
    </div>
  );
};
