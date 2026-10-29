"use client";

import { FC } from "react";
import { ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { short } from "../shared/ui";
import { explorerUrl } from "@/lib/config";
import type { TokenVaultDisplay } from "@/app/types/token.types";

interface VaultRowProps {
  vault: TokenVaultDisplay;
  hasOwnerKey: boolean;
  isActive: boolean;
  isConfirming: boolean;
  removing: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export const VaultRow: FC<VaultRowProps> = ({
  vault: v,
  hasOwnerKey,
  isActive,
  isConfirming,
  removing,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}) => (
  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-black/10 hover:border-border-strong transition-all text-xs">
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-foreground">{v.symbol}</span>
        <span className="text-[10px] text-muted">{v.name}</span>
      </div>
      <div className="text-[9px] text-muted font-mono flex items-center gap-1">
        <span>Vault PDA: {short(v.publicKey)}</span>
        <a
          href={explorerUrl(v.publicKey.toBase58(), "address")}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
          aria-label="View vault account on explorer"
        >
          <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="text-right space-y-0.5">
        <div className="font-semibold font-mono text-[var(--accent)]">
          {v.vaultBalance} {v.symbol}
        </div>
        {hasOwnerKey && (
          <div className="text-[9px] text-muted font-mono">
            Your Wallet: {v.userBalance} {v.symbol}
          </div>
        )}
      </div>

      {hasOwnerKey && isActive && (
        <DeleteButton
          isConfirming={isConfirming}
          removing={removing}
          onRequest={onRequestDelete}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      )}
    </div>
  </div>
);

interface DeleteButtonProps {
  isConfirming: boolean;
  removing: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteButton: FC<DeleteButtonProps> = ({
  isConfirming,
  removing,
  onRequest,
  onCancel,
  onConfirm,
}) => {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={onConfirm}
          disabled={removing}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
        >
          {removing ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          {removing ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={onCancel}
          disabled={removing}
          aria-label="Cancel delete"
          className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onRequest}
      title="Delete escrow and withdraw tokens"
      aria-label="Delete escrow and withdraw tokens"
      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-all cursor-pointer"
    >
      <Trash2 className="size-4" />
    </button>
  );
};
