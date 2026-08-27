"use client";

import { FC } from "react";
import type { ProgramItem } from "@/hooks/useWill";
import type { TokenVaultAccount } from "@/hooks/useVault";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { useInheritedWill } from "@/hooks/useInheritedWill";
import { useInheritedTokens } from "@/hooks/useInheritedTokens";
import { short } from "../shared/ui";
import { InheritedDocumentsList } from "../intervene/InheritedDocumentsList";
import { InheritedTokensList } from "./InheritedTokensList";
import { InheritanceStatusCard } from "./InheritanceStatusCard";
import { InheritanceClaimCard } from "./InheritanceClaimCard";
import { INHERITANCE_ROOT } from "./inheritance.constants";

interface InheritanceDetailProps {
  ownerStr: string;
}

/** Stable identity so `useInheritedTokens` doesn't see a new array every render. */
const NO_TOKEN_VAULTS: ProgramItem<TokenVaultAccount>[] = [];

const Notice: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-xl border border-white/5 bg-black/10 p-4 text-xs leading-relaxed text-muted">
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
    me,
    myBeneficiary,
    loading,
    error,
    refresh,
  } = useInheritedWill(ownerStr);
  const {
    tokenDisplays,
    loading: loadingTokens,
    refresh: refreshTokens,
  } = useInheritedTokens(
    data?.tokenVaults ?? NO_TOKEN_VAULTS,
    myBeneficiary?.account.allocationPercentage,
    me,
  );

  const refreshAll = () => {
    refresh();
    refreshTokens();
  };

  const body = () => {
    if (invalidOwner) {
      return <Notice>“{ownerStr}” is not a valid Solana address.</Notice>;
    }
    if (loading && !data) {
      return (
        <div className="flex items-center gap-2 py-6 text-xs text-muted">
          <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-accent" />
          <span>Loading will…</span>
        </div>
      );
    }
    if (error) {
      return <p className="py-4 font-mono text-xs text-red-400">{error}</p>;
    }
    if (!owner || !data || !exists || !data.will || !lock) {
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
        <InheritanceStatusCard owner={owner} will={data.will} lock={lock} />
        <InheritanceClaimCard
          owner={owner}
          beneficiary={myBeneficiary.account}
          lock={lock}
          refresh={refreshAll}
        />
        {lock === "unlocked" ? (
          <>
            <InheritedTokensList
              owner={owner}
              tokens={tokenDisplays}
              loading={loadingTokens}
              refresh={refreshAll}
            />
            <InheritedDocumentsList media={data.media} />
            <Notice>
              Documents &amp; media are shared with every heir in full — your
              percentage only governs your share of the escrowed tokens above.
            </Notice>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/10 p-4">
            <Lock className="size-4 shrink-0 text-muted" />
            <p className="text-xs leading-relaxed text-muted">
              {data.will.mediaCount} sealed{" "}
              {data.will.mediaCount === 1 ? "file is" : "files are"} and{" "}
              {data.tokenVaults.length} token{" "}
              {data.tokenVaults.length === 1 ? "vault is" : "vaults are"}{" "}
              attached to this will. They are released here once custodians
              confirm the owner&apos;s passing.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={INHERITANCE_ROOT}
        className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        All inheritances
      </Link>
      {body()}
    </div>
  );
};
