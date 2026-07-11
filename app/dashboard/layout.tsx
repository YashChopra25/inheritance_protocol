"use client";

import { ReactNode, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVault } from "@/hooks/useVault";
import { useWill } from "@/hooks/useWill";
import { DashboardContext } from "./DashboardContext";
import { DashboardSidebar } from "@/app/components/dashboard/shared/DashboardSidebar";
import { DashboardHeader } from "@/app/components/dashboard/shared/DashboardHeader";
import { DisconnectedView } from "@/app/components/dashboard/shared/DisconnectedView";
import { VaultLoader } from "@/app/components/dashboard/shared/VaultLoader";
import { X } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const vault = useVault();
  const { data, loading, error, refresh } = useWill(vault.publicKey);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-[var(--accent)]" />
      </div>
    );
  }

  const contextValue = { data, loading, error, refresh, vault };

  const renderContent = () => {
    if (!connected) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <DisconnectedView />
        </div>
      );
    }
    if (loading && !data) {
      return <VaultLoader />;
    }
    return <div className="max-w-7xl mx-auto px-6 py-8 w-full">{children}</div>;
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-[#07050d] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 subtle-grid" />

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <DashboardSidebar />
        </div>

        {/* Mobile Sidebar (Drawer Overlay) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative flex flex-col w-64 max-w-xs h-full bg-[#08050e] duration-200">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
              <DashboardSidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 z-10">
          <DashboardHeader onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto">{renderContent()}</main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
