"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { short } from "../shared/ui";
import { LOCK_META } from "./inheritance.constants";
import type { LockState } from "@/app/types/inheritance.types";
import type { WillAccount } from "@/hooks/useVault";

interface InheritanceStatusCardProps {
  owner: PublicKey;
  will: WillAccount;
  lock: LockState;
}

export const InheritanceStatusCard: FC<InheritanceStatusCardProps> = ({
  owner,
  will,
  lock,
}) => {
  const meta = LOCK_META[lock];
  const Icon = meta.icon;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
          Will of {short(owner)}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.pillCls}`}
        >
          <Icon className="size-3" />
          {meta.label}
        </span>
      </div>

      <p className="font-mono text-[10px] break-all text-muted">{owner.toBase58()}</p>

      <p className="text-xs text-muted">
        {will.approvalsReceived} of {will.minApprovals} custodian approvals ·{" "}
        {will.mediaCount} sealed media · {will.beneficiaryCount} heirs
      </p>
    </div>
  );
};
