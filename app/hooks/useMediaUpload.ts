"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useVault } from "./useVault";
import { useVaultSession, useVaultIdentity } from "./useVaultSession";
import { sealFile, type Recipient } from "@/lib/crypto";
import type { ProgramItem } from "./useWill";
import type { BeneficiaryAccount } from "./useVault";

interface UseMediaUploadProps {
  mediaIndex: number;
  refresh: () => void;
  isActive: boolean;
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

function hasKey(bytes: number[] | Uint8Array | undefined): boolean {
  if (!bytes) return false;
  const arr = Uint8Array.from(bytes);
  return arr.length === 32 && arr.some((b) => b !== 0);
}

export function useMediaUpload({
  mediaIndex,
  refresh,
  isActive,
  beneficiaries,
}: UseMediaUploadProps) {
  const vault = useVault();
  const session = useVaultSession();
  const { unlock } = useVaultIdentity();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  /**
   * Heirs who cannot be sealed to yet. Surfaced so the owner finds out BEFORE
   * uploading rather than after they are gone: a document sealed without an
   * heir can never be shared with them retroactively.
   */
  const unreachableHeirs: UnreachableHeir[] = beneficiaries
    .filter((b) => !hasKey(b.account.encryptionPubkey))
    .map((b) => ({ wallet: b.account.wallet.toBase58() }));

  async function onUpload() {
    if (!selectedFile) {
      setError("Choose a file first");
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

      // 2. Derive this wallet's document key and build the recipient set: the
      //    owner, plus every heir who has published a key.
      toast.loading("Unlocking your document key…", { id: toastId });
      const identity = await unlock();
      const ownerWallet = vault.publicKey?.toBase58();
      if (!ownerWallet) throw new Error("Connect a wallet first");

      const recipients: Recipient[] = [
        { wallet: ownerWallet, encryptionPublicKey: identity.publicKey },
        ...beneficiaries
          .filter((b) => hasKey(b.account.encryptionPubkey))
          .map((b) => ({
            wallet: b.account.wallet.toBase58(),
            encryptionPublicKey: Uint8Array.from(b.account.encryptionPubkey),
          })),
      ];

      // 3. Encrypt in the browser (C5). Nothing readable leaves this point.
      toast.loading(`Encrypting "${selectedFile.name}"…`, { id: toastId });
      setUploadProgress(10);
      const sealed = await sealFile(selectedFile, recipients);
      setUploadProgress(25);

      const sealedFile = new File(
        [sealed as BlobPart],
        `${selectedFile.name}.vseal`,
        { type: "application/octet-stream" }
      );

      // 4. Upload the ciphertext.
      const json = await new Promise<{ cid: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/ipfs/upload");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = 25 + Math.round((event.loaded / event.total) * 30);
            setUploadProgress(percent);
            toast.loading(`Uploading encrypted document (${percent}%)…`, {
              id: toastId,
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response from upload server"));
            }
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              reject(
                new Error(
                  errJson.error ?? `Upload failed with status ${xhr.status}`
                )
              );
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));

        const fd = new FormData();
        fd.append("file", sealedFile);
        xhr.send(fd);
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
        await vault.addMedia(json.cid, "application/vseal", mediaIndex);
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
