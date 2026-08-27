"use client";

import { FC } from "react";
import Link from "next/link";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";

interface CustodianQuorumCardProps {
  /** `min_approvals` on the will — how many custodians must confirm. */
  minApprovals: number;
  /** How many custodians are actually named. */
  custodianCount: number;
  /** How many have confirmed so far. */
  approvalsReceived: number;
}

export const CustodianQuorumCard: FC<CustodianQuorumCardProps> = ({
  minApprovals,
  custodianCount,
  approvalsReceived,
}) => {
  // The program refuses to raise `min_approvals` above `custodian_count`, but a
  // will created before its custodians were added can still sit in this state —
  // and it can never reach quorum until more are named.
  const shortfall = minApprovals - custodianCount;

  return (
    <div className="rounded-xl border border-(--accent)/20 bg-(--accent)/4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Confirmation Requirement
          </p>

          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold leading-none text-accent tabular-nums">
              {minApprovals}
            </span>
            <span className="pb-1 text-sm text-muted">
              of {custodianCount}{" "}
              {custodianCount === 1 ? "custodian" : "custodians"}
            </span>
          </div>

          <p className="ps-1 mt-2 text-sm text-muted">
            {minApprovals} confirmation
            {minApprovals > 1 ? "s" : ""} required before the will can be
            claimed.
          </p>

          {approvalsReceived > 0 && (
            <p className="ps-1 mt-1 text-sm font-medium text-amber-300">
              {approvalsReceived} of {minApprovals} already confirmed.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Link
            href="/dashboard/settings"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5 hover:text-white sm:h-9 sm:w-auto sm:justify-start sm:px-3"
          >
            <SlidersHorizontal className="size-4 shrink-0" />
            <span>Modify quorum</span>
          </Link>
        </div>
      </div>

      {shortfall > 0 && (
        <div className="mt-5 flex gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />

          <div>
            <p className="text-sm font-medium text-amber-300">
              Quorum cannot be reached
            </p>

            <p className="mt-1 text-sm leading-relaxed text-amber-200/80">
              This will requires <strong>{minApprovals}</strong> approvals but
              only <strong>{custodianCount}</strong>{" "}
              {custodianCount === 1 ? "custodian exists" : "custodians exist"}.
              Add <strong>{shortfall}</strong>{" "}
              {shortfall === 1 ? "more custodian" : "more custodians"}, or
              reduce the quorum in Will Settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
