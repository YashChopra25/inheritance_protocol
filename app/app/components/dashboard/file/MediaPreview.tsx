"use client";

import { FC, useState } from "react";
import { toast } from "sonner";
import { useMediaContent } from "@/hooks/useMediaContent";
import { MediaContentViewer } from "./MediaContentViewer";
import { DocumentDialog } from "./DocumentDialog";
import { formatBytes } from "@/lib/utils";

interface MediaPreviewProps {
  cid: string;
  onClose: () => void;
}

export const MediaPreview: FC<MediaPreviewProps> = ({ cid, onClose }) => {
  // Name, type and size all come out of the sealed container after decryption —
  // the on-chain media type is deliberately just "application/vseal", because
  // publishing the real type would leak what the document is (C5).
  const {
    loading,
    error,
    objectUrl,
    textPreview,
    fileName,
    mimeType,
    fileSize,
    downloadFile,
    downloadSealedBackup,
  } = useMediaContent(cid);
  const [backingUp, setBackingUp] = useState(false);

  const onBackup = async () => {
    setBackingUp(true);
    try {
      await downloadSealedBackup();
      toast.success(
        "Encrypted backup saved. Only a recipient's wallet can open it — keep it anywhere, or re-pin it to any IPFS node."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackingUp(false);
    }
  };
  const mediaType = mimeType ?? "application/octet-stream";

  return (
    <DocumentDialog
      title={<span className="block truncate max-w-md">{fileName ?? "Sealed document"}</span>}
      subtitle={`CID: ${cid}`}
      onClose={onClose}
      widthClass="max-w-3xl"
    >
      {/* Content Viewport */}
      <div className="flex flex-col items-center justify-center min-h-[250px] max-h-[60vh] overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-border-strong border-t-accent shrink-0" />
            <p className="text-xs text-muted animate-pulse">
              Fetching and decrypting…
            </p>
          </div>
        )}

        {error && (
          <div className="text-center p-4 max-w-md">
            <svg className="mx-auto size-12 text-red-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h4 className="mt-3 text-sm font-medium text-foreground">Cannot open this document</h4>
            <p className="mt-1 text-xs text-muted">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="w-full flex items-center justify-center">
            <MediaContentViewer
              cid={cid}
              mediaType={mediaType}
              objectUrl={objectUrl}
              textPreview={textPreview}
              downloadFile={downloadFile}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
        <div className="text-muted">
          Type: <span className="font-mono text-foreground">{mediaType}</span>
          {fileSize != null && (
            <>
              {" · "}
              Size: <span className="font-mono text-foreground">{formatBytes(fileSize)}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!loading && !error && (
            <button
              onClick={() => void onBackup()}
              disabled={backingUp}
              title="Download the encrypted copy so this document does not depend on this app's storage"
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium btn-ghost cursor-pointer disabled:opacity-50"
            >
              {backingUp ? "Saving…" : "Encrypted backup"}
            </button>
          )}
          {objectUrl && (
            <button
              onClick={downloadFile}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium btn-ghost cursor-pointer"
            >
              Download
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium bg-white/10 hover:bg-white/15 text-foreground transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </DocumentDialog>
  );
};
