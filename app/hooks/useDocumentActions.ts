"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useVault } from "./useVault";
import { useVaultIdentity, useVaultSession } from "./useVaultSession";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  encodePublicKey,
  sealFile,
  sealedRecipients,
  unsealFile,
} from "@/lib/crypto";
import { checkCid } from "@/lib/cid";
import { fetchSealingContext } from "@/lib/willFetch";
import { mediaPda, willPda } from "@/lib/anchor";
import { recipientsFor } from "@/lib/recipients";
import {
  fetchSealedContainer,
  renamePin,
  unpinDocument,
  uploadSealedContainer,
} from "@/app/services/pinata.service";

/**
 * What a re-seal did. `resealed-old-copy-kept`: the new copy is recorded, but
 * retiring the old reference failed, so both are listed until it is removed.
 */
export type ResealOutcome = "unchanged" | "resealed" | "resealed-old-copy-kept";

/**
 * Owner-side document operations that span the chain and the pinning API.
 *
 * Each one signs in to the API first when needed — the routes all require a
 * session, and these are explicit user actions, so a wallet prompt is expected.
 */
export function useDocumentActions() {
  const vault = useVault();
  const session = useVaultSession();
  const { unlockVerified } = useVaultIdentity();
  const queryClient = useQueryClient();
  const { connection } = useConnection();

  /** Unpin `cid` only if the chain shows no reference at `index`. */
  const unpinIfUnreferenced = useCallback(
    async (cid: string, index: number) => {
      if (!vault.publicKey) return;
      try {
        const ref = mediaPda(willPda(vault.publicKey), index);
        const info = await connection.getAccountInfo(ref, "confirmed");
        if (!info) await unpinDocument(cid);
      } catch {
        // Unsure: keep the pin. An orphan costs storage; a wrongly deleted
        // document costs the estate.
      }
    },
    [vault.publicKey, connection]
  );

  const ensureSession = useCallback(async () => {
    if (!session.signedIn) await session.signIn();
    // `session` changes identity every render; only these two fields matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.signedIn, session.signIn]);

  /**
   * Remove a document: drop the on-chain reference, then unpin the ciphertext.
   *
   * Chain first, so a failed or rejected transaction leaves everything as it
   * was. The unpin is authorized by uploader (not by reference), so it still
   * works once the reference is gone; if it fails anyway the user is told,
   * instead of the old silent background request that never succeeded.
   */
  const removeDocument = useCallback(
    async (mediaIndex: number, cid: string): Promise<string> => {
      const sig = await vault.removeMedia(mediaIndex);
      try {
        await ensureSession();
        await unpinDocument(cid);
      } catch (err) {
        toast.warning(
          `Removed from your will, but the encrypted copy is still pinned: ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
      }
      return sig;
    },
    [vault, ensureSession]
  );

  const renameDocument = useCallback(
    async (cid: string, name: string) => {
      await ensureSession();
      await renamePin(cid, name);
      await queryClient.invalidateQueries({ queryKey: ["ipfs-metadata", cid] });
    },
    [ensureSession, queryClient]
  );

  /**
   * Re-seal a document to the owner plus every heir who has a key NOW.
   *
   * Sealing is fixed at upload time, so an heir who registered a key later can
   * never open older documents. This decrypts locally, re-encrypts under a
   * fresh data key, pins the new container, records it, and only then retires
   * the old reference and pin.
   *
   * Heirs and the next media slot are read fresh and strictly from the chain
   * (see `fetchSealingContext`), never from the dashboard cache. Recipients are
   * compared by KEY, not wallet: an heir who rotated their key needs a new copy
   * even though their wallet is already listed. Containers sealed before keys
   * were recorded are always re-sealed once, which upgrades them.
   */
  const resealDocument = useCallback(
    async (doc: { cid: string; mediaIndex: number }): Promise<ResealOutcome> => {
      const ownerKey = vault.publicKey;
      if (!ownerKey) throw new Error("Connect a wallet first");
      const owner = ownerKey.toBase58();
      await ensureSession();

      const container = await fetchSealedContainer(doc.cid);
      await checkCid(doc.cid, container);
      const identity = await unlockVerified();
      const { heirs, nextMediaIndex } = await fetchSealingContext(
        vault.program,
        ownerKey
      );
      const recipients = recipientsFor(owner, identity.publicKey, heirs);
      const current = new Set(
        sealedRecipients(container).map((r) => `${r.wallet}:${r.publicKey}`)
      );
      const upToDate = recipients.every((r) =>
        current.has(`${r.wallet}:${encodePublicKey(r.encryptionPublicKey)}`)
      );
      if (upToDate) return "unchanged";

      const plain = await unsealFile(container, identity, owner);
      const file = new File([plain.bytes as BlobPart], plain.name, {
        type: plain.mime,
      });
      const { cid } = await uploadSealedContainer(
        await sealFile(file, recipients)
      );

      try {
        await vault.addMedia(cid, "application/vseal", nextMediaIndex);
      } catch (txErr) {
        // Same orphan handling as a fresh upload: once the blockhash has
        // expired, a transaction that has not landed never will, so a pin with
        // no reference can be removed safely.
        setTimeout(() => void unpinIfUnreferenced(cid, nextMediaIndex), 90_000);
        throw txErr;
      }

      // The new copy is recorded. Failures below only leave the old copy
      // behind, which is redundant rather than harmful — report it as such
      // instead of as a failed re-seal.
      try {
        await vault.removeMedia(doc.mediaIndex);
      } catch {
        return "resealed-old-copy-kept";
      }
      await unpinDocument(doc.cid).catch(() => undefined);
      return "resealed";
    },
    [vault, ensureSession, unlockVerified, unpinIfUnreferenced]
  );

  return { removeDocument, renameDocument, resealDocument };
}
