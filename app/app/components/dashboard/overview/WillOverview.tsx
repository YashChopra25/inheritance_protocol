"use client";

import { FC } from "react";
import { useVault } from "@/hooks/useVault";
import { short } from "../shared/ui";
import { CountdownTracker } from "./CountdownTracker";
import type { WillBundle } from "@/hooks/useWill";

interface WillOverviewProps {
  data: WillBundle;
}

function statusOf(status: object): string {
  return Object.keys(status)[0] ?? "unknown";
}

const Stat: FC<{
  label: string;
  value: string;
  highlight?: "active" | "safe" | "warn" | "danger";
}> = ({ label, value, highlight }) => {
  let textCls = "text-white";
  if (highlight === "active" || highlight === "safe") textCls = "text-[var(--neon)]";
  else if (highlight === "warn") textCls = "text-[var(--warn)]";
  else if (highlight === "danger") textCls = "text-[var(--danger)]";

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 px-3.5 py-2.5 transition-all hover:bg-black/30">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold capitalize ${textCls}`}>
        {value}
      </div>
    </div>
  );
};

export const WillOverview: FC<WillOverviewProps> = ({ data }) => {
  const vault = useVault();
  const will = data?.will ?? null;

  if (!will) return null;

  const status = statusOf(will.willStatus);
  const isActive = status === "active";
  const totalPct = will.totalAllocatedPercentage / 100;

  return (
    <div className="flex flex-col gap-4">
      {!isActive && (
        <div className="rounded-xl border border-(--warn)/30 bg-(--warn)/10 p-4 text-xs text-warn leading-relaxed">
          <strong className="block font-semibold mb-1 uppercase tracking-wider">
            Will Locked — Status: {status}
          </strong>
          This will is no longer active. Custom additions, removals of media,
          beneficiaries, custodians, and updates to the configuration parameters
          are locked.
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/2 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">
            My Will Overview
          </h2>
          <span className="text-xs font-mono text-muted">
            PDA: {short(data.willPubkey)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat
            label="Status"
            value={status}
            highlight={isActive ? "active" : "danger"}
          />
          <Stat label="Documents / Media" value={`${will.mediaCount} sealed`} />
          <Stat label="Custodians" value={`${will.custodianCount} added`} />
          <Stat
            label="Allocated Estate"
            value={`${totalPct}%`}
            highlight={totalPct === 100 ? "safe" : "warn"}
          />
        </div>

        {isActive && (
          <CountdownTracker
            lastInactivity={will.lastActiveAt.toNumber()}
            threshold={will.inactivityThreshold.toNumber()}
            onCheckIn={() =>
              vault.updateWill(
                will.inactivityThreshold.toNumber(),
                will.minApprovals
              )
            }
          />
        )}
      </div>
    </div>
  );
};
