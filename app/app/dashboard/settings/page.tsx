"use client";

import { FC } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { CreateWillForm } from "@/app/components/dashboard/settings/CreateWillForm";
import { UpdateWillForm } from "@/app/components/dashboard/settings/UpdateWillForm";
import { CurrentWillSettings } from "@/app/components/dashboard/settings/CurrentWillSettings";
import { DeleteWillCard } from "@/app/components/dashboard/settings/DeleteWillCard";

const SettingsPage: FC = () => {
  const { data, refresh, vault, isActive, status } = useDashboard();
  const will = data?.will ?? null;

  if (!will) {
    return (
      <div className="rounded-2xl border border-border bg-white/[0.02] p-6 glass-strong max-w-4xl mx-auto w-full animate-fade-in">
        <CreateWillForm refresh={refresh} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-6 glass-strong max-w-4xl mx-auto w-full flex flex-col gap-8 animate-fade-in">
      <div>
        <h3 className="text-base font-semibold text-foreground">Will Configurations</h3>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Adjust inactivity limits and custodian approvals.
        </p>
      </div>

      <CurrentWillSettings data={data!} status={status ?? "unknown"} />

      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Change settings
        </h4>
        <UpdateWillForm refresh={refresh} isActive={isActive} />
      </div>

      <div className="border-t border-red-500/20 pt-6 mt-4">
        <DeleteWillCard
          will={will}
          isActive={isActive}
          onDelete={() => vault.deleteWill()}
          refresh={refresh}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
