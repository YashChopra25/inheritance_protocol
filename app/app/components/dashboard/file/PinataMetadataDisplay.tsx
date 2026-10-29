"use client";

import { FC } from "react";
import { FileText } from "lucide-react";
import { usePinataMetadata } from "@/hooks/usePinataMetadata";
import { formatBytes } from "@/lib/utils";
import { SignInPrompt } from "./SignInPrompt";

interface PinataMetadataDisplayProps {
  cid: string;
}

/**
 * Pin facts for one document: label, sealed size and pin date. The real name
 * and type only appear after decrypting, in the preview.
 */
export const PinataMetadataDisplay: FC<PinataMetadataDisplayProps> = ({ cid }) => {
  const { data, isLoading, error, needsSignIn } = usePinataMetadata(cid);

  if (needsSignIn) {
    return (
      <div className="mt-2.5">
        <SignInPrompt what="document details" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-2.5 p-3 rounded-xl border border-border bg-white/[0.01] glass-strong flex items-center justify-between gap-3 animate-pulse">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="h-3 w-1/3 bg-white/10 rounded-full" />
          <div className="h-2.5 w-2/3 bg-white/5 rounded-full" />
        </div>
        <div className="size-4 rounded-full border border-border-strong border-t-accent animate-spin shrink-0" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-2.5 px-3 py-2 rounded-xl border border-border bg-white/[0.005] flex items-center gap-2 text-[10px] text-muted">
        <span className="inline-flex size-1.5 rounded-full bg-white/20" />
        <span>{error instanceof Error ? error.message : "Metadata unavailable for this CID"}</span>
      </div>
    );
  }

  const formattedDate = new Date(data.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mt-2.5 p-3.5 rounded-xl border border-border bg-white/[0.02] hover:bg-white/[0.03] transition-all duration-300 shadow-md flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded bg-accent/10 border border-accent/25 text-accent shrink-0">
          <FileText className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white/90 truncate">
            Sealed document
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            Name and type are revealed when you open it
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] font-semibold text-accent font-mono block">
          {formatBytes(data.size)}
        </span>
        <span className="text-[9px] text-muted block mt-0.5 font-mono">
          {formattedDate}
        </span>
      </div>
    </div>
  );
};
