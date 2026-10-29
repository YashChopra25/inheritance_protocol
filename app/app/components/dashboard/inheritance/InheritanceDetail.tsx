"use client";

import { FC } from "react";
import type { ProgramItem } from "@/hooks/useWill";
import type { TokenVaultAccount } from "@/hooks/useVault";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useInheritedWill } from "@/hooks/useInheritedWill";
import { useInheritedTokens } from "@/hooks/useInheritedTokens";
import { short } from "../shared/ui";
import { RecipientKeyCard } from "../intervene/RecipientKeyCard";
import { InheritedEstateSection } from "./InheritedEstateSection";
import { WillLoadError } from "../shared/WillLoadError";
import { useMyRoles } from "@/hooks/useMyRoles";
import { InheritanceStatusCard } from "./InheritanceStatusCard";
import { InheritanceClaimCard } from "./InheritanceClaimCard";
import { ClaimTimelineCard } from "./ClaimTimelineCard";
import { INHERITANCE_ROOT } from "./inheritance.constants";

interface InheritanceDetailProps {
  ownerStr: string;
}

/** Stable identity so `useInheritedTokens` doesn't see a new array every render. */
const NO_TOKEN_VAULTS: ProgramItem<TokenVaultAccount>[] = [];

const Notice: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-xl border border-border bg-black/10 p-4 text-xs leading-relaxed text-muted">
    {children}
  </p>
);

export const InheritanceDetail: FC<InheritanceDetailProps> = ({ ownerStr }) => {
  const {
    owner,
    invalidOwner,
    data,
    exists,
    lock,
    timeline,
    me,
    myBeneficiary,
    loading,
    error,
    refresh,
  } = useInheritedWill(ownerStr);
  const tokens = useInheritedTokens(
    data?.tokenVaults ?? NO_TOKEN_VAULTS,
    myBeneficiary?.account.allocationPercentage,
    me,
  );
  const { refresh: refreshRoles } = useMyRoles();

  // A claim changes this heir's standing in the roles list too.
  const refreshAll = () => {
    refresh();
    tokens.refresh();
    refreshRoles();
  };

  const body = () => {
    if (invalidOwner) {
      return <Notice>“{ownerStr}” is not a valid Solana address.</Notice>;
    }
    if (loading && !data) {
      return (
        <div className="flex items-center gap-2 py-6 text-xs text-muted">
          <div className="size-3 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
          <span>Loading will…</span>
        </div>
      );
    }
    if (error && !data) {
      return <WillLoadError variant="fatal" message={error} retry={refresh} />;
    }
    if (!owner || !data || !exists || !data.will || !lock || !timeline) {
      return (
        <Notice>
          No will exists for {owner ? short(owner) : "this address"}.
        </Notice>
      );
    }
    if (!myBeneficiary) {
      return (
        <Notice>
          This will exists, but{" "}
          {me ? `your wallet (${short(me)})` : "your wallet"} is not named as an
          heir on it.
        </Notice>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        {error && (
          <WillLoadError variant="partial" message={error} retry={refresh} />
        )}
        <InheritanceStatusCard
          owner={owner}
          will={data.will}
          timeline={timeline}
          allocationBps={myBeneficiary.account.allocationPercentage}
        />

        {/* Registration is only accepted while the will is Active, and only
            documents uploaded *after* it can ever be opened by this heir — so
            it belongs at the top of a live will, not buried in another tab. */}
        {lock === "active" && <RecipientKeyCard ownerAddress={ownerStr} />}

        <ClaimTimelineCard timeline={timeline} />

        <InheritanceClaimCard
          owner={owner}
          beneficiary={myBeneficiary.account}
          timeline={timeline}
          refresh={refreshAll}
        />

        <InheritedEstateSection
          owner={owner}
          data={data}
          lock={lock}
          timeline={timeline}
          tokens={tokens}
          refresh={refreshAll}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={INHERITANCE_ROOT}
        className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All inheritances
      </Link>
      {body()}
    </div>
  );
};
