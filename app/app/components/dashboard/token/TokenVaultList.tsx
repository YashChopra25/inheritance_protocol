"use client";

import { FC, useState } from "react";
import { Coins, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { explorerTxUrl } from "../shared/ui";
import { VaultRow } from "./TokenVaultRow";
import type { TokenVaultDisplay } from "@/app/types/token.types";

interface TokenVaultListProps {
  tokenVaultsCount: number;
  vaultDisplays: TokenVaultDisplay[];
  loadingBalances: boolean;
  /** Set when vault balances could not be read from the chain. */
  loadError: string | null;
  refreshBalances: () => void;
  hasOwnerKey: boolean;
  isActive: boolean;
  onRemove: (mintAddress: string) => Promise<void>;
  removing: boolean;
  removeError: string | null;
  removeSuccessSig: string | null;
}

export const TokenVaultList: FC<TokenVaultListProps> = ({
  tokenVaultsCount,
  vaultDisplays,
  loadingBalances,
  loadError,
  refreshBalances,
  hasOwnerKey,
  isActive,
  onRemove,
  removing,
  removeError,
  removeSuccessSig,
}) => {
  const [confirmMint, setConfirmMint] = useState<string | null>(null);

  const handleDelete = async (mintAddress: string) => {
    await onRemove(mintAddress);
    setConfirmMint(null);
  };

  return (
    <div className="md:col-span-3 rounded-2xl border border-border bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Active Token Escrows ({tokenVaultsCount})
          </h3>
          <p className="text-[11px] text-muted mt-0.5 font-mono">
            PDAs holding assets for your beneficiaries
          </p>
        </div>
        <button
          onClick={refreshBalances}
          disabled={loadingBalances}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-foreground"
          title="Refresh balances"
          aria-label="Refresh balances"
        >
          <RefreshCw
            className={`size-3.5 ${loadingBalances ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-2">
          Could not load vault balances: {loadError}
        </p>
      )}
      {removeError && (
        <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-2">
          {removeError}
        </p>
      )}
      {removeSuccessSig && (
        <p className="text-[11px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-2">
          Escrow deleted!{" "}
          <a
            href={explorerTxUrl(removeSuccessSig)}
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-0.5 font-semibold"
          >
            View Tx <ExternalLink className="size-3" />
          </a>
        </p>
      )}

      {tokenVaultsCount === 0 ? (
        <EmptyState />
      ) : vaultDisplays.length === 0 && loadingBalances ? (
        <p className="text-xs text-muted">Loading vault balances…</p>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {vaultDisplays.map((v) => (
            <VaultRow
              key={v.publicKey.toBase58()}
              vault={v}
              hasOwnerKey={hasOwnerKey}
              isActive={isActive}
              isConfirming={confirmMint === v.tokenMint.toBase58()}
              removing={removing}
              onRequestDelete={() => setConfirmMint(v.tokenMint.toBase58())}
              onCancelDelete={() => setConfirmMint(null)}
              onConfirmDelete={() => handleDelete(v.tokenMint.toBase58())}
            />
          ))}
        </div>
      )}

      <InfoFooter />
    </div>
  );
};

const EmptyState: FC = () => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
    <Coins className="size-8 text-muted mx-auto opacity-30" />
    <p className="text-xs text-muted">
      No SPL token vaults registered. Fill the form to secure your tokens.
    </p>
  </div>
);

const InfoFooter: FC = () => (
  <div className="flex items-start gap-2 text-[10px] text-muted leading-relaxed bg-white/[0.01] border border-border rounded-xl p-3.5">
    <AlertCircle className="size-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
    <p>
      SPL tokens are transferred into program-derived vaults. To add native
      SOL, you must first convert it to Wrapped SOL (wSOL) at{" "}
      <span className="font-mono">
        So11111111111111111111111111111111111111112
      </span>
      .
    </p>
  </div>
);
