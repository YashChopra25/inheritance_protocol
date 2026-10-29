"use client";

import { useCallback, useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { useVault } from "./useVault";
import type { WillBundle } from "./useWill";
import { humanizeError } from "@/lib/utils";

interface TeardownStep {
  label: string;
  run: () => Promise<string>;
}

/**
 * Winds down a settled estate with the permissionless teardown cranks.
 *
 * Every crank requires the will to be Claimable and the heirs' claim window to
 * have closed (`require_teardown_open`); rent always goes to the estate, never
 * the caller. Order matters: `close_will` refuses to run while any token vault
 * or child account is left (`WillHasTokenVaults` / `EstateNotEmpty`), so the
 * vaults are swept first, then the children, then the will itself.
 *
 * Each step is its own transaction. On failure the run stops and the will is
 * re-read, so a retry only attempts what is still left.
 */
export function useEstateTeardown(
  owner: PublicKey | null,
  data: WillBundle | null,
  refresh: () => Promise<void> | void,
) {
  const vault = useVault();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const steps = useMemo<TeardownStep[]>(
    () =>
      owner && data?.will
        ? [
          ...data.tokenVaults.map((tv) => ({
            label: "Sweep token vault",
            run: () => vault.sweepTokenVault(owner, tv.account.tokenMint),
          })),
          ...data.media.map((m) => ({
            label: "Close document reference",
            run: () => vault.cleanupMedia(owner, m.account.mediaIndex),
          })),
          ...data.custodians.map((c) => ({
            label: "Close custodian",
            run: () => vault.cleanupCustodian(owner, c.account.wallet),
          })),
          ...data.beneficiaries.map((b) => ({
            label: "Close beneficiary",
            run: () => vault.cleanupBeneficiary(owner, b.account.wallet),
          })),
          { label: "Close will", run: () => vault.closeWill(owner) },
        ]
        : [],
    [owner, data, vault],
  );

  const run = useCallback(async () => {
    if (steps.length === 0) return;
    setBusy(true);
    setDone(0);
    const id = toast.loading(`Closing out the estate (0/${steps.length})…`);
    try {
      for (let i = 0; i < steps.length; i++) {
        toast.loading(`${steps[i].label} (${i + 1}/${steps.length})…`, { id });
        await steps[i].run();
        setDone(i + 1);
      }
      toast.success("Estate closed. All rent and residual tokens returned to the estate.", { id });
    } catch (e) {
      toast.error(humanizeError(e), { id });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [steps, refresh]);

  return { stepCount: steps.length, done, busy, run };
}
