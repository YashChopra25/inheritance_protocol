"use client";

import { PublicKey } from "@solana/web3.js";
import { DotField } from "@/app/components/fx/DotField";
import { ScrambleText } from "@/app/components/fx/ScrambleText";
import { paintVaultWheel } from "@/app/components/fx/artwork";
import { useNow } from "@/hooks/useNow";

interface VaultVisualProps {
  ownerKey: PublicKey | null;
  status: string;
  mediaCount: number;
  beneficiaryCount: number;
  lastInactivity: number;
  inactivityThreshold: number;
  firstCid: string | null;
  firstBeneficiary: PublicKey | null;
}

const shortKey = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/**
 * The vault read-out: a dot-matrix wheel that scatters under the pointer over
 * a hairline ledger of the will's live state.
 *
 * Every value is real. This used to fall back to sample data ("9xVu…kP1" as
 * the first heir, "cid pinned", a fixed countdown) whenever a field was empty,
 * which on the owner's own dashboard read as an heir and a document that did
 * not exist.
 */
export function VaultVisual({
  ownerKey,
  status,
  mediaCount,
  beneficiaryCount,
  lastInactivity,
  inactivityThreshold,
  firstCid,
  firstBeneficiary,
}: VaultVisualProps) {
  // Minute resolution: the read-out only shows days, hours and minutes.
  const nowSecs = useNow(60_000);

  const displayOwner = ownerKey ? shortKey(ownerKey.toBase58()) : "—";
  const isClaimable = status === "claimable";

  let timerText = "—";
  let progressPct = 0;
  if (isClaimable) {
    timerText = "00d 00h 00m";
  } else if (nowSecs !== null) {
    const remaining = Math.max(lastInactivity + inactivityThreshold - nowSecs, 0);
    const elapsed = Math.max(nowSecs - lastInactivity, 0);
    const progress =
      inactivityThreshold > 0 ? Math.min(elapsed / inactivityThreshold, 1) : 0;
    progressPct = Math.round((1 - progress) * 100);
    const d = Math.floor(remaining / 86400);
    const h = Math.floor((remaining % 86400) / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const pad = (n: number) => n.toString().padStart(2, "0");
    timerText = `${pad(d)}d ${pad(h)}h ${pad(m)}m`;
  }

  const ipfsText = firstCid ? `${firstCid.slice(0, 6)}…${firstCid.slice(-4)}` : "none yet";
  const heirText = firstBeneficiary ? shortKey(firstBeneficiary.toBase58()) : "none yet";

  const barColor = isClaimable
    ? "var(--danger)"
    : progressPct < 20
      ? "var(--warn)"
      : "var(--neon)";

  const rows: [string, string][] = [
    ["Owner", displayOwner],
    ["Sealed", `${mediaCount} ${mediaCount === 1 ? "document" : "documents"}`],
    ["Beneficiaries", String(beneficiaryCount)],
    ["First CID", ipfsText],
    ["First heir", heirText],
  ];

  return (
    <div className="border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="inline-flex items-center gap-2 label-mono">
          <span
            className={`size-1.5 rounded-full ${
              isClaimable ? "bg-danger" : "bg-neon"
            }`}
          />
          Will {status}
        </span>
        <span className="index-mono">fig. 02</span>
      </div>

      <div className="flex items-center justify-center px-4 py-6 text-muted">
        <div className="w-52">
          <DotField
            paint={paintVaultWheel}
            aspect={1}
            cell={4}
            fill={0.6}
            radius={90}
            force={30}
            className="block w-full cursor-crosshair"
            ariaLabel="Vault wheel"
          />
        </div>
      </div>

      <dl className="border-t border-border">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between border-b border-border px-4 py-2.5"
          >
            <dt className="label-mono">{k}</dt>
            <dd className="font-mono text-[12px] text-foreground">
              <ScrambleText text={v} speed={34} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-4 py-4">
        <div className="flex items-center justify-between label-mono">
          <span>Inactivity timer</span>
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {timerText}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 w-full bg-[rgba(233,229,220,0.07)]">
          <div
            className="h-full transition-[width] duration-1000 ease-out"
            style={{ width: `${progressPct}%`, background: barColor }}
          />
        </div>
      </div>
    </div>
  );
}
