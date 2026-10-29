"use client";

import { FC, useState } from "react";
import { useVault } from "@/hooks/useVault";
import { Field, Input, TxButton } from "../shared/ui";
import { CLUSTER } from "@/lib/config";
import {
  MAX_MIN_APPROVALS,
  MAX_THRESHOLD_DAYS,
  MIN_THRESHOLD_DAYS,
  SECS_PER_DAY,
  minApprovalsError,
  thresholdDaysError,
} from "./willParams";

interface CreateWillFormProps {
  refresh: () => void;
}

export const CreateWillForm: FC<CreateWillFormProps> = ({ refresh }) => {
  const vault = useVault();
  const [days, setDays] = useState("365");
  const [minApproval, setMinApproval] = useState("1");

  const daysErr = thresholdDaysError(days);
  const approvalErr = minApprovalsError(minApproval);
  const invalid = daysErr !== null || approvalErr !== null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Create your digital will
        </h3>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Start securing your digital legacy. A will is a Program Derived
          Address (PDA) on Solana {CLUSTER === "mainnet-beta" ? "mainnet" : CLUSTER}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-black/20 p-5">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          How it works
        </h4>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          If you don&apos;t check in for longer than your threshold, named
          custodians can confirm your passing. Only an explicit check-in (or a
          settings update) from this dashboard counts — ordinary wallet
          activity such as transfers or trades does not reset the timer. Once
          enough custodians confirm and a 7-day grace period (in which you can
          still cancel) has passed, heirs (beneficiaries) can claim their
          allocated shares and open any sealed documents that were encrypted
          to them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Inactivity threshold (days)">
          <Input
            type="number"
            min={MIN_THRESHOLD_DAYS}
            max={MAX_THRESHOLD_DAYS}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="e.g. 365"
            aria-invalid={daysErr !== null}
          />
          {daysErr && (
            <span role="alert" className="text-[11px] text-danger">
              {daysErr}
            </span>
          )}
        </Field>
        <Field label="Required custodian approvals">
          <Input
            type="number"
            min={1}
            max={MAX_MIN_APPROVALS}
            step={1}
            value={minApproval}
            onChange={(e) => setMinApproval(e.target.value)}
            placeholder="e.g. 2"
            aria-invalid={approvalErr !== null}
          />
          {approvalErr && (
            <span role="alert" className="text-[11px] text-danger">
              {approvalErr}
            </span>
          )}
        </Field>
      </div>
      <div className="mt-2">
        <TxButton
          disabled={invalid}
          title={invalid ? "Fix the highlighted fields first" : undefined}
          action={() =>
            vault.createWill(
              Number(days.trim()) * SECS_PER_DAY,
              Number(minApproval.trim())
            )
          }
          onDone={refresh}
        >
          Create will on-chain
        </TxButton>
      </div>
    </div>
  );
};
