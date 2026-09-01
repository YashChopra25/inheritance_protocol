"use client";

import { FC } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { MediaManager } from "@/app/components/dashboard/file/MediaManager";
import { WillSetupChecklist } from "@/app/components/dashboard/shared/WillSetupChecklist";
import { PlaceholderTab } from "@/app/components/dashboard/shared/DashboardTabs";
import { useRouter } from "next/navigation";

const FilesPage: FC = () => {
  const { data, refresh, isActive, readiness } = useDashboard();
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Shown first, and before the dropzone is reachable: the program refuses
          `add_media_reference` on a will whose quorum can never be met, and by
          then the file has already been encrypted and pinned. */}
      {!readiness.canAddAssets && (
        <WillSetupChecklist readiness={readiness} action="seal documents" />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 glass-strong">
        <MediaManager
          will={will}
          refresh={refresh}
          media={data?.media ?? []}
          isActive={isActive}
          canUpload={readiness.canAddAssets}
          beneficiaries={data?.beneficiaries ?? []}
        />
      </div>
    </div>
  );
};

export default FilesPage;
