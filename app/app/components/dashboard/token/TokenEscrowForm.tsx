"use client";

import { FC } from "react";
import Link from "next/link";
import { Plus, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { Field, Input, explorerTxUrl } from "../shared/ui";
import { UserTokenList } from "./UserTokenList";
import type { useTokenEscrow } from "@/hooks/useTokenEscrow";
import type { UserTokenInfo } from "@/hooks/useTokenBalances";
import type { WillReadiness } from "@/lib/willReadiness";
import { formatUnits } from "@/lib/tokens";

interface TokenEscrowFormProps {
  escrow: ReturnType<typeof useTokenEscrow>;
  userTokens: UserTokenInfo[];
  /** Native SOL balance in lamports; null until loaded. */
  solLamports: number | null;
  canEscrow: boolean;
  readiness: WillReadiness;
}

/** Deposit form: pick a mint, review its risks, enter an exact amount. */
export const TokenEscrowForm: FC<TokenEscrowFormProps> = ({
  escrow,
  userTokens,
  solLamports,
  canEscrow,
  readiness,
}) => (
  <div className="md:col-span-2 rounded-2xl border border-border bg-white/[0.02] p-5 space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-foreground">Escrow New SPL Token</h3>
      <p className="text-[11px] text-muted mt-0.5">Register and deposit tokens — or native SOL, as wSOL — under your digital will.</p>
    </div>

    <div className="space-y-3.5">
      <Field label="SPL Token Mint Address">
        <div className="relative">
          <Input
            placeholder="Token mint address"
            value={escrow.mintAddress}
            onChange={(e) => escrow.setMintAddress(e.target.value.trim())}
            disabled={!canEscrow || escrow.submitting}
            className="w-full pr-8"
          />
          {escrow.checkingMint && (
            <RefreshCw className="absolute right-3 top-3 size-4 animate-spin text-muted" aria-label="Checking mint" />
          )}
        </div>
      </Field>

      <UserTokenList
        userTokens={userTokens}
        solLamports={solLamports}
        onSelect={(mint) => escrow.setMintAddress(mint)}
        selectedMint={escrow.mintAddress}
      />

      {!readiness.canAddAssets && (
        <div className="rounded-lg bg-[var(--warn)]/10 border border-[var(--warn)]/20 p-3 text-xs text-[var(--warn)] space-y-1">
          <span className="font-semibold block">Setup Required</span>
          <p className="text-[10px] opacity-80 leading-relaxed">{readiness.blockers[0]?.detail}</p>
          <Link
            href={readiness.blockers[0]?.href ?? "/dashboard/custodians"}
            className="inline-flex items-center gap-1 text-[10px] font-semibold underline"
          >
            {readiness.blockers[0]?.cta ?? "Add custodian"}
          </Link>
        </div>
      )}

      {escrow.isValidMint && (
        <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 p-2 text-xs text-[var(--accent)] flex items-center justify-between">
          <span>Token Resolved:</span>
          <span className="font-semibold">{escrow.mintSymbol} ({escrow.mintDecimals} decimals)</span>
        </div>
      )}

      {escrow.isNative && escrow.isValidMint && (
        <div className="rounded-lg border border-border bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted space-y-1">
          <p>
            <span className="font-semibold text-foreground">Native SOL is escrowed as wrapped SOL (wSOL).</span>{" "}
            Any wSOL you already hold is used first; the rest is wrapped from
            your SOL balance in the same transaction. Heirs receive wSOL, which
            any Solana wallet can unwrap back to SOL.
          </p>
          {escrow.wrapLamports !== null && escrow.wrapLamports > BigInt(0) && (
            <p className="font-mono text-foreground">
              Wrapping {formatUnits(escrow.wrapLamports, 9)} SOL
            </p>
          )}
        </div>
      )}

      {escrow.isValidMint && escrow.mintSevere.length > 0 && (
        <div role="alert" className="rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/40 p-2.5 text-[10px] text-[var(--danger)] space-y-2">
          {escrow.mintSevere.map((w) => (
            <p key={w} className="flex gap-1.5 items-start leading-relaxed">
              <AlertTriangle className="size-3 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
          <label className="flex items-center gap-2 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={escrow.severeAcknowledged}
              onChange={(e) => escrow.acknowledgeSevere(e.target.checked)}
              disabled={escrow.submitting}
            />
            I understand my heirs may receive less than their share.
          </label>
        </div>
      )}

      {escrow.isValidMint && escrow.mintWarnings.length > 0 && (
        <ul className="rounded-lg bg-[var(--warn)]/10 border border-[var(--warn)]/20 p-2.5 text-[10px] text-[var(--warn)] space-y-1">
          {escrow.mintWarnings.map((w) => (
            <li key={w} className="flex gap-1.5 items-start">
              <AlertTriangle className="size-3 shrink-0 mt-0.5" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <Field label="Amount to Escrow">
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={escrow.amount}
          onChange={(e) => escrow.setAmount(e.target.value)}
          disabled={!canEscrow || !escrow.isValidMint || escrow.submitting}
        />
      </Field>

      <button
        onClick={escrow.submitEscrow}
        disabled={
          !canEscrow ||
          !escrow.isValidMint ||
          !escrow.severeAcknowledged ||
          escrow.submitting ||
          !escrow.amount
        }
        className="w-full flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-foreground disabled:opacity-50 transition-all gap-1.5 cursor-pointer"
      >
        {escrow.submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        {escrow.submitting
          ? "Confirming..."
          : escrow.isNative
            ? "Wrap & Escrow SOL"
            : "Escrow Token"}
      </button>

      {escrow.error && <p role="alert" className="text-[11px] text-red-400 mt-1">{escrow.error}</p>}
      {escrow.success && (
        <p className="text-[11px] text-emerald-400 mt-1">
          {escrow.success.recovered
            ? "Confirmed (verified on-chain after a slow confirmation — do not resend)."
            : "Confirmed!"}{" "}
          {escrow.success.sig && (
            <a
              href={explorerTxUrl(escrow.success.sig)}
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-0.5 font-semibold"
            >
              View Tx <ExternalLink className="size-3" />
            </a>
          )}
        </p>
      )}
    </div>
  </div>
);
