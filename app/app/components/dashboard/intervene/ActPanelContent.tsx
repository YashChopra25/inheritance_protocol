"use client";

import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { TxButton, short } from "../shared/ui";
import { BeneficiaryActions } from "./BeneficiaryActions";
import { useNow } from "@/hooks/useNow";
import { useMyRoles } from "@/hooks/useMyRoles";
import { claimTimeline } from "@/lib/inheritance";
import { GRACE_PERIOD_SECONDS } from "@/lib/config";
import { RecipientKeyCard } from "./RecipientKeyCard";
import type { WillBundle } from "@/hooks/useWill";

interface ActPanelContentProps {
  data: WillBundle;
  owner: PublicKey;
  me: PublicKey | null;
  status: string | null;
  myCustodian?: { account: { hasApproved: boolean; approvedEpoch: number } };
  myBeneficiary?: { account: { allocationPercentage: number; hasClaimed: boolean } };
  refresh: () => void;
}

/** e.g. "7-day", for prose about the owner's revoke window. */
const GRACE = `${Math.round(GRACE_PERIOD_SECONDS / 86_400)}-day`;

export const ActPanelContent: FC<ActPanelContentProps> = ({
  data,
  owner,
  me,
  status,
  myCustodian,
  myBeneficiary,
  refresh,
}) => {
  const vault = useVault();

  const nowSecs = useNow();
  const now = nowSecs === null ? 0 : nowSecs * 1000;
  const { refresh: refreshRoles } = useMyRoles();

  const will = data?.will ?? null;

  if (!will) return null;

  // Confirming death or claiming changes this wallet's standing in the roles
  // list as well as the will itself.
  const onChanged = () => {
    refresh();
    refreshRoles();
  };

  const timeline = claimTimeline(status ?? "", will.claimableAt.toNumber(), nowSecs);

  // A confirmation only counts in the will's current approval epoch: one cast
  // before the owner revoked is void, and the custodian may confirm again.
  const hasCurrentApproval =
    !!myCustodian?.account.hasApproved &&
    myCustodian.account.approvedEpoch === will.approvalEpoch;

  // The program enforces the dead-man's switch: a custodian can only confirm
  // death once the owner has been silent past their inactivity threshold. Gate
  // the button on the same rule so the UI doesn't offer a transaction that would
  // revert with `OwnerStillActive`.
  const eligibleAtMs =
    (will.lastActiveAt.toNumber() + will.inactivityThreshold.toNumber()) * 1000;
  const inactivityWindowExpired = now > 0 && now >= eligibleAtMs;

  return (
    <div className="mt-4 flex flex-col gap-5">
      {/* C5: an heir must publish an encryption key BEFORE the owner uploads,
          so this sits at the top of everything they can act on. */}
      {/* `register_recipient_key` reverts with WillNotActive once death
          confirmation is in flight, so the card is shown disabled then. */}
      {myBeneficiary && (
        <RecipientKeyCard
          ownerAddress={owner.toBase58()}
          disabledReason={
            status === "active"
              ? undefined
              : "This will is no longer active, so its document key can no longer be registered or changed."
          }
        />
      )}

      {/* Will Overview Tag */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-black/25 p-4">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Will Account Status</h4>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border uppercase tracking-wider ${
            status === "active"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : status === "claimable"
              ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
              : "bg-white/10 border-border-strong text-white/85"
          }`}>
            <span className={`size-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
            {status}
          </span>
          <span className="text-xs text-muted">
            {will.approvalsReceived} of {will.minApprovals} custodian approvals · {will.mediaCount} sealed media · {will.beneficiaryCount} heirs
          </span>
        </div>
      </div>

      {/* Custodian actions */}
      {myCustodian ? (
        <div className="rounded-xl border border-border bg-white/1 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Role: Custodian</h4>
            <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/80">Authorized</span>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            {hasCurrentApproval
              ? "You have already confirmed this person's death. Awaiting other custodians if quorum is not met."
              : `Confirm death only if you have verified the owner has passed away and cannot check in. Your confirmation is recorded publicly on-chain. Once enough custodians confirm, a ${GRACE} grace period begins in which the owner can still revoke it; only after that can heirs claim.`}
          </p>
          {!hasCurrentApproval && status !== "claimable" && (
            <div className="mt-3.5">
              {inactivityWindowExpired ? (
                <TxButton
                  tone="danger"
                  confirm={`Confirm the will owner's passing? This is recorded on-chain. If it completes the custodian quorum, a ${GRACE} grace period starts in which the owner can revoke it; after that, heirs can claim.`}
                  action={() => vault.confirmDeath(owner)}
                  onDone={onChanged}
                >
                  Confirm passing (Death)
                </TxButton>
              ) : (
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  The owner&apos;s inactivity window has not elapsed yet. Death can
                  only be confirmed once they have gone without checking in for
                  longer than their threshold (eligible{" "}
                  {new Date(eligibleAtMs).toLocaleString()}).
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        me && (
          <p className="text-[10px] text-muted font-mono">
            Connected wallet ({short(me)}) is not a designated custodian on this will.
          </p>
        )
      )}

      {myBeneficiary && (
        <BeneficiaryActions
          owner={owner}
          data={data}
          beneficiary={myBeneficiary.account}
          timeline={timeline}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};
