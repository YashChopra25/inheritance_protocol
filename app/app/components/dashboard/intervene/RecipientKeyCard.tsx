"use client";

import { FC, useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useVault } from "@/hooks/useVault";
import { useVaultIdentity } from "@/hooks/useVaultSession";
import { humanizeError } from "@/lib/utils";
import { useAppDispatch } from "@/app/store/hooks";
import { loadWill } from "@/app/store/willSlice";
import { loadMyRoles } from "@/app/store/rolesSlice";

/**
 * Lets an heir publish the encryption key their inherited documents are sealed
 * to (C5).
 *
 * This is a prerequisite, not a nicety: the owner seals each document to the
 * recipients that exist *at upload time*, so an heir who registers late cannot
 * open anything uploaded before they did. The card therefore states that
 * plainly rather than presenting registration as optional.
 *
 * The secret half is derived from a wallet signature and never leaves the
 * browser — the server, the pinning service and the chain only ever see the
 * public half.
 */

interface RecipientKeyCardProps {
  /** Owner of the will this heir is named on. */
  ownerAddress: string;
  /**
   * Why registration is unavailable, if it is. The program only accepts a key
   * while the will is Active (the key is frozen once death confirmation is in
   * flight), so the parent passes a reason instead of letting the transaction
   * revert.
   */
  disabledReason?: string;
}

function sameKey(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export const RecipientKeyCard: FC<RecipientKeyCardProps> = ({
  ownerAddress,
  disabledReason,
}) => {
  const vault = useVault();
  const { unlockVerified, identity } = useVaultIdentity();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);

  const me = vault.publicKey?.toBase58() ?? null;

  const registered = useQuery({
    queryKey: ["recipientKey", ownerAddress, me],
    enabled: !!me,
    queryFn: async () => {
      const owner = new PublicKey(ownerAddress);
      const will = vault.willPda(owner);
      const beneficiary = vault.beneficiaryPda(will, vault.publicKey!);
      const account =
        await vault.program.account.beneficiary.fetchNullable(beneficiary);
      if (!account) return null;
      const key = Uint8Array.from(account.encryptionPubkey ?? []);
      return key.length === 32 && key.some((b) => b !== 0) ? key : null;
    },
  });

  const onRegister = useCallback(async () => {
    setBusy(true);
    const id = toast.loading("Deriving your document key…");
    try {
      // Two signatures that must match: a key the wallet cannot reproduce
      // would be published on-chain and lock this heir out for good.
      const derived = await unlockVerified();
      toast.loading("Publishing your public key on-chain…", { id });
      await vault.registerRecipientKey(
        new PublicKey(ownerAddress),
        derived.publicKey
      );
      toast.success(
        "Key registered. Documents uploaded from now on can be opened by you — ask the owner to re-seal anything uploaded earlier.",
        { id }
      );
      // The key also feeds the roles list (`hasEncryptionKey`) and the owner's
      // will bundle (which heirs can be sealed to), so refresh all three.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["recipientKey", ownerAddress, me],
        }),
        dispatch(loadWill({ program: vault.program, owner: new PublicKey(ownerAddress) })),
        vault.publicKey &&
          dispatch(loadMyRoles({ program: vault.program, wallet: vault.publicKey })),
      ]);
    } catch (e) {
      toast.error(humanizeError(e), { id });
    } finally {
      setBusy(false);
    }
  }, [unlockVerified, vault, ownerAddress, queryClient, me, dispatch]);

  if (!me || registered.isLoading) return null;

  const hasKey = !!registered.data;
  // Only knowable once this page has derived the key (any document open or a
  // registration does that). A mismatch means the wallet no longer reproduces
  // the published key, so documents sealed to it would not open.
  const mismatch =
    hasKey && !!identity && !sameKey(identity.publicKey, registered.data!);
  const canAct = !disabledReason;

  return (
    <div
      className={`rounded-xl border p-4 ${
        hasKey && !mismatch
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-amber-500/25 bg-amber-500/5"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {hasKey && !mismatch ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-400" />
          )}
          <div>
            <p
              className={`text-sm font-medium ${
                hasKey && !mismatch ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {mismatch
                ? "Your wallet no longer matches your registered key"
                : hasKey
                  ? "Your document key is registered"
                  : "Register your document key"}
            </p>
            <p
              className={`mt-1 max-w-xl text-xs leading-relaxed ${
                hasKey && !mismatch
                  ? "text-emerald-200/75"
                  : "text-amber-200/80"
              }`}
            >
              {mismatch
                ? "The key this wallet derives now differs from the one published on-chain, so documents sealed to the old key will not open here. Re-register, then ask the owner to re-seal their documents."
                : hasKey
                ? "Documents this vault owner uploads from now on are sealed so that you can open them. Nobody else — not this app, not the storage provider — can."
                : "Documents are encrypted for specific recipients when they are uploaded. Until you register, anything uploaded to this vault can never be opened by you, even after you inherit it."}
            </p>
          </div>
        </div>

        {(!hasKey || mismatch) && canAct && (
          <button
            type="button"
            onClick={onRegister}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/90 px-4 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Registering…" : mismatch ? "Re-register key" : "Register key"}
          </button>
        )}
        {(!hasKey || mismatch) && !canAct && (
          <p className="max-w-xs text-[11px] leading-relaxed text-amber-200/70">
            {disabledReason}
          </p>
        )}
      </div>
    </div>
  );
};
