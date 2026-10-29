"use client";

import { FC, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";

export const MOBILE_NAV_ID = "dashboard-mobile-nav";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The small-screen navigation drawer, as a proper modal dialog: Escape closes
 * it, focus moves into it on open and is trapped there, and focus returns to
 * whatever opened it (the header's menu button) on close.
 */
export const MobileNavDrawer: FC<MobileNavDrawerProps> = ({ open, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        id={MOBILE_NAV_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
        className="relative flex h-full w-64 max-w-xs flex-col bg-surface"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 p-2 text-muted transition-colors hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
        <DashboardSidebar onClose={onClose} />
      </div>
    </div>
  );
};
