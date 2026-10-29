"use client";

import { FC } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import type { ClaimTimeline } from "@/app/types/inheritance.types";
import { documentsReadable } from "@/lib/inheritance";
import { formatRelativeDuration } from "@/lib/utils";
import { TxButton } from "../shared/ui";
import { InheritedDocumentsList } from "./InheritedDocumentsList";
import type { WillBundle } from "@/hooks/useWill";

interface BeneficiaryActionsProps {
  owner: PublicKey;
  data: WillBundle;
  beneficiary: { allocationPercentage: number; hasClaimed: boolean };
  timeline: ClaimTimeline;
  onChanged: () => void;
}

/** Why the claim button is not offered, in the heir's terms. */
function blockedReason(timeline: ClaimTimeline): string {
  switch (timeline.phase) {
    case "active":
      return "The owner is still checking in. Nothing can be claimed while the will is active.";
    case "pending":
      return "Custodians have started confirming the owner's passing, but quorum has not been reached yet.";
    case "grace":
      return timeline.secondsUntilOpen > 0
        ? `Quorum reached. Claims open in ${formatRelativeDuration(
            timeline.secondsUntilOpen * 1000,
          )}, once the owner's window to cancel has passed.`
        : "Quorum reached. Claims open once the owner's window to cancel has passed.";
    case "closed":
      return "The claim window has closed. Unclaimed shares are returned to the estate.";
    default:
      return "";
  }
}

/**
 * The heir's side of the intervene panel. The claim button is offered only
 * when `require_claims_open` would accept it — grace period over and claim
 * window still open — instead of a transaction that reverts.
 */
export const BeneficiaryActions: FC<BeneficiaryActionsProps> = ({
  owner,
  data,
  beneficiary,
  timeline,
  onChanged,
}) => {
  const vault = useVault();

  return (
    <>
      <div className="rounded-xl border border-border bg-white/1 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Your Role: Beneficiary
          </h4>
          <span className="rounded bg-(--accent)/15 border border-(--accent)/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">
            Heir · {beneficiary.allocationPercentage / 100}% share
          </span>
        </div>

        {beneficiary.hasClaimed ? (
          <p className="mt-2 text-xs text-neon font-medium">
            Inheritance claimed. Any documents sealed to your key are listed
            below; claim escrowed tokens from the My Inheritance page.
          </p>
        ) : timeline.canClaimNow ? (
          <div className="mt-3">
            <TxButton action={() => vault.claimInheritance(owner)} onDone={onChanged}>
              Claim inheritance
            </TxButton>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted leading-relaxed">
            {blockedReason(timeline)}
          </p>
        )}
      </div>

      {/* The API only serves an heir's documents once the grace period is over. */}
      {documentsReadable(timeline) && <InheritedDocumentsList media={data.media} />}
    </>
  );
};
