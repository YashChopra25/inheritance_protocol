"use client";

import { useEffect, useRef } from "react";

/** Ceiling for the failure backoff: a broken RPC is retried at most this often. */
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Re-run `refresh` periodically while the tab is visible, and once when the
 * user comes back to it.
 *
 * The owner's dashboard is the one place where on-chain changes made by OTHER
 * people matter most: a custodian confirming death starts a finite revoke
 * window, and the owner only sees the banner if the will is re-read. Loading
 * once on mount meant that banner never appeared without a manual reload.
 *
 * Load control:
 *   * No timer runs while the tab is hidden, so a backgrounded dashboard costs
 *     no RPC calls at all. Becoming visible refreshes once and restarts it.
 *   * The focus/visibility refetch is throttled to `minGapMs`, so a user
 *     flicking between tabs does not trigger a burst of `getProgramAccounts`.
 *   * A refresh that throws or resolves to `false` counts as a failure; each
 *     consecutive failure doubles the delay (up to `MAX_BACKOFF_MS`), so a
 *     rate-limited RPC is not hammered every 30s. One success resets it.
 */
export function useAutoRefresh(
  refresh: () => Promise<unknown> | unknown,
  { intervalMs = 30_000, minGapMs = 10_000, enabled = true } = {},
) {
  // Held in a ref so a new `refresh` identity does not restart the timer.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let failures = 0;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const delay = () =>
      Math.min(MAX_BACKOFF_MS, intervalMs * 2 ** failures);

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (disposed || document.visibilityState !== "visible") return;
      timer = setTimeout(() => void run(true), delay());
    };

    const run = async (fromTimer: boolean) => {
      if (document.visibilityState !== "visible") {
        schedule(); // clears the timer while hidden
        return;
      }
      // Event-driven refreshes respect both the throttle and the backoff.
      if (!fromTimer && Date.now() - last < Math.max(minGapMs, delay() / 2)) {
        // Keep a pending timer rather than pushing it back on every focus.
        if (!timer) schedule();
        return;
      }
      if (inFlight) return;
      inFlight = true;
      last = Date.now();
      try {
        const result = await refreshRef.current();
        failures = result === false ? failures + 1 : 0;
      } catch {
        failures += 1;
      } finally {
        inFlight = false;
        schedule();
      }
    };

    const onWake = () => void run(false);

    schedule();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [enabled, intervalMs, minGapMs]);
}
