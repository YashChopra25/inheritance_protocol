"use client";

import { useState, useCallback, type ReactNode } from "react";

export { explorerTxUrl, humanizeError, short } from "@/lib/utils";
import { explorerTxUrl, humanizeError } from "@/lib/utils";
import { ScrambleText } from "@/app/components/fx/ScrambleText";

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-border">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="font-mono text-[12px] uppercase tracking-[0.14em]">
          <ScrambleText text={title} speed={44} />
        </h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-3 p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-10 border border-border bg-transparent px-3 font-mono text-[13px] outline-none transition-colors focus:border-border-strong " +
        (props.className ?? "")
      }
    />
  );
}

type Tone = "primary" | "ghost" | "danger";

/**
 * A button that runs an async action, surfacing pending / success (with an
 * explorer link) / error states inline. On success it calls `onDone`.
 */
export function TxButton({
  children,
  action,
  onDone,
  tone = "primary",
  disabled,
  confirm,
  title,
}: {
  children: ReactNode;
  action: () => Promise<string>;
  onDone?: () => void;
  tone?: Tone;
  disabled?: boolean;
  confirm?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; sig?: string } | null>(
    null
  );

  const run = useCallback(async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setMsg(null);
    try {
      const sig = await action();
      setMsg({ kind: "ok", text: "Confirmed", sig });
      onDone?.();
    } catch (e) {
      setMsg({ kind: "err", text: humanizeError(e) });
    } finally {
      setBusy(false);
    }
  }, [action, onDone, confirm]);

  const toneCls =
    tone === "danger"
      ? "border border-danger/50 text-danger transition-colors hover:bg-danger hover:text-background"
      : tone === "ghost"
        ? "btn-ghost"
        : "btn-primary";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        title={title}
        className={`inline-flex h-10 items-center justify-center px-4 text-sm disabled:opacity-50 ${toneCls}`}
      >
        {busy ? "Submitting…" : children}
      </button>
      {msg && (
        <span
          className={`font-mono text-[11px] ${msg.kind === "ok" ? "text-neon" : "text-danger"}`}
        >
          {msg.text}
          {msg.sig && (
            <>
              {" — "}
              <a
                className="underline"
                href={explorerTxUrl(msg.sig)}
                target="_blank"
                rel="noreferrer"
              >
                view tx
              </a>
            </>
          )}
        </span>
      )}
    </div>
  );
}
