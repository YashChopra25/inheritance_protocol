"use client";

import { FC, ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { Lock } from "lucide-react";
import type { WillBundle } from "@/hooks/useWill";
import type { ClaimTimeline, LockState } from "@/app/types/inheritance.types";
import type { useInheritedTokens } from "@/hooks/useInheritedTokens";
import { InheritedDocumentsList } from "../intervene/InheritedDocumentsList";
import { InheritedTokensList } from "./InheritedTokensList";
import { EstateTeardownCard } from "./EstateTeardownCard";
import { documentsReadable } from "@/lib/inheritance";

interface InheritedEstateSectionProps {
  owner: PublicKey;
  data: WillBundle;
  lock: LockState;
  timeline: ClaimTimeline;
  tokens: ReturnType<typeof useInheritedTokens>;
  refresh: () => void;
}

const Notice: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="rounded-xl border border-border bg-black/10 p-4 text-xs leading-relaxed text-muted">
    {children}
  </p>
);

/** What an heir can see of the estate itself: tokens, documents, teardown. */
export const InheritedEstateSection: FC<InheritedEstateSectionProps> = ({
  owner,
  data,
  lock,
  timeline,
  tokens,
  refresh,
}) => {
  if (lock !== "unlocked" || !data.will) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-black/10 p-4">
        <Lock className="size-4 shrink-0 text-muted" />
        <p className="text-xs leading-relaxed text-muted">
          {data.will?.mediaCount ?? 0} sealed{" "}
          {data.will?.mediaCount === 1 ? "file is" : "files are"} and{" "}
          {data.tokenVaults.length} token{" "}
          {data.tokenVaults.length === 1 ? "vault is" : "vaults are"} attached
          to this will. They are released here once custodians confirm the
          owner&apos;s passing and the grace period ends.
        </p>
      </div>
    );
  }

  // The server only serves an heir's documents once the grace period is over
  // (`lib/server/authz.ts`), exactly when claims open on-chain. Showing them
  // earlier only produced a list of 403s.
  const docsOpen = documentsReadable(timeline);

  return (
    <>
      <InheritedTokensList
        owner={owner}
        tokens={tokens.tokenDisplays}
        loading={tokens.loading}
        error={tokens.error}
        canClaim={timeline.canClaimNow}
        refresh={refresh}
      />
      {docsOpen ? (
        <>
          <InheritedDocumentsList media={data.media} />
          <Notice>
            Documents are not split: you can open, in full, every document
            sealed after you registered your encryption key. Your percentage
            only governs your share of the escrowed tokens above.
          </Notice>
        </>
      ) : (
        <Notice>
          {data.will.mediaCount} sealed{" "}
          {data.will.mediaCount === 1 ? "document becomes" : "documents become"}{" "}
          readable when the owner&apos;s grace period ends, at the same time
          claims open.
        </Notice>
      )}
      {timeline.phase === "closed" && (
        <EstateTeardownCard owner={owner} data={data} refresh={refresh} />
      )}
    </>
  );
};
