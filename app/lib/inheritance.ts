import type { RoleWill } from "@/app/types/roles.types";
import type { InheritanceSummary, LockState } from "@/app/types/inheritance.types";

/** Map an on-chain `WillStatus` label onto what the heir can do with it. */
export function lockStateOf(status: string): LockState {
  if (status === "claimable") return "unlocked";
  if (status === "pendingInheritance") return "pending";
  return "active";
}

function noteFor(will: RoleWill, lock: LockState): string {
  if (lock === "unlocked") {
    return will.hasClaimed
      ? "You have claimed this inheritance. The sealed documents are open."
      : "Custodians confirmed the passing. Your documents are available below.";
  }
  if (lock === "pending") {
    const remaining = Math.max(will.minApprovals - will.approvalsReceived, 0);
    return `${will.approvalsReceived} of ${will.minApprovals} custodians have confirmed the passing — ${remaining} more needed.`;
  }
  return "The owner is still checking in. Nothing is released while the will is active.";
}

export function summarizeInheritance(will: RoleWill): InheritanceSummary {
  const lock = lockStateOf(will.status);
  return { will, lock, note: noteFor(will, lock) };
}

/** Unlocked first, then pending, then active — the heir cares about openable wills. */
const ORDER: Record<LockState, number> = { unlocked: 0, pending: 1, active: 2 };

export function byUrgency(a: InheritanceSummary, b: InheritanceSummary): number {
  return ORDER[a.lock] - ORDER[b.lock];
}
