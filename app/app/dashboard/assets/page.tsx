"use client";

import { FC } from "react";
import { useDashboard } from "@/app/dashboard/DashboardContext";
import { PlaceholderTab } from "@/app/components/dashboard/shared/DashboardTabs";
import { TokenVaultManager } from "@/app/components/dashboard/token/TokenVaultManager";
import { useRouter } from "next/navigation";
import { Coins, ShieldAlert, Sparkles } from "lucide-react";

function statusOf(status: object): string {
  return Object.keys(status)[0] ?? "unknown";
}

const AssetsPage: FC = () => {
  const { data, refresh } = useDashboard();
  const router = useRouter();
  const will = data?.will ?? null;

  if (!will) {
    return (
      <PlaceholderTab
        setActiveTab={() => router.push("/dashboard/settings")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full animate-fade-in">
      <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.02] p-6 glass-strong relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Coins className="size-32 text-[var(--accent)]" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              <Sparkles className="size-3" /> Secure Escrow
            </div>
            <h2 className="text-lg font-semibold text-white">
              Trustless SOL & Token Distribution
            </h2>
            <p className="text-xs text-muted leading-relaxed max-w-xl">
              Configure automatic custody-free escrow of your liquid Solana assets.
              Upon inactivity validation, your tokens are unlocked and claimable by heirs according to your settings.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--warn)] bg-[var(--warn)]/10 border border-[var(--warn)]/20 rounded-xl px-4 py-3 sm:max-w-xs">
            <ShieldAlert className="size-5 shrink-0" />
            <span>Escrow contracts currently undergoing Halborn security audits.</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 glass-strong">
        <TokenVaultManager
          refresh={refresh}
          tokenVaults={data?.tokenVaults ?? []}
          isActive={statusOf(will.willStatus) === "active"}
        />
      </div>
    </div>
  );
};

export default AssetsPage;
