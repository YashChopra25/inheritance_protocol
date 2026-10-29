"use client";

import { FC } from "react";
import Link from "next/link";
import { TxButton } from "../shared/ui";
import type { WillAccount } from "@/hooks/useWill";

interface DeleteWillCardProps {
  will: WillAccount;
  isActive: boolean;
  onDelete: () => Promise<string>;
  refresh: () => void;
}

/**
 * The danger zone. `delete_will` refuses to run while the will is not Active
 * or still has any child account (`WillHasDependents` / `WillHasTokenVaults`),
 * so instead of offering a transaction that reverts, this lists exactly what
 * has to be removed first and links to where.
 */
export const DeleteWillCard: FC<DeleteWillCardProps> = ({
  will,
  isActive,
  onDelete,
  refresh,
}) => {
  const blockers = [
    { count: will.tokenVaultCount, label: "token vault", href: "/dashboard/assets", verb: "Withdraw" },
    { count: will.mediaCount, label: "document", href: "/dashboard/files", verb: "Remove" },
    { count: will.beneficiaryCount, label: "beneficiary", href: "/dashboard/beneficiaries", verb: "Remove" },
    { count: will.custodianCount, label: "custodian", href: "/dashboard/custodians", verb: "Remove" },
  ].filter((b) => b.count > 0);

  const canDelete = isActive && blockers.length === 0;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
      <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
        Danger Zone
      </h4>
      <p className="mt-2 text-xs text-muted leading-relaxed">
        This permanently deletes your digital will from Solana and refunds its
        rent. The program only allows it once the will is empty.
      </p>

      {!isActive && (
        <p className="mt-3 text-xs text-warn">
          A will in death confirmation cannot be deleted. Cancel the
          confirmation first.
        </p>
      )}

      {isActive && blockers.length > 0 && (
        <div className="mt-3 text-xs text-muted">
          <p className="text-foreground">Remove these first:</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b.label}>
                {b.verb} {b.count} {b.label}
                {b.count === 1 ? "" : "s"} —{" "}
                <Link href={b.href} className="text-accent underline-offset-2 hover:underline">
                  go there
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <TxButton
          tone="danger"
          confirm="Delete your will permanently? This cannot be undone."
          action={onDelete}
          onDone={refresh}
          disabled={!canDelete}
          title={canDelete ? undefined : "Empty the will before deleting it"}
        >
          Deactivate & Delete Will
        </TxButton>
      </div>
    </div>
  );
};
