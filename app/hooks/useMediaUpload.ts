"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useConnection } from "@solana/wallet-adapter-react";
import { mediaPda, willPda } from "@/lib/anchor";
import { useVault } from "./useVault";
import { useVaultSession, useVaultIdentity } from "./useVaultSession";
import { MAX_DOCUMENT_BYTES, sealFile } from "@/lib/crypto";
import { fetchSealingContext } from "@/lib/willFetch";
import { heirsWithoutKey, recipientsFor } from "@/lib/recipients";
import {
  unpinDocument,
  uploadSealedContainer,
} from "@/app/services/pinata.service";
import type { ProgramItem } from "./useWill";
import type { BeneficiaryAccount } from "./useVault";

interface UseMediaUploadProps {
  refresh: () => void;
  isActive: boolean;
  /**
   * Whether the will's custodian quorum is reachable (`custodian_count > 0` and
   * `min_approvals <= custodian_count`). `add_media_reference` calls
   * `require_quorum_reachable`, so without this the upload would fail with
   * `QuorumUnreachable` (6025) — but only at the very last step, after the file
   * has been encrypted and pinned to IPFS.
   */
  canUpload: boolean;
  /**
   * The will's heirs. Every one who has published an encryption key gets a
   * sealed copy of this document's data key — that is what lets them open it
   * after the owner is gone, without the server ever holding a key.
   */
  beneficiaries: ProgramItem<BeneficiaryAccount>[];
}

/** An heir named on the will who has not published an encryption key yet. */
export interface UnreachableHeir {
  wallet: string;
}

export function useMediaUpload({
  refresh,
  isActive,
  canUpload,
  beneficiaries,
}: UseMediaUploadProps) {
  const vault = useVault();
  const { connection } = useConnection();
  const session = useVaultSession();
  const { unlockVerified } = useVaultIdentity();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  /**
   * Heirs who cannot be sealed to yet. Surfaced so the owner finds out BEFORE
   * uploading rather than after they are gone. Documents sealed without them
   * can be re-sealed later from the document list, once they register a key.
   */
  async function unpinIfUnreferenced(cid: string, index: number) {
    if (!vault.publicKey) return;
    try {
      const ref = mediaPda(willPda(vault.publicKey), index);
      const info = await connection.getAccountInfo(ref, "confirmed");
      if (!info) await unpinDocument(cid);
    } catch {
      // Leave the pin in place when unsure; an orphan costs storage, a wrongly
      // deleted document costs the estate.
    }
  }

  const unreachableHeirs: UnreachableHeir[] = heirsWithoutKey(
    beneficiaries
  ).map((wallet) => ({ wallet }));

  async function onUpload() {
    if (!selectedFile) {
      setError("Choose a file first");
      return;
    }
    // Before reading the file into memory: the server would refuse it anyway,
    // but only after the browser had encrypted and uploaded all of it.
    if (selectedFile.size > MAX_DOCUMENT_BYTES) {
      setError(
        `"${selectedFile.name}" is too large. The limit is ${Math.floor(
          MAX_DOCUMENT_BYTES / (1024 * 1024)
        )} MB.`
      );
      return;
    }
    // The program only accepts new media while the will is Active; catching it
    // here gives a readable message instead of a failed transaction.
    if (!isActive) {
      setError(
        "Documents can only be added while the will is active. It is currently in death confirmation."
      );
      return;
    }
    // Checked before any encryption or upload work: the on-chain guard runs in
    // the very last instruction, so failing it here saves the user from
    // encrypting and pinning a file that can never be recorded.
    if (!canUpload) {
      setError(
        "Add at least one custodian, and make sure the required approvals do not exceed the number of custodians, before sealing documents."
      );
      return;
    }

    setBusy(true);
    setError(null);
    setUploadProgress(0);
    const toastId = toast.loading("Preparing document…");

    try {
      // 1. Authenticate to our own API (C4). The upload route rejects anonymous
      //    callers, so do this before spending time on encryption.
      if (!session.signedIn) {
        toast.loading("Confirm the sign-in request in your wallet…", {
          id: toastId,
        });
        await session.signIn();
      }

      // 2. Derive this wallet's document key (checked to be reproducible —
      //    the owner's own copy is sealed to it) and build the recipient set:
      //    the owner, plus every heir who has published a key. Heirs are read
      //    fresh and strictly from the chain rather than from the dashboard's
      //    cached list, which degrades to empty on a failed load and would
      //    seal the document to nobody but the owner.
      toast.loading("Unlocking your document key…", { id: toastId });
      const identity = await unlockVerified();
      const ownerKey = vault.publicKey;
      if (!ownerKey) throw new Error("Connect a wallet first");
      const { heirs, nextMediaIndex } = await fetchSealingContext(
        vault.program,
        ownerKey
      );
      const recipients = recipientsFor(
        ownerKey.toBase58(),
        identity.publicKey,
        heirs
      );

      // 3. Encrypt in the browser (C5). Nothing readable leaves this point.
      toast.loading(`Encrypting "${selectedFile.name}"…`, { id: toastId });
      setUploadProgress(10);
      const sealed = await sealFile(selectedFile, recipients);
      setUploadProgress(25);

      // 4. Upload the ciphertext.
      const { cid } = await uploadSealedContainer(sealed, (fraction) => {
        const percent = 25 + Math.round(fraction * 30);
        setUploadProgress(percent);
        toast.loading(`Uploading encrypted document (${percent}%)…`, {
          id: toastId,
        });
      });

      // 5. Record the CID on-chain. The stored media type describes the
      //    CONTAINER, not the document — the real MIME type is encrypted inside
      //    it, so publishing it here would leak what the file is.
      setUploadProgress(60);
      toast.loading("Sign the transaction in your wallet…", { id: toastId });

      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 800);
      try {
        await vault.addMedia(cid, "application/vseal", nextMediaIndex);
      } catch (txErr) {
        // If nothing references the pin, remove it rather than leave an orphan
        // billed to the account forever. Checked against the chain first: a
        // confirmation TIMEOUT throws too, yet the transaction may have landed,
        // and unpinning a referenced document would destroy it. Best effort —
        // the transaction error is the one worth showing.
        // The check waits out the blockhash lifetime, after which a transaction
        // that has not landed never will.
        setTimeout(() => void unpinIfUnreferenced(cid, nextMediaIndex), 90_000);
        throw txErr;
      } finally {
        clearInterval(interval);
      }

      setUploadProgress(100);
      toast.success(
        `"${selectedFile.name}" encrypted and sealed on-chain for ${
          recipients.length
        } ${recipients.length === 1 ? "recipient" : "recipients"}.`,
        { id: toastId }
      );
      setSelectedFile(null);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg, { id: toastId });
      setError(msg);
      setUploadProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return {
    selectedFile,
    setSelectedFile,
    busy,
    error,
    uploadProgress,
    unreachableHeirs,
    onUpload,
  };
}
