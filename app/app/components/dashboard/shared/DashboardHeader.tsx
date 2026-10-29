"use client";

import { FC } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ClusterBadge } from "@/app/components/shared/ClusterBadge";
import { ScrambleText } from "@/app/components/fx/ScrambleText";
import { MOBILE_NAV_ID } from "./MobileNavDrawer";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

interface DashboardHeaderProps {
  onMenuClick: () => void;
  /** Whether the mobile navigation drawer is open, for `aria-expanded`. */
  menuOpen?: boolean;
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

export const DashboardHeader: FC<DashboardHeaderProps> = ({
  onMenuClick,
  menuOpen = false,
}) => {
  const pathname = usePathname();
  const pageTitle = resolveTitle(pathname);

  return (
    <header className="z-30 flex h-14 items-center justify-between border-b border-border bg-background px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-2 p-2 text-muted transition-colors hover:text-foreground lg:hidden"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={MOBILE_NAV_ID}
        >
          <Menu className="size-4" />
        </button>
        <h1 className="hidden font-mono text-[12px] uppercase tracking-[0.14em] text-foreground sm:block">
          <ScrambleText text={pageTitle} speed={44} />
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <ClusterBadge />
        <WalletMultiButton />
      </div>
    </header>
  );
};
