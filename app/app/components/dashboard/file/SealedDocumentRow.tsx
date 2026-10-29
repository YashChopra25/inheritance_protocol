"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { bytesToCid, fixedBytesToStr } from "@/lib/anchor";
import { usePinataMetadata } from "@/hooks/usePinataMetadata";
import { useDocumentActions } from "@/hooks/useDocumentActions";
import { formatBytes } from "@/lib/utils";
import type { HeirKeyInfo } from "@/lib/recipients";
import { EditDocumentNameModal } from "./EditDocumentNameModal";
import { DeleteDocumentModal } from "./DeleteDocumentModal";
import { DocumentRowActions } from "./DocumentRowActions";
import { getFileIconConfig } from "./fileIcon";
import { documentLabel } from "@/lib/documentLabel";

interface SealedDocumentRowProps {
  mediaItem: {
    publicKey: PublicKey;
    account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
  };
  isActive: boolean;
  /** Heirs with a registered key; re-sealing extends the document to them. */
  keyedHeirs: HeirKeyInfo[];
  onPreview: (cid: string, type: string) => void;
  refresh: () => void;
}

const skeleton = (w: string) => <div className={`h-3 ${w} bg-white/10 rounded animate-pulse`} />;

export const SealedDocumentRow: FC<SealedDocumentRowProps> = ({
  mediaItem,
  isActive,
  keyedHeirs,
  onPreview,
  refresh,
}) => {
  const cid = bytesToCid(mediaItem.account.ipfsCid);
  const mediaIndex = mediaItem.account.mediaIndex;
  const type = fixedBytesToStr(mediaItem.account.mediaType);
  const { data, isLoading } = usePinataMetadata(cid);
  const { removeDocument, resealDocument } = useDocumentActions();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resealing, setResealing] = useState(false);

  const copyCid = () => {
    navigator.clipboard.writeText(cid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onReseal = async () => {
    setResealing(true);
    const toastId = toast.loading("Re-sealing for your current heirs…");
    try {
      const outcome = await resealDocument({ cid, mediaIndex });
      if (outcome === "unchanged") {
        toast.success("Already sealed to every heir with a key.", { id: toastId });
      } else if (outcome === "resealed") {
        toast.success("Re-sealed. Every heir with a key can now open it.", { id: toastId });
      } else {
        toast.warning(
          "Re-sealed — every heir with a key can open the new copy. The old copy could not be removed and is still listed; remove it from this list.",
          { id: toastId }
        );
      }
      if (outcome !== "unchanged") refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-seal failed", { id: toastId });
    } finally {
      setResealing(false);
    }
  };

  const label = documentLabel(data, mediaIndex);
  const formattedSize = data ? formatBytes(data.size) : "--";
  const formattedDate = data ? new Date(data.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "--";
  const { Icon: FileIcon, colorClass } = getFileIconConfig(type);

  return (
    <tr className="border-b border-border hover:bg-white/[0.01] transition-colors group">
      <td className="w-16 py-3 px-4 text-muted font-mono text-[11px] hidden md:table-cell text-center">#{mediaIndex}</td>
      <td className="py-3 px-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded border shrink-0 ${colorClass}`}>
            <FileIcon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? skeleton("w-28") : <div className="text-xs font-semibold text-white/90 truncate max-w-[200px]" title={label}>{label}</div>}
            <span className="text-[10px] text-muted truncate block max-w-[200px] font-mono">{type || "Unknown"}</span>
          </div>
        </div>
      </td>
      <td className="w-24 py-3 px-4 font-mono text-[11px] text-white/80">{isLoading ? skeleton("w-12") : formattedSize}</td>
      <td className="w-32 py-3 px-4 font-mono text-[11px] text-white/80 hidden sm:table-cell">{isLoading ? skeleton("w-20") : formattedDate}</td>
      <td className="w-32 py-3 px-4 font-mono text-[11px] text-muted">
        <div className="flex items-center gap-1.5 group/cid">
          <span className="truncate max-w-[80px]">{cid}</span>
          <button onClick={copyCid} aria-label="Copy CID" className="p-1 hover:bg-white/5 rounded text-muted hover:text-foreground transition-colors">
            {copied ? <Check className="size-3 text-[var(--neon)]" aria-hidden /> : <Copy className="size-3 opacity-0 group-hover/cid:opacity-100 group-focus-within/cid:opacity-100 transition-opacity" aria-hidden />}
          </button>
        </div>
      </td>
      <td className="w-24 py-3 px-4 text-right relative">
        <DocumentRowActions
          label={label}
          isActive={isActive}
          canReseal={keyedHeirs.length > 0}
          resealing={resealing}
          onPreview={() => onPreview(cid, type)}
          onEdit={() => setEditOpen(true)}
          onReseal={() => void onReseal()}
          onDelete={() => setDeleteOpen(true)}
        />
        {editOpen && <EditDocumentNameModal cid={cid} fileName={label} onClose={() => setEditOpen(false)} />}
        {deleteOpen && (
          <DeleteDocumentModal
            cid={cid}
            isActive={isActive}
            onRemove={() => removeDocument(mediaIndex, cid)}
            onClose={() => setDeleteOpen(false)}
            refresh={refresh}
          />
        )}
      </td>
    </tr>
  );
};
