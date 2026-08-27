"use client";

import { FC } from "react";
import { useDashboard } from "@/app/dashboard/DashboardContext";
import { MediaManager } from "@/app/components/dashboard/file/MediaManager";
import { PlaceholderTab } from "@/app/components/dashboard/shared/DashboardTabs";
import { useRouter } from "next/navigation";

function statusOf(status: object): string {
  return Object.keys(status)[0] ?? "unknown";
}

const FilesPage: FC = () => {
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 glass-strong max-w-7xl mx-auto w-full animate-fade-in">
      <MediaManager
        will={will}
        refresh={refresh}
        media={data?.media ?? []}
        isActive={statusOf(will.willStatus) === "active"}
        beneficiaries={data?.beneficiaries ?? []}
      />
    </div>
  );
};

export default FilesPage;
