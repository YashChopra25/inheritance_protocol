"use client";

import { FC } from "react";
import { RoleWillCard } from "./RoleWillCard";
import type { RoleWill } from "@/app/types/roles.types";

interface RoleWillListProps {
  title: string;
  emptyLabel: string;
  loading: boolean;
  wills: RoleWill[];
  selectedOwner: string | null;
  onSelect: (owner: string) => void;
}

export const RoleWillList: FC<RoleWillListProps> = ({
  title,
  emptyLabel,
  loading,
  wills,
  selectedOwner,
  onSelect,
}) => {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl border border-white/5 bg-black/10 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
          {title}
        </h4>
        {!loading && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70">
            {wills.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted">
          <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-accent" />
          <span>Loading…</span>
        </div>
      ) : wills.length === 0 ? (
        <p className="py-2 text-xs text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {wills.map((w) => (
            <RoleWillCard
              key={w.willPubkey.toBase58()}
              will={w}
              selected={selectedOwner === w.owner.toBase58()}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
