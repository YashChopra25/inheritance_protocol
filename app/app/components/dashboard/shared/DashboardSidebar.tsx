"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FC } from "react";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  ShieldCheck,
  Coins,
  Gift,
  Key,
  Settings,
} from "lucide-react";
import { Logo } from "@/app/components/homePage/Logo";
import { useDashboard } from "@/app/dashboard/DashboardContext";

const links = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/beneficiaries", label: "Beneficiaries", icon: Users },
  { href: "/dashboard/files", label: "Files & Documents", icon: FolderOpen },
  { href: "/dashboard/custodians", label: "Custodians", icon: ShieldCheck },
  { href: "/dashboard/assets", label: "SOL & Tokens", icon: Coins },
  { href: "/dashboard/inheritance", label: "My Inheritance", icon: Gift },
  { href: "/dashboard/intervene", label: "Intervene & Claim", icon: Key },
  { href: "/dashboard/settings", label: "Will Settings", icon: Settings },
];

interface DashboardSidebarProps {
  onClose?: () => void;
}

export const DashboardSidebar: FC<DashboardSidebarProps> = ({ onClose }) => {
  const pathname = usePathname();
  const { data } = useDashboard();
  const will = data?.will;

  return (
    <aside className="flex flex-col h-full bg-[#08050e]/95 border-r border-white/5 w-64 glass-strong">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          // Keep the parent link lit on nested routes (e.g. /dashboard/inheritance/<owner>).
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group border ${
                isActive
                  ? "bg-white/[0.06] border-white/10 text-white shadow-lg shadow-black/20"
                  : "border-transparent text-muted hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`size-4 transition-transform duration-200 group-hover:scale-110 ${
                    isActive
                      ? "text-[var(--accent)]"
                      : "text-muted group-hover:text-white"
                  }`}
                />
                <span>{link.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-5 border-t border-white/5 bg-[#0e0a1c]/20">
        <div className="flex items-center justify-between text-[10px] text-muted mb-2">
          <span>Vault Status</span>
          <span className="font-mono">{will ? "Initialized" : "Empty"}</span>
        </div>
        {will && (
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon)]"></span>
            </span>
            <span className="text-[11px] font-semibold text-[var(--neon)] capitalize">
              {Object.keys(will.willStatus)[0]} Will
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
