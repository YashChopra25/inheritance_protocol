"use client";

import { FC } from "react";
import { Coins, Check } from "lucide-react";
import type { UserTokenInfo } from "@/hooks/useTokenBalances";
import { NATIVE_MINT } from "@/lib/anchor";
import { formatUnits } from "@/lib/tokens";

const NATIVE_MINT_STR = NATIVE_MINT.toBase58();

interface UserTokenListProps {
  userTokens: UserTokenInfo[];
  /** Native SOL balance in lamports; null until loaded. */
  solLamports: number | null;
  onSelect: (mint: string) => void;
  selectedMint: string;
}

export const UserTokenList: FC<UserTokenListProps> = ({
  userTokens: allTokens,
  solLamports,
  onSelect,
  selectedMint,
}) => {
  // Native SOL and an existing wSOL balance are one choice: selecting either
  // escrows the native mint, wrapping only what the wSOL balance lacks.
  const wsol = allTokens.find((t) => t.mint === NATIVE_MINT_STR);
  const solRow: UserTokenInfo | null =
    solLamports && solLamports > 0
      ? {
        mint: NATIVE_MINT_STR,
        symbol: "SOL",
        name: "Native SOL (escrowed as wSOL)",
        decimals: 9,
        balance:
          formatUnits(BigInt(solLamports), 9) +
          (wsol ? ` + ${wsol.balance} wSOL` : ""),
        rawBalance: String(solLamports),
      }
      : null;
  const userTokens = solRow
    ? [solRow, ...allTokens.filter((t) => t.mint !== NATIVE_MINT_STR)]
    : allTokens;

  if (userTokens.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-black/5 p-4 text-center">
        <Coins className="size-6 text-muted mx-auto opacity-30 mb-1" />
        <p className="text-[10px] text-muted">No SOL or non-zero SPL tokens found in your wallet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">
        Available Wallet Balances
      </span>
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 subtle-scrollbar">
        {userTokens.map((t) => {
          const isSelected = selectedMint === t.mint;
          return (
            <button
              type="button"
              key={t.mint}
              onClick={() => onSelect(t.mint)}
              aria-pressed={isSelected}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer group ${
                isSelected
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-foreground"
                  : "bg-black/15 border-border hover:border-border-strong text-muted hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                  isSelected ? "bg-[var(--accent)]/20 text-foreground" : "bg-surface text-[var(--accent)] group-hover:bg-surface-2"
                }`}>
                  {t.symbol.substring(0, 3)}
                </div>
                <div className="text-left">
                  <span className="block text-xs font-semibold">{t.symbol}</span>
                  <span className="text-[9px] opacity-60 font-mono">
                    {t === solRow
                      ? "wraps to wSOL"
                      : `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-foreground">
                    {/* The exact UI string from the RPC — no float round-trip. */}
                    {t.balance}
                  </div>
                  <span className="text-[8px] opacity-50 block">Balance</span>
                </div>
                <div className={`size-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected 
                    ? "bg-[var(--accent)] border-[var(--accent)] text-foreground"
                    : "border-border group-hover:border-border-strong text-transparent"
                }`}>
                  <Check className="size-3" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
