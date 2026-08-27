"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { TxButton } from "../shared/ui";
import type { LockState } from "@/app/types/inheritance.types";
import type { BeneficiaryAccount } from "@/hooks/useVault";

interface InheritanceClaimCardProps {
  owner: PublicKey;
  beneficiary: BeneficiaryAccount;
  lock: LockState;
  refresh: () => void;
}

export const InheritanceClaimCard: FC<InheritanceClaimCardProps> = ({
  owner,
  beneficiary,
  lock,
  refresh,
}) => {
  const vault = useVault();

  return (
    <div className="rounded-xl border border-white/10 bg-white/1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
          Your Share
        </h3>
        <span className="rounded border border-(--accent)/20 bg-(--accent)/15 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">
          Heir · {beneficiary.allocationPercentage / 100}% of tokens
        </span>
      </div>

      <p className="mt-1 text-[10px] leading-relaxed text-muted">
        Your {beneficiary.allocationPercentage / 100}% share applies to escrowed
        tokens. All documents &amp; media are shared with every heir in full.
      </p>

      {lock !== "unlocked" ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          You can claim this inheritance once enough custodians confirm the
          owner&apos;s passing and the inactivity window expires.
        </p>
      ) : beneficiary.hasClaimed ? (
        <p className="mt-2 text-xs font-medium text-neon">
          Inheritance claimed. Your claim is recorded on-chain.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-muted">
            Recording your claim marks this inheritance as received on-chain. The
            documents below are already available to you.
          </p>
          <TxButton action={() => vault.claimInheritance(owner)} onDone={refresh}>
            Record my claim
          </TxButton>
        </div>
      )}
    </div>
  );
};
