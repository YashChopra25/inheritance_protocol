"use client";

import { useMemo } from "react";
import { useMyRoles } from "./useMyRoles";
import { byUrgency, summarizeInheritance } from "@/lib/inheritance";
import type { InheritanceSummary } from "@/app/types/inheritance.types";

interface UseInheritanceResult {
  items: InheritanceSummary[];
  unlockedCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Every will that names the connected wallet as a beneficiary, described from
 * the heir's point of view and ordered with the openable ones first.
 */
export function useInheritance(): UseInheritanceResult {
  const { data, loading, error, refresh } = useMyRoles();

  const items = useMemo(
    () => data.beneficiaryWills.map(summarizeInheritance).sort(byUrgency),
    [data.beneficiaryWills]
  );

  const unlockedCount = useMemo(
    () => items.filter((i) => i.lock === "unlocked").length,
    [items]
  );

  return { items, unlockedCount, loading, error, refresh };
}
