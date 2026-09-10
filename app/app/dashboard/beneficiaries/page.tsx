"use client";

import { FC } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { BeneficiaryManager } from "@/app/components/dashboard/beneficiary/BeneficiaryManager";
import { PlaceholderTab } from "@/app/components/dashboard/shared/DashboardTabs";
import { useRouter } from "next/navigation";

const BeneficiariesPage: FC = () => {
  const { data, refresh, isActive } = useDashboard();
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
    <div className="rounded-2xl border border-border bg-white/2 p-6 glass-strong max-w-4xl mx-auto w-full animate-fade-in">
      <BeneficiaryManager
        refresh={refresh}
        beneficiaries={data?.beneficiaries ?? []}
        totalBps={will.totalAllocatedPercentage}
        isActive={isActive}
      />
    </div>
  );
};

export default BeneficiariesPage;
