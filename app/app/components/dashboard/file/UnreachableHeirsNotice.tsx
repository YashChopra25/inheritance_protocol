import { FC } from "react";
import type { UnreachableHeir } from "@/hooks/useMediaUpload";

/** Warns the owner, before uploading, about heirs who cannot be sealed to yet. */
export const UnreachableHeirsNotice: FC<{ unreachableHeirs: UnreachableHeir[] }> = ({
  unreachableHeirs,
}) => (
  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
    <p className="text-sm font-medium text-amber-300">
      {unreachableHeirs.length}{" "}
      {unreachableHeirs.length === 1 ? "heir has" : "heirs have"} not set
      up a document key yet
    </p>
    <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
      Documents are sealed to each recipient at upload time, so anything
      you upload now cannot be opened by{" "}
      {unreachableHeirs.length === 1 ? "this heir" : "these heirs"} yet.
      Ask them to connect their wallet and register a key — then use
      &ldquo;Re-seal for current heirs&rdquo; on each document to extend it
      to them.
    </p>
    <ul className="mt-2 flex flex-col gap-0.5">
      {unreachableHeirs.map((h) => (
        <li key={h.wallet} className="font-mono text-[11px] text-amber-200/70">
          {h.wallet}
        </li>
      ))}
    </ul>
  </div>
);
