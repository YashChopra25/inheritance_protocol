import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./index";
import { EMPTY_WILL_ENTRY, type WillEntry } from "./willSlice";
import { evaluateWillReadiness } from "@/lib/willReadiness";

/** The cache entry for one owner. Never undefined, so callers can read freely. */
export function selectWillEntry(owner: string | null) {
  return (state: RootState): WillEntry =>
    (owner ? state.will.byOwner[owner] : undefined) ?? EMPTY_WILL_ENTRY;
}

/** The connected wallet's own will bundle. */
export const selectMyWillEntry = (state: RootState): WillEntry =>
  selectWillEntry(state.will.connectedOwner)(state);

export const selectMyBundle = (state: RootState) =>
  selectMyWillEntry(state).bundle;

export const selectMyWill = (state: RootState) =>
  selectMyWillEntry(state).bundle?.will ?? null;

/** `"active" | "pendingInheritance" | "claimable"`, or null with no will. */
export const selectMyWillStatus = (state: RootState) => {
  const will = selectMyWill(state);
  return will ? Object.keys(will.willStatus)[0] ?? "unknown" : null;
};

/** Only an Active will accepts owner mutations. */
export const selectMyWillIsActive = (state: RootState) =>
  selectMyWillStatus(state) === "active";

/**
 * Whether the connected wallet's will may accept documents and tokens yet —
 * memoised so the checklist array is stable between renders.
 */
export const selectMyWillReadiness = createSelector(
  [selectMyBundle],
  (bundle) => evaluateWillReadiness(bundle),
);
