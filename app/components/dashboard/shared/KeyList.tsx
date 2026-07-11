"use client";

import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { TxButton, short } from "./ui";

interface KeyListItem {
  key: string;
  wallet: PublicKey;
  badge?: string;
  badgeStyle?: "success" | "warn" | "neutral";
}

interface KeyListProps {
  items: KeyListItem[];
  onRemove: (wallet: PublicKey) => Promise<string>;
  refresh: () => void;
  empty: string;
  disabled?: boolean;
}

export const KeyList: FC<KeyListProps> = ({
  items,
  onRemove,
  refresh,
  empty,
  disabled,
}) => {
  if (items.length === 0) {
    return <p className="text-xs text-muted py-2">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li
          key={it.key}
          className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 px-3.5 py-2.5 text-xs transition-colors hover:bg-black/30"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-white/90">{short(it.wallet)}</span>
            {it.badge && (
              <span
                className={`rounded px-2 py-0.5 text-[9px] uppercase tracking-wide font-semibold ${
                  it.badgeStyle === "success"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                    : it.badgeStyle === "warn"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                    : "bg-white/10 text-white/85"
                }`}
              >
                {it.badge}
              </span>
            )}
          </div>
          <TxButton
            tone="ghost"
            action={() => onRemove(it.wallet)}
            onDone={refresh}
            disabled={disabled}
            title={disabled ? "Actions are only allowed when the will is active" : ""}
          >
            Remove
          </TxButton>
        </li>
      ))}
    </ul>
  );
};
