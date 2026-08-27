"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { bytesToCid, fixedBytesToStr } from "@/lib/anchor";
import { MediaPreview } from "../file/MediaPreview";
import { PinataMetadataDisplay } from "../file/PinataMetadataDisplay";

interface InheritedDocumentsListProps {
  media: {
    publicKey: PublicKey;
    account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
  }[];
}

export const InheritedDocumentsList: FC<InheritedDocumentsListProps> = ({ media }) => {
  const [previewItem, setPreviewItem] = useState<{ cid: string; type: string } | null>(null);

  if (media.length === 0) {
    return <p className="text-xs text-muted">No media records found on this will.</p>;
  }

  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <h4 className="text-xs font-semibold text-white mb-2.5 uppercase tracking-wider">
        Inherited documents & assets ({media.length})
      </h4>
      <ul className="flex flex-col gap-2.5">
        {media
          .slice()
          .sort((a, b) => a.account.mediaIndex - b.account.mediaIndex)
          .map((m) => {
            const cid = bytesToCid(m.account.ipfsCid);
            const type = fixedBytesToStr(m.account.mediaType);
            return (
              <li
                key={m.publicKey.toBase58()}
                className="flex flex-col gap-1 rounded-lg border border-white/5 bg-black/20 px-3.5 py-2.5 text-xs transition-colors hover:bg-black/30"
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-mono text-[11px] text-white/80 block">
                      CID: {cid}
                    </span>
                    <span className="text-[10px] text-muted font-mono block mt-0.5">
                      #{m.account.mediaIndex} · On-chain Type: {type}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewItem({ cid, type })}
                      className="text-[11px] font-semibold text-accent hover:text-white transition-colors"
                    >
                      Preview Content
                    </button>
                    {/* No public-gateway link: documents are encrypted and
                        pinned privately, so a raw gateway URL would serve
                        nothing useful and would sidestep the access check.
                        Everything goes through the authorized viewer. */}
                  </div>
                </div>
                <PinataMetadataDisplay cid={cid} />
              </li>
            );
          })}
      </ul>

      {previewItem && (
        <MediaPreview
          cid={previewItem.cid}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};
