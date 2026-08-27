"use client";

import { FC } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { short } from "../shared/ui";
import { INHERITANCE_ROOT, LOCK_META } from "./inheritance.constants";
import type { InheritanceSummary } from "@/app/types/inheritance.types";

interface InheritanceCardProps {
  item: InheritanceSummary;
}

export const InheritanceCard: FC<InheritanceCardProps> = ({ item }) => {
  const { will, lock, note } = item;
  const meta = LOCK_META[lock];
  const Icon = meta.icon;
  const owner = will.owner.toBase58();

  return (
    <Link
      href={`${INHERITANCE_ROOT}/${owner}`}
      className="group flex items-center gap-4 rounded-xl border border-white/5 bg-black/20 p-4 transition-colors hover:border-white/15 hover:bg-black/30"
    >
      <Icon className={`size-4 shrink-0 ${meta.iconCls}`} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-white/85" title={owner}>
            {short(will.owner)}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${meta.pillCls}`}
          >
            {meta.label}
          </span>
          {will.hasClaimed && (
            <span className="rounded-full border border-(--neon)/30 bg-(--neon)/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neon">
              Claimed
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">{note}</p>

        <div className="flex flex-wrap gap-3 text-[10px] text-muted">
          {will.allocationPercentage !== undefined && (
            <span>Share: {will.allocationPercentage / 100}%</span>
          )}
          <span>
            {will.mediaCount} sealed {will.mediaCount === 1 ? "file" : "files"}
          </span>
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  );
};
