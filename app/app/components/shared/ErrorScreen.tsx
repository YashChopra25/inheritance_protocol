"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

interface ErrorScreenProps {
  /** Small mono eyebrow, e.g. "Error" or "404". */
  code: string;
  title: string;
  children?: ReactNode;
  /** The thrown value, logged once to the console. Nothing is sent anywhere. */
  error?: unknown;
  /** Re-render the failed segment (Next's `retry`). Omit to hide the button. */
  retry?: () => void;
  /** Where the secondary link goes; the home page by default. */
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Shared body for `error.tsx`, `global-error.tsx` and `not-found.tsx`, in the
 * app's ledger style: hairline frame, mono eyebrow, one primary action.
 */
export function ErrorScreen({
  code,
  title,
  children,
  error,
  retry,
  homeHref = "/",
  homeLabel = "Back to home",
}: ErrorScreenProps) {
  useEffect(() => {
    if (error !== undefined) console.error(error);
  }, [error]);

  // Server Component errors arrive with only a generic message and a digest
  // that matches the server log; show the digest so a report can be traced.
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  return (
    <div className="relative flex min-h-[70vh] flex-1 items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0 subtle-grid" />
      <div className="relative w-full max-w-md border border-border bg-background">
        <div className="border-b border-border px-5 py-3.5">
          <p className="label-mono text-accent">{code}</p>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <h1 className="text-xl tracking-tight text-foreground">{title}</h1>
          {children && (
            <div className="text-sm leading-relaxed text-muted">{children}</div>
          )}
          {digest && (
            <p className="font-mono text-[11px] text-faint">ref: {digest}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {retry && (
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-10 items-center px-4 text-sm btn-primary"
              >
                Try again
              </button>
            )}
            <Link
              href={homeHref}
              className="inline-flex h-10 items-center px-4 text-sm btn-ghost"
            >
              {homeLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
