"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { MediaPreview } from "./MediaPreview";
import { SealedDocumentRow } from "./SealedDocumentRow";
import { DocumentFilterBar } from "./DocumentFilterBar";
import { useSealedDocuments } from "@/hooks/useSealedDocuments";
import { RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { HeirKeyInfo } from "@/lib/recipients";
import { SignInPrompt } from "./SignInPrompt";

interface SealedDocumentsListProps {
  media: {
    publicKey: PublicKey;
    account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
  }[];
  isActive: boolean;
  /** Heirs with a registered key. */
  keyedHeirs: HeirKeyInfo[];
  refresh: () => void;
}

export const SealedDocumentsList: FC<SealedDocumentsListProps> = ({
  media,
  isActive,
  keyedHeirs,
  refresh,
}) => {
  const [previewItem, setPreviewItem] = useState<{ cid: string; type: string } | null>(null);

  const {
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    sortOrder,
    filteredMedia,
    hasFilters,
    clearFilters,
    toggleSort,
  } = useSealedDocuments(media);

  return (
    <div className="mt-2 space-y-4">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Your Sealed Documents ({filteredMedia.length})
        </h4>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] text-accent hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3" /> Clear filters
          </button>
        )}
      </div>

      {media.length > 0 && <SignInPrompt what="document labels, sizes and dates" />}

      <DocumentFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      {filteredMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-border bg-black/10">
          <p className="text-xs text-muted">
            {media.length === 0 ? "No documents sealed yet. Add items above." : "No documents match filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[350px] w-full border border-border bg-black/20 rounded-xl scrollbar-none">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-white/[0.01]">
                <th className="w-16 py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60 hidden md:table-cell text-center">
                  Index
                </th>
                <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60 min-w-[200px]">
                  Document
                </th>
                <th className="w-24 py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Size
                </th>
                <th
                  aria-sort={sortOrder === "newest" ? "descending" : sortOrder === "oldest" ? "ascending" : "none"}
                  className="w-32 py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:text-foreground hidden sm:table-cell select-none transition-colors"
                >
                  <button type="button" onClick={toggleSort} className="flex items-center gap-1.5 uppercase tracking-wider cursor-pointer">
                    <span>Sealed Date</span>
                    {sortOrder === "newest" ? (
                      <ArrowDown className="size-3 text-[var(--accent)]" />
                    ) : sortOrder === "oldest" ? (
                      <ArrowUp className="size-3 text-[var(--accent)]" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-30 hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </th>
                <th className="w-32 py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  CID
                </th>
                <th className="w-24 py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-white/60 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMedia
                .map(({ mediaItem }) => (
                  <SealedDocumentRow
                    key={mediaItem.publicKey.toBase58()}
                    mediaItem={mediaItem}
                    isActive={isActive}
                    keyedHeirs={keyedHeirs}
                    onPreview={(cid, type) => setPreviewItem({ cid, type })}
                    refresh={refresh}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {previewItem && (
        <MediaPreview
          cid={previewItem.cid}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};
