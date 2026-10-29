"use client";

import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { hasEncryptionKey } from "@/lib/recipients";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { UploadProgressCard } from "./UploadProgressCard";
import { SealedDocumentsList } from "./SealedDocumentsList";
import { FileDropzone } from "./FileDropzone";
import { UnreachableHeirsNotice } from "./UnreachableHeirsNotice";
import { UploadLockedNotice } from "./UploadLockedNotice";
import type { ProgramItem } from "@/hooks/useWill";
import type { BeneficiaryAccount } from "@/hooks/useVault";

interface MediaManagerProps {
  refresh: () => void;
  media: {
    publicKey: PublicKey;
    account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
  }[];
  isActive: boolean;
  /**
   * Whether the will's custodian quorum is reachable. The program's
   * `require_quorum_reachable` guard rejects `add_media_reference` when it is
   * not, so the upload controls are withheld rather than shown and left to
   * fail. The sealed list stays visible either way — a will can lose its quorum
   * (a custodian removed) long after documents were added to it.
   */
  canUpload: boolean;
  /** Heirs to seal each uploaded document to (C5). */
  beneficiaries: ProgramItem<BeneficiaryAccount>[];
}

export const MediaManager: FC<MediaManagerProps> = ({
  refresh,
  media,
  isActive,
  canUpload,
  beneficiaries,
}) => {
  const keyedHeirs = beneficiaries.filter((b) =>
    hasEncryptionKey(b.account.encryptionPubkey)
  );

  const {
    selectedFile,
    setSelectedFile,
    busy,
    error,
    uploadProgress,
    unreachableHeirs,
    onUpload,
  } = useMediaUpload({
    refresh,
    isActive,
    canUpload,
    beneficiaries,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Sealed Media & Documents
          </h3>
          <p className="text-xs text-white/60 mt-1">
            Upload credentials, legal papers, or digital assets. Files are
            encrypted in your browser before they leave it — only you and your
            heirs can ever open them.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-border px-3 py-2 shrink-0">
          <span className="text-[10px] uppercase text-muted tracking-wider">Total Sealed</span>
          <span className="text-xs font-semibold text-[var(--accent)] font-mono">{media.length} Files</span>
        </div>
      </div>

      {canUpload && unreachableHeirs.length > 0 && (
        <UnreachableHeirsNotice unreachableHeirs={unreachableHeirs} />
      )}

      {/* Upload Target (On Top) */}
      {!canUpload ? (
        <UploadLockedNotice />
      ) : (
      <div className="max-w-2xl mx-auto w-full space-y-4">
        <FileDropzone
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          busy={busy}
          isActive={isActive}
        />

        {selectedFile && (
          <button
            type="button"
            onClick={onUpload}
            disabled={busy || !isActive}
            className="w-full inline-flex h-10 items-center justify-center rounded-xl text-xs font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? (
              <>
                <span className="size-3.5 mr-2 rounded-full border-2 border-border-strong border-t-white animate-spin" />
                Sealing & Indexing…
              </>
            ) : (
              "Seal & Upload File"
            )}
          </button>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        {busy && <UploadProgressCard progress={uploadProgress} />}
      </div>
      )}

      {/* Sealed Files List (At the Bottom) */}
      <div className="min-w-0 pt-4 border-t border-border">
        <SealedDocumentsList
          media={media}
          isActive={isActive}
          keyedHeirs={keyedHeirs}
          refresh={refresh}
        />
      </div>
    </div>
  );
};
