"use client";

import { FC } from "react";
import { Coins, Check } from "lucide-react";
import type { UserTokenInfo } from "@/hooks/useTokenBalances";

interface UserTokenListProps {
  userTokens: UserTokenInfo[];
  onSelect: (mint: string) => void;
  selectedMint: string;
}

export const UserTokenList: FC<UserTokenListProps> = ({
  userTokens,
  onSelect,
  selectedMint,
}) => {
  if (userTokens.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/5 p-4 text-center">
        <Coins className="size-6 text-muted mx-auto opacity-30 mb-1" />
        <p className="text-[10px] text-muted">No non-zero SPL tokens found in your wallet.</p>
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
            <div
              key={t.mint}
              onClick={() => onSelect(t.mint)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer group ${
                isSelected
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-white"
                  : "bg-black/15 border-white/5 hover:border-white/10 text-muted hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                  isSelected ? "bg-[var(--accent)]/20 text-white" : "bg-[#0e0a1c] text-[var(--accent)] group-hover:bg-[#1a1433]"
                }`}>
                  {t.symbol.substring(0, 3)}
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-semibold">{t.symbol}</h4>
                  <span className="text-[9px] opacity-60 font-mono">
                    {t.mint.slice(0, 4)}…{t.mint.slice(-4)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-white">
                    {parseFloat(t.balance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}
                  </div>
                  <span className="text-[8px] opacity-50 block">Balance</span>
                </div>
                <div className={`size-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected 
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "border-white/10 group-hover:border-white/20 text-transparent"
                }`}>
                  <Check className="size-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
