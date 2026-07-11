"use client";

import { FC } from "react";
import { Plus, ExternalLink, RefreshCw } from "lucide-react";
import { useVault } from "@/hooks/useVault";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useTokenEscrow, useTokenEscrowRemove } from "@/hooks/useTokenEscrow";
import { Field, Input, explorerTxUrl } from "../shared/ui";
import { TokenVaultList } from "./TokenVaultList";
import { UserTokenList } from "./UserTokenList";
import { useDashboard } from "@/app/dashboard/DashboardContext";
import type { ProgramItem } from "@/hooks/useWill";
import type { TokenVaultAccount } from "@/hooks/useVault";
interface TokenVaultManagerProps {
  refresh: () => void;
  tokenVaults: ProgramItem<TokenVaultAccount>[];
  isActive: boolean;
}

export const TokenVaultManager: FC<TokenVaultManagerProps> = ({
  refresh,
  tokenVaults,
  isActive,
}) => {
  const vault = useVault();
  const { data } = useDashboard();
  const will = data?.will;
  const hasCustodians = will ? will.custodianCount > 0 : false;
  const canEscrow = isActive && hasCustodians;

  const { vaultDisplays, userTokens, loading: loadingBalances, refreshBalances } = useTokenBalances(
    tokenVaults,
    vault.publicKey
  );

  const refreshAll = () => {
    refresh();
    refreshBalances();
  };

  const escrow = useTokenEscrow(
    vault.addToken,
    refreshAll,
    userTokens,
  );

  const escrowRemove = useTokenEscrowRemove(
    vault.removeToken,
    refreshAll,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full items-start">
      {/* Deposit Form */}
      <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Escrow New SPL Token</h3>
          <p className="text-[11px] text-muted mt-0.5">Register and deposit tokens under your digital will.</p>
        </div>

        <div className="space-y-3.5">
          <Field label="SPL Token Mint Address">
            <div className="relative">
              <Input
                placeholder="e.g. EPjFWdd5AufqSSqe..."
                value={escrow.mintAddress}
                onChange={(e) => escrow.setMintAddress(e.target.value)}
                disabled={!canEscrow || escrow.submitting}
                className="w-full pr-8"
              />
              {escrow.checkingMint && (
                <RefreshCw className="absolute right-3 top-3 size-4 animate-spin text-muted" />
              )}
            </div>
          </Field>

          {/* Available Wallet Balances */}
          <UserTokenList
            userTokens={userTokens}
            onSelect={(mint) => escrow.setMintAddress(mint)}
            selectedMint={escrow.mintAddress}
          />

          {!hasCustodians && (
            <div className="rounded-lg bg-[var(--warn)]/10 border border-[var(--warn)]/20 p-3 text-xs text-[var(--warn)] space-y-1">
              <span className="font-semibold block">Custodians Required</span>
              <p className="text-[10px] opacity-80 leading-relaxed">
                At least one custodian must be added to your will before you can escrow tokens. Go to the Custodians tab to add a custodian.
              </p>
            </div>
          )}

          {escrow.isValidMint && (
            <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 p-2 text-xs text-[var(--accent)] flex items-center justify-between">
              <span>Token Resolved:</span>
              <span className="font-semibold">{escrow.mintSymbol} ({escrow.mintDecimals} decimals)</span>
            </div>
          )}

          <Field label="Amount to Escrow">
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="0.0"
              value={escrow.amount}
              onChange={(e) => escrow.setAmount(e.target.value)}
              disabled={!canEscrow || !escrow.isValidMint || escrow.submitting}
            />
          </Field>

          <button
            onClick={escrow.submitEscrow}
            disabled={!canEscrow || !escrow.isValidMint || escrow.submitting || !escrow.amount}
            className="w-full flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white disabled:opacity-50 transition-all gap-1.5 cursor-pointer"
          >
            {escrow.submitting ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {escrow.submitting ? "Confirming..." : "Escrow Token"}
          </button>

          {escrow.error && <p className="text-[11px] text-red-400 mt-1">{escrow.error}</p>}
          {escrow.successSig && (
            <p className="text-[11px] text-emerald-400 mt-1">
              Confirmed!{" "}
              <a
                href={explorerTxUrl(escrow.successSig)}
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-0.5 font-semibold"
              >
                View Tx <ExternalLink className="size-3" />
              </a>
            </p>
          )}
        </div>
      </div>
      {/* Escrowed List */}
      <TokenVaultList
        tokenVaultsCount={tokenVaults.length}
        vaultDisplays={vaultDisplays}
        loadingBalances={loadingBalances}
        refreshBalances={refreshBalances}
        hasOwnerKey={!!vault.publicKey}
        isActive={isActive}
        onRemove={escrowRemove.submitRemove}
        removing={escrowRemove.removing}
        removeError={escrowRemove.error}
        removeSuccessSig={escrowRemove.successSig}
      />
    </div>
  );
};
