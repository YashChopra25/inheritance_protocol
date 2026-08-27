"use client";

import { useState, useCallback, type ReactNode } from "react";

export { explorerTxUrl, humanizeError, short } from "@/lib/utils";
import { explorerTxUrl, humanizeError } from "@/lib/utils";

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
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30 " +
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
      ? "btn-ghost text-red-300 border border-red-400/30"
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
        className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50 ${toneCls}`}
      >
        {busy ? "Submitting…" : children}
      </button>
      {msg && (
        <span
          className={`text-xs ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}
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
