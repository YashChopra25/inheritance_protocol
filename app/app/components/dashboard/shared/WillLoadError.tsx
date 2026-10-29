"use client";

import { FC, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface WillLoadErrorProps {
  message: string;
  retry: () => Promise<void>;
  /**
   * `fatal`: nothing could be read, so the page must not render as if the
   * wallet had no will. `partial`: the will loaded but some lists did not, so
   * the page renders with a warning that those lists may be incomplete.
   */
  variant: "fatal" | "partial";
}

/**
 * Shown whenever the will could not be (fully) read from chain.
 *
 * Without this an RPC failure was indistinguishable from "you have no will":
 * pages rendered the "create your will" placeholder, and a failed custodian or
 * heir list showed up as silently empty.
 */
export const WillLoadError: FC<WillLoadErrorProps> = ({
  message,
  retry,
  variant,
}) => {
  const [busy, setBusy] = useState(false);
  const fatal = variant === "fatal";

  const onRetry = async () => {
    setBusy(true);
    try {
      await retry();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        fatal
          ? "border-red-500/30 bg-red-500/8"
          : "border-(--warn)/30 bg-(--warn)/10"
      }`}
    >
      <div className="flex gap-3">
        <AlertTriangle
          className={`mt-0.5 size-4 shrink-0 ${fatal ? "text-red-400" : "text-warn"}`}
        />
        <div className="text-xs leading-relaxed">
          <p className="font-semibold text-foreground">
            {fatal
              ? "Could not read your will from the network"
              : "Some of your will could not be loaded"}
          </p>
          <p className="mt-0.5 text-muted">
            {fatal
              ? "This is a connection problem, not a missing will — nothing has changed on-chain."
              : "Lists below may be incomplete until this loads."}{" "}
            <span className="font-mono">({message})</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-white/5 disabled:opacity-50"
      >
        <RotateCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
};
