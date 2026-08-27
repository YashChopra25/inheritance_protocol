"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { Coins } from "lucide-react";
import { useVault } from "@/hooks/useVault";
import { TxButton, short } from "../shared/ui";
import type { InheritedTokenDisplay } from "@/app/types/inheritance.types";

interface InheritedTokenRowProps {
  owner: PublicKey;
  token: InheritedTokenDisplay;
  refresh: () => void;
}

export const InheritedTokenRow: FC<InheritedTokenRowProps> = ({
  owner,
  token,
  refresh,
}) => {
  const vault = useVault();
  const nothingToClaim = Number(token.myShare) <= 0;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/20 px-3.5 py-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Coins className="size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <span className="font-semibold text-white">{token.symbol}</span>{" "}
            <span className="text-[10px] text-muted">{token.name}</span>
            <span className="block text-[10px] text-muted font-mono">
              Mint: {short(token.tokenMint)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-semibold text-accent">
            {token.myShare} {token.symbol}
          </div>
          <div className="text-[10px] text-muted">
            your share of {token.totalEscrowed}
          </div>
        </div>
      </div>

      {token.claimed ? (
        <p className="text-[11px] font-medium text-neon">
          Claimed {token.claimedAmount} {token.symbol} — sent to your wallet.
        </p>
      ) : nothingToClaim ? (
        <p className="text-[11px] text-muted">
          Your allocation is 0% for tokens — nothing to claim here.
        </p>
      ) : (
        <TxButton
          action={() => vault.claimToken(owner, token.tokenMint)}
          onDone={refresh}
        >
          Claim {token.myShare} {token.symbol}
        </TxButton>
      )}
    </li>
  );
};
