"use client";

import { createContext, useContext } from "react";
import { WillBundle } from "@/hooks/useWill";
import { useVault } from "@/hooks/useVault";

export interface DashboardContextProps {
  data: WillBundle | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  vault: ReturnType<typeof useVault>;
}

export const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
