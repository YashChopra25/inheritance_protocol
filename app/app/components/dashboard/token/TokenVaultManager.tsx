"use client";

import { FC } from "react";
import { useVault } from "@/hooks/useVault";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useTokenEscrow, useTokenEscrowRemove } from "@/hooks/useTokenEscrow";
import { TokenEscrowForm } from "./TokenEscrowForm";
import { TokenVaultList } from "./TokenVaultList";
import { useDashboard } from "@/hooks/useDashboard";
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
  // H1: the program refuses to escrow into a will whose quorum can never be
  // met, so the form is disabled on exactly the condition the guard checks
  // rather than letting the user discover it as a failed transaction. The same
  // readiness object drives the checklist shown above this panel.
  const { readiness } = useDashboard();
  const canEscrow = isActive && readiness.canAddAssets;

  const {
    vaultDisplays,
    userTokens,
    solLamports,
    loading: loadingBalances,
    error: balancesError,
    refreshBalances,
  } = useTokenBalances(tokenVaults);

  // Both the will (vault accounts) and the balances change after a deposit or
  // withdrawal, so both are refetched.
  const refreshAll = () => {
    refresh();
    void refreshBalances();
  };

  const escrow = useTokenEscrow(refreshAll, userTokens, solLamports);
  const escrowRemove = useTokenEscrowRemove(vault.removeToken, refreshAll);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full items-start">
      <TokenEscrowForm
        escrow={escrow}
        userTokens={userTokens}
        solLamports={solLamports}
        canEscrow={canEscrow}
        readiness={readiness}
      />
      <TokenVaultList
        tokenVaultsCount={tokenVaults.length}
        vaultDisplays={vaultDisplays}
        loadingBalances={loadingBalances}
        loadError={balancesError ? balancesError.message : null}
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
