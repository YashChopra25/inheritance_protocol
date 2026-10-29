/**
 * Input validation shared by the create and update will forms.
 *
 * The program only requires `inactivity_threshold > 0` and `min_approval >= 1`
 * (a `u8`), so these bounds are deliberately stricter: a threshold of a few
 * seconds would let custodians confirm death almost immediately, and one of
 * centuries would never fire.
 */

export const SECS_PER_DAY = 86_400;
export const MIN_THRESHOLD_DAYS = 1;
export const MAX_THRESHOLD_DAYS = 3_650; // 10 years
export const MAX_MIN_APPROVALS = 255; // `u8` on-chain

const INTEGER = /^\d+$/;

/** An error message for the threshold input, or null when it is valid. */
export function thresholdDaysError(input: string): string | null {
  const v = input.trim();
  if (v === "") return "Enter a number of days.";
  if (!INTEGER.test(v)) return "Use a whole number of days.";
  const n = Number(v);
  if (n < MIN_THRESHOLD_DAYS) return `Must be at least ${MIN_THRESHOLD_DAYS} day.`;
  if (n > MAX_THRESHOLD_DAYS) {
    return `Must be at most ${MAX_THRESHOLD_DAYS} days (10 years).`;
  }
  return null;
}

/** An error message for the required-approvals input, or null when it is valid. */
export function minApprovalsError(input: string): string | null {
  const v = input.trim();
  if (v === "") return "Enter how many custodians must confirm.";
  if (!INTEGER.test(v)) return "Use a whole number.";
  const n = Number(v);
  if (n < 1) return "At least 1 custodian must confirm.";
  if (n > MAX_MIN_APPROVALS) return `Must be at most ${MAX_MIN_APPROVALS}.`;
  return null;
}
