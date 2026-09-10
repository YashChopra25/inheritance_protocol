"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { KeyRound, Users } from "lucide-react";
import { useVault } from "@/hooks/useVault";
import { useParsedKey } from "@/hooks/useParsedKey";
import { MAX_ALLOCATION_BPS } from "@/lib/config";
import { Field, Input, TxButton, short } from "../shared/ui";
import { KeyList, type KeyListBadge } from "../shared/KeyList";
import { AllocationBar, allocationColor } from "./AllocationBar";

interface BeneficiaryRow {
  publicKey: PublicKey;
  account: {
    wallet: PublicKey;
    allocationPercentage: number;
    hasClaimed: boolean;
    encryptionPubkey: number[];
  };
}

interface BeneficiaryManagerProps {
  refresh: () => void;
  beneficiaries: BeneficiaryRow[];
  totalBps: number;
  isActive: boolean;
}

/** An all-zero key is the on-chain sentinel for "never registered". */
function hasPublishedKey(bytes: number[] | undefined): boolean {
  if (!bytes) return false;
  const arr = Uint8Array.from(bytes);
  return arr.length === 32 && arr.some((b) => b !== 0);
}

export const BeneficiaryManager: FC<BeneficiaryManagerProps> = ({
  refresh,
  beneficiaries,
  totalBps,
  isActive,
}) => {
  const vault = useVault();
  const [addr, setAddr] = useState("");
  const [pct, setPct] = useState("10");
  const parsed = useParsedKey(addr);

  const bps = Math.round(Number(pct) * 100);
  const remainingBps = MAX_ALLOCATION_BPS - totalBps;
  const remaining = remainingBps / 100;
  const unkeyed = beneficiaries.filter(
    (b) => !hasPublishedKey(b.account.encryptionPubkey),
  );

  const duplicate =
    !!parsed && beneficiaries.some((b) => b.account.wallet.equals(parsed));
  const isSelf = !!parsed && !!vault.publicKey && parsed.equals(vault.publicKey);
  const exceeds = bps > 0 && totalBps + bps > MAX_ALLOCATION_BPS;

  // Each of these mirrors something the program or the model would reject, so
  // the reason is stated before the wallet ever opens.
  const problem = !addr
    ? null
    : !parsed
      ? "That is not a valid Solana address."
      : duplicate
        ? `${short(parsed)} is already an heir on this will. Remove them first to change their share.`
        : bps <= 0
          ? "Give this heir a share above 0%."
          : exceeds
            ? `That would take the estate to ${(totalBps + bps) / 100}%. Only ${remaining}% is left to assign.`
            : null;

  const valid = !!parsed && !problem;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Beneficiaries &amp; Shares
          </h3>
          <p className="mt-1 text-xs text-muted">
            Name the heirs who inherit your estate and set how the escrowed
            tokens divide between them.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-white/[0.02] px-3 py-2">
          <Users className="size-3.5 text-[var(--accent)]" />
          <span className="font-mono text-xs font-semibold text-[var(--accent)]">
            {beneficiaries.length}{" "}
            {beneficiaries.length === 1 ? "heir" : "heirs"}
          </span>
        </div>
      </div>

      <AllocationBar
        slices={beneficiaries.map((b) => ({
          wallet: b.account.wallet,
          bps: b.account.allocationPercentage,
        }))}
        totalBps={totalBps}
      />

      {/* C5: documents are sealed to the recipients that exist at upload time,
          so an heir without a key is unreachable for anything uploaded now —
          and it cannot be fixed afterwards. */}
      {unkeyed.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {unkeyed.length}{" "}
              {unkeyed.length === 1 ? "heir has" : "heirs have"} no document key
              yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              Documents are encrypted for named recipients at the moment you
              upload them. Until{" "}
              {unkeyed.length === 1 ? "this heir registers" : "these heirs register"}{" "}
              a key, anything you seal from now on can never be opened by{" "}
              {unkeyed.length === 1 ? "them" : "them"} — and it cannot be shared
              retroactively. Ask them to open this vault in their own wallet and
              register, then upload.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-black/10 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] sm:items-end">
          <Field label="Beneficiary wallet address">
            <Input
              placeholder="e.g. 9xVuPq3Tn8e..."
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              disabled={!isActive}
            />
          </Field>
          <div>
            <Field label="Allocation share (%)">
              <Input
                type="number"
                min={0.01}
                max={remaining}
                step={0.01}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                disabled={!isActive}
              />
            </Field>
            {remainingBps > 0 && (
              <button
                type="button"
                onClick={() => setPct(String(remaining))}
                disabled={!isActive}
                className="mt-1 text-[10px] font-semibold text-[var(--accent)] underline disabled:opacity-50"
              >
                Assign the remaining {remaining}%
              </button>
            )}
          </div>
        </div>

        {problem && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-300">
            {problem}
          </p>
        )}

        {isSelf && !problem && (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/85">
            That is your own wallet. It is allowed, but this share only becomes
            claimable after custodians confirm your passing — at which point you
            are not the one claiming it.
          </p>
        )}

        <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 text-[11px] leading-relaxed text-[var(--accent)]">
          <span className="font-semibold">Heads up:</span> this percentage sets
          the heir&apos;s share of your{" "}
          <span className="font-semibold">escrowed tokens only</span>. All
          uploaded documents &amp; media are shared with every beneficiary in
          full, regardless of percentage.
        </div>

        <TxButton
          disabled={!isActive || !valid}
          title={
            !isActive ? "Actions are only allowed when the will is active" : ""
          }
          action={() => vault.addBeneficiary(parsed!, bps)}
          onDone={() => {
            setAddr("");
            refresh();
          }}
        >
          {valid ? `Add heir with ${bps / 100}% share` : "Add beneficiary share"}
        </TxButton>
      </div>

      <div className="mt-2">
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">
          Named heirs ({beneficiaries.length})
        </h4>
        <KeyList
          items={beneficiaries.map((b, i) => {
            const keyed = hasPublishedKey(b.account.encryptionPubkey);
            const badges: KeyListBadge[] = [
              {
                label: `${b.account.allocationPercentage / 100}% of tokens`,
                style: "accent",
              },
            ];
            if (b.account.hasClaimed) {
              badges.push({
                label: "Claimed",
                style: "success",
                title: "This heir has recorded their claim on-chain.",
              });
            }
            badges.push(
              keyed
                ? {
                    label: "Key registered",
                    style: "success",
                    title:
                      "Documents you upload are sealed so this heir can open them.",
                  }
                : {
                    label: "No document key",
                    style: "warn",
                    title:
                      "Anything uploaded before this heir registers a key can never be opened by them.",
                  },
            );
            return {
              key: b.publicKey.toBase58(),
              wallet: b.account.wallet,
              swatch: allocationColor(i),
              badges,
              detail: keyed
                ? undefined
                : "Ask them to connect their wallet to this vault and register a document key before you upload.",
            };
          })}
          onRemove={(wallet) => vault.removeBeneficiary(wallet)}
          refresh={refresh}
          disabled={!isActive}
          empty="No beneficiaries added. Specify who inherits your legacy."
        />
      </div>
    </div>
  );
};
