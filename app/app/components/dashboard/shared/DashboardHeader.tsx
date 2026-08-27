"use client";

import { FC } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { CLUSTER } from "@/lib/config";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

const titles: Record<string, string> = {
  "/dashboard/overview": "Dashboard Overview",
  "/dashboard/beneficiaries": "Manage Heirs & Shares",
  "/dashboard/files": "Secure Documents Vault",
  "/dashboard/custodians": "Will Custodians",
  "/dashboard/assets": "Asset Distribution",
  "/dashboard/inheritance": "My Inheritance",
  "/dashboard/intervene": "Intervention & Claim Console",
  "/dashboard/settings": "Vault Configuration",
};

/** Falls back to the longest matching parent so nested routes keep a title. */
function resolveTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  const parent = Object.keys(titles)
    .filter((p) => pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return parent ? titles[parent] : "Dashboard";
}

export const DashboardHeader: FC<DashboardHeaderProps> = ({ onMenuClick }) => {
  const pathname = usePathname();
  const pageTitle = resolveTitle(pathname);

  return (
    <header className="h-16 border-b border-white/5 bg-[#07050d]/40 backdrop-blur-md flex items-center justify-between px-6 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-muted hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-sm font-semibold tracking-tight text-white hidden sm:block">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] hidden md:flex">
          <span className="text-muted">Network:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2.5 py-0.5 font-semibold text-[var(--accent)] capitalize">
            <span className="size-1 rounded-full bg-[var(--accent)] animate-pulse" />
            {CLUSTER}
          </span>
        </div>
        <WalletMultiButton />
      </div>
    </header>
  );
};
