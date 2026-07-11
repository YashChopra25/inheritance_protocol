"use client";

import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { UploadProgressCard } from "./UploadProgressCard";
import { SealedDocumentsList } from "./SealedDocumentsList";
import { FileDropzone } from "./FileDropzone";

interface MediaManagerProps {
  will: { mediaIndex: number };
  refresh: () => void;
  media: {
    publicKey: PublicKey;
    account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
  }[];
  isActive: boolean;
}

export const MediaManager: FC<MediaManagerProps> = ({
  will,
  refresh,
  media,
  isActive,
}) => {
  const vault = useVault();

  const {
    selectedFile,
    setSelectedFile,
    busy,
    error,
    uploadProgress,
    onUpload,
  } = useMediaUpload({
    mediaIndex: will.mediaIndex,
    refresh,
    isActive,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Sealed Media & Documents
          </h3>
          <p className="text-xs text-white/60 mt-1">
            Upload credentials, legal papers, or digital assets. Files are pinned to IPFS and locked on-chain.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2 shrink-0">
          <span className="text-[10px] uppercase text-muted tracking-wider">Total Sealed</span>
          <span className="text-xs font-semibold text-[var(--accent)] font-mono">{media.length} Files</span>
        </div>
      </div>

      {/* Upload Target (On Top) */}
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
                <span className="size-3.5 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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

      {/* Sealed Files List (At the Bottom) */}
      <div className="min-w-0 pt-4 border-t border-white/5">
        <SealedDocumentsList
          media={media}
          isActive={isActive}
          onRemove={(index) => vault.removeMedia(index)}
          refresh={refresh}
        />
      </div>
    </div>
  );
};
