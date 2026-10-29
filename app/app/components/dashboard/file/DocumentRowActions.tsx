"use client";

import { FC } from "react";
import { MoreVertical, Eye, Trash2, Edit2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface DocumentRowActionsProps {
  label: string;
  isActive: boolean;
  /** Offer re-sealing: some heir now has a key the document may predate. */
  canReseal: boolean;
  resealing: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onReseal: () => void;
  onDelete: () => void;
}

const itemCls =
  "flex items-center gap-2.5 w-full px-2.5 py-2 text-[11px] font-semibold text-white/80 hover:text-foreground hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer";

export const DocumentRowActions: FC<DocumentRowActionsProps> = ({
  label,
  isActive,
  canReseal,
  resealing,
  onPreview,
  onEdit,
  onReseal,
  onDelete,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        aria-label={`Actions for ${label}`}
        className="p-1.5 rounded-lg border border-border bg-white/[0.02] hover:bg-white/[0.05] text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="border-border bg-surface p-1.5 flex flex-col gap-1 w-48 z-50">
      <DropdownMenuItem onClick={onPreview} className={itemCls}>
        <Eye className="size-3.5 text-[var(--accent)]" aria-hidden /> <span>Preview</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onEdit} className={itemCls}>
        <Edit2 className="size-3.5 text-[var(--warn)]" aria-hidden /> <span>Edit Label</span>
      </DropdownMenuItem>
      {canReseal && (
        <DropdownMenuItem onClick={onReseal} disabled={!isActive || resealing} className={itemCls}>
          <RefreshCw className="size-3.5 text-[var(--neon)]" aria-hidden />
          <span>{resealing ? "Re-sealing…" : "Re-seal for current heirs"}</span>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator className="bg-white/5" />
      <DropdownMenuItem onClick={onDelete} disabled={!isActive} className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[11px] font-semibold text-[var(--danger)] hover:text-foreground hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer">
        <Trash2 className="size-3.5 text-[var(--danger)]" aria-hidden /> <span>Remove</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
