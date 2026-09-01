"use client";

import { FC } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { CustodianManager } from "@/app/components/dashboard/custodian/CustodianManager";
import { PlaceholderTab } from "@/app/components/dashboard/shared/DashboardTabs";
import { useRouter } from "next/navigation";

const CustodiansPage: FC = () => {
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
    // No outer card: the manager lays itself out as a row of two cards over a
    // full-width list, and wrapping that in another panel just adds inset.
    <div className="max-w-5xl mx-auto w-full animate-fade-in">
      <CustodianManager
        refresh={refresh}
        custodians={data?.custodians ?? []}
        isActive={isActive}
        minApprovals={will.minApprovals}
        approvalsReceived={will.approvalsReceived}
        approvalEpoch={will.approvalEpoch}
      />
    </div>
  );
};

export default CustodiansPage;
