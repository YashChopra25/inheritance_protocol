"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { useParsedKey } from "@/hooks/useParsedKey";
import { MAX_ALLOCATION_BPS } from "@/lib/config";
import { Field, Input, TxButton } from "../shared/ui";
import { KeyList } from "../shared/KeyList";

interface BeneficiaryManagerProps {
  refresh: () => void;
  beneficiaries: {
    publicKey: PublicKey;
    account: { wallet: PublicKey; allocationPercentage: number; hasClaimed: boolean };
  }[];
  totalBps: number;
  isActive: boolean;
}

export const BeneficiaryManager: FC<BeneficiaryManagerProps> = ({
  refresh,
  beneficiaries,
  totalBps,
  isActive,
}) => {
  const vault = useVault();
  const [addr, setAddr] = useState("");
  const [pct, setPct] = useState("10");
  const parsed = useParsedKey(addr);
  const bps = Math.round(Number(pct) * 100);
  const remaining = (MAX_ALLOCATION_BPS - totalBps) / 100;
  const valid = parsed && bps > 0 && totalBps + bps <= MAX_ALLOCATION_BPS;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-semibold text-white">
          Beneficiaries & Shares
        </h3>
        <p className="text-xs text-muted mt-1">
          Name heirs and specify their share of the estate. Remaining space:{" "}
          {remaining}%
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-black/10 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] sm:items-end">
          <Field label="Beneficiary wallet address">
            <Input
              placeholder="e.g. 9xVuPq3Tn8e..."
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              disabled={!isActive}
            />
          </Field>
          <Field label="Allocation share (%)">
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              disabled={!isActive}
            />
          </Field>
        </div>
        <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 text-[11px] leading-relaxed text-[var(--accent)]">
          <span className="font-semibold">Heads up:</span> this percentage sets
          the heir&apos;s share of your <span className="font-semibold">escrowed
          tokens only</span>. All uploaded documents &amp; media are shared with
          every beneficiary in full, regardless of percentage.
        </div>
        <TxButton
          disabled={!isActive || !valid}
          title={
            !isActive ? "Actions are only allowed when the will is active" : ""
          }
          action={() => vault.addBeneficiary(parsed!, bps)}
          onDone={() => {
            setAddr("");
            refresh();
          }}
        >
          {parsed && totalBps + bps > MAX_ALLOCATION_BPS
            ? "Exceeds 100% allocation"
            : "Add beneficiary share"}
        </TxButton>
      </div>

      <div className="mt-2">
        <h4 className="text-xs font-semibold text-white mb-2.5 uppercase tracking-wider">
          Beneficiaries & Estates List ({beneficiaries.length})
        </h4>
        <KeyList
          items={beneficiaries.map((b) => ({
            key: b.publicKey.toBase58(),
            wallet: b.account.wallet,
            badge:
              (b.account.hasClaimed ? "Claimed · " : "") +
              `${b.account.allocationPercentage / 100}% estate`,
            badgeStyle: b.account.hasClaimed ? "success" : "neutral",
          }))}
          onRemove={(wallet) => vault.removeBeneficiary(wallet)}
          refresh={refresh}
          disabled={!isActive}
          empty="No beneficiaries added. Specify who inherits your legacy."
        />
      </div>
    </div>
  );
};
