import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { WillBundle } from "@/hooks/useWill";
import { useVault } from "@/hooks/useVault";
import { evaluateWillReadiness } from "@/lib/willReadiness";
import {
  WillOverview,
  CreateWillForm,
  CustodianManager,
  BeneficiaryManager,
  UpdateWillForm,
} from "./OwnerPanel";
import { MediaManager } from "../file/MediaManager";
import { ActPanel } from "../intervene/ActPanel";
import { ContextFlowDiagram } from "../overview/ContextFlowDiagram";
import { TxButton } from "./ui";
import { VaultVisual } from "@/app/components/homePage/VaultVisual";
import { LifecycleFlow } from "../overview/LifecycleFlow";
import { TabButton, PlaceholderTab } from "./DashboardTabs";

interface ConnectedViewProps {
  data: WillBundle | null;
  refresh: () => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  vault: ReturnType<typeof useVault>;
  firstCid: string | null;
  firstBeneficiary: PublicKey | null;
}

function statusOf(status: object): string {
  return Object.keys(status)[0] ?? "unknown";
}

export const ConnectedView: FC<ConnectedViewProps> = ({
  data,
  refresh,
  activeTab,
  setActiveTab,
  vault,
  firstCid,
  firstBeneficiary,
}) => {
  const will = data?.will ?? null;
  // Same guard the program applies to `add_media_reference`: no reachable
  // quorum, no uploads.
  const readiness = evaluateWillReadiness(data);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.95fr_1.05fr] gap-8 items-start">
      {/* Left Column: Management Consoles */}
      <div className="flex flex-col gap-6">
        {will && (
          <>
            <WillOverview data={data!} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 glass-strong">
              <MediaManager
                will={will}
                refresh={refresh}
                media={data?.media ?? []}
                isActive={statusOf(will.willStatus) === "active"}
                canUpload={readiness.canAddAssets}
                beneficiaries={data?.beneficiaries ?? []}
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 glass-strong">
              <CustodianManager
                refresh={refresh}
                custodians={data?.custodians ?? []}
                isActive={statusOf(will.willStatus) === "active"}
                minApprovals={will.minApprovals}
                approvalsReceived={will.approvalsReceived}
                approvalEpoch={will.approvalEpoch}
              />
            </div>
          </>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 glass-strong flex flex-col gap-6">
          <div className="flex border-b border-white/5 overflow-x-auto scrollbar-none pb-2 gap-1">
            <TabButton active={activeTab === "beneficiaries"} onClick={() => setActiveTab("beneficiaries")} label="🤝 Beneficiaries" />
            <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} label="⚙️ Settings" />
            <TabButton active={activeTab === "intervene"} onClick={() => setActiveTab("intervene")} label="🔑 Intervene / Claim" />
          </div>

          <div className="min-h-[250px]">
            {activeTab === "beneficiaries" && (
              will ? (
                <BeneficiaryManager refresh={refresh} beneficiaries={data?.beneficiaries ?? []} totalBps={will.totalAllocatedPercentage} isActive={statusOf(will.willStatus) === "active"} />
              ) : (
                <PlaceholderTab setActiveTab={setActiveTab} />
              )
            )}

            {activeTab === "settings" && (
              will ? (
                <div className="flex flex-col gap-8">
                  <div>
                    <h3 className="text-base font-semibold text-white">Will Configurations</h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed">Adjust limits and signatures.</p>
                  </div>
                  <UpdateWillForm refresh={refresh} isActive={statusOf(will.willStatus) === "active"} />
                  <div className="border-t border-red-500/20 pt-6 mt-4">
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                      <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h4>
                      <p className="mt-2 text-xs text-muted leading-relaxed">This permanently deletes your digital will from Solana.</p>
                      <div className="mt-4">
                        <TxButton tone="danger" confirm="Are you sure?" action={() => vault.deleteWill()} onDone={refresh}>Deactivate & Delete Will</TxButton>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <CreateWillForm refresh={refresh} />
              )
            )}

            {activeTab === "intervene" && <ActPanel noWrapper />}
          </div>
        </div>
      </div>

      {/* Right Column: Visualizer & Info */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-4 glass overflow-hidden flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] self-start mb-2 pl-1">Active Vault Visualizer</h3>
          <div className="w-full scale-95 sm:scale-100 origin-center">
            <VaultVisual
              ownerKey={vault.publicKey}
              status={will ? statusOf(will.willStatus) : undefined}
              mediaCount={will ? will.mediaCount : undefined}
              beneficiaryCount={will ? will.beneficiaryCount : undefined}
              lastInactivity={will ? will.lastActiveAt.toNumber() : undefined}
              inactivityThreshold={will ? will.inactivityThreshold.toNumber() : undefined}
              firstCid={firstCid}
              firstBeneficiary={firstBeneficiary}
            />
          </div>
        </div>

        <LifecycleFlow />
        <ContextFlowDiagram />

        <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-5 glass">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--warn)]">Trustless Architecture</h3>
          <p className="mt-2.5 text-xs text-muted leading-relaxed">No third party can modify your will settings or preview files.</p>
        </div>
      </div>
    </div>
  );
};
