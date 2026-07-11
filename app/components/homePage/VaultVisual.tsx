"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

interface VaultVisualProps {
  ownerKey?: PublicKey | null;
  status?: string;
  mediaCount?: number;
  beneficiaryCount?: number;
  lastInactivity?: number;
  inactivityThreshold?: number;
  firstCid?: string | null;
  firstBeneficiary?: PublicKey | null;
}

export function VaultVisual({
  ownerKey,
  status = "active",
  mediaCount = 8,
  beneficiaryCount = 3,
  lastInactivity,
  inactivityThreshold,
  firstCid,
  firstBeneficiary,
}: VaultVisualProps) {
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Format owner key short string
  const displayOwner = ownerKey
    ? `${ownerKey.toBase58().slice(0, 4)}…${ownerKey.toBase58().slice(-4)}`
    : "7H4q…wQ2P";

  // Calculations for countdown timer
  let timerText = "03d 14h 22m";
  let progressPct = 62;
  const isClaimable = status === "claimable";

  if (
    lastInactivity !== undefined &&
    inactivityThreshold !== undefined &&
    !isClaimable
  ) {
    const totalWindowMs = inactivityThreshold * 1000;
    const elapsedMs = now > 0 ? Math.max(now - lastInactivity * 1000, 0) : 0;
    const remainingMs = Math.max(totalWindowMs - elapsedMs, 0);
    const progress =
      totalWindowMs > 0 ? Math.min(elapsedMs / totalWindowMs, 1) : 0;
    progressPct = Math.round((1 - progress) * 100);

    if (remainingMs <= 0) {
      timerText = "00d 00h 00m";
    } else {
      const totalSec = Math.floor(remainingMs / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const pad = (n: number) => n.toString().padStart(2, "0");
      timerText = `${pad(d)}d ${pad(h)}h ${pad(m)}m`;
    }
  } else if (isClaimable) {
    timerText = "00d 00h 00m";
    progressPct = 0;
  }

  // Floating chips values
  const ipfsText = firstCid
    ? `ipfs: ${firstCid.slice(0, 6)}…${firstCid.slice(-4)}`
    : "ipfs: cid pinned";

  const isWillActive = status === "active";

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      {/* Outer halo */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(108,70,255,0.45),transparent_60%)] blur-2xl" />

      {/* Orbit ring */}
      <div className="absolute inset-6 rounded-full border border-[var(--border)]">
        <div className="absolute inset-0 animate-spin-slow">
          <span className="absolute left-1/2 -top-1.5 size-3 -translate-x-1/2 rounded-full bg-[var(--neon)] shadow-[0_0_18px_#9efce0]" />
          <span className="absolute -right-1.5 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_18px_#b794ff]" />
          <span
            className="absolute left-1/2 -bottom-1.5 size-2 -translate-x-1/2 rounded-full bg-white/80"
            style={{ boxShadow: "0 0 14px rgba(255,255,255,0.7)" }}
          />
        </div>
      </div>

      {/* Inner ring */}
      <div className="absolute inset-16 rounded-full border border-dashed border-[rgba(183,148,255,0.25)]" />

      {/* Vault card */}
      <div className="absolute inset-[18%] rounded-3xl glass-strong glow-ring animate-float-slow">
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  isWillActive
                    ? "bg-[var(--neon)] shadow-[0_0_10px_#9efce0]"
                    : "bg-[var(--danger)] shadow-[0_0_10px_#ff6b9a]"
                }`}
              />
              <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                Will {status}
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted">
              {displayOwner}
            </span>
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
              Sealed on IPFS
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-white">
                {mediaCount}
              </span>
              <span className="text-xs text-muted">documents</span>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted font-medium">
              <span>Inactivity timer</span>
              <span className="font-mono text-foreground">{timerText}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="relative h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background: isClaimable
                    ? "var(--danger)"
                    : progressPct < 20
                    ? "linear-gradient(90deg, var(--warn), var(--danger))"
                    : "linear-gradient(90deg, var(--neon), var(--accent) 60%, var(--accent-2))",
                }}
              >
                <div className="absolute inset-0 animate-shimmer rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted font-medium">
              <span>Beneficiaries</span>
              <span className="text-foreground">{beneficiaryCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ping pulse */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative size-3">
          <span className="absolute inset-0 rounded-full bg-[var(--accent)]" />
          <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-pulse-ring" />
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -left-2 sm:-left-6 top-12 rounded-xl glass px-3 py-2 text-xs animate-float-slow [animation-delay:-2s]">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[var(--neon)]" />
          <span className="font-mono text-muted text-[10px]">{ipfsText}</span>
          <span className="text-foreground text-[10px] font-semibold">
            {firstCid ? "active" : "pinned"}
          </span>
        </div>
      </div>
      <div className="absolute -right-2 sm:-right-6 bottom-14 rounded-xl glass px-3 py-2 text-xs animate-float-slow [animation-delay:-4s]">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-muted text-[10px]">
            {firstBeneficiary ? "Heir:" : "Beneficiary"}
          </span>
          <span className="font-mono text-foreground text-[10px] font-semibold">
            {firstBeneficiary
              ? `${firstBeneficiary.toBase58().slice(0, 4)}…${firstBeneficiary
                  .toBase58()
                  .slice(-4)}`
              : "9xVu…kP1"}
          </span>
        </div>
      </div>
    </div>
  );
}
