import { Clock, Lock, Unlock, type LucideIcon } from "lucide-react";
import type { LockState } from "@/app/types/inheritance.types";

interface LockMeta {
  label: string;
  icon: LucideIcon;
  /** Status pill styling. */
  pillCls: string;
  /** Lock glyph styling on the card. */
  iconCls: string;
}

export const LOCK_META: Record<LockState, LockMeta> = {
  unlocked: {
    label: "Confirmed",
    icon: Unlock,
    pillCls: "bg-red-500/10 border-red-500/30 text-red-400",
    iconCls: "text-red-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    pillCls: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    iconCls: "text-amber-400",
  },
  active: {
    label: "Active",
    icon: Lock,
    pillCls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    iconCls: "text-muted",
  },
};

export const INHERITANCE_ROOT = "/dashboard/inheritance";
