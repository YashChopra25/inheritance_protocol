"use client";

import { FC } from "react";
import { useDemoState, shorten, formatDuration } from "@/hooks/useDemoState";
import { Field } from "./Field";
import { SimulateDeathToggle } from "./SimulateDeathToggle";
import { DemoInfo } from "./DemoInfo";

export const Demo: FC = () => {
  const {
    state,
    progress,
    remainingMs,
    statusMeta,
    connect,
    ping,
    simulateDeath,
    claim,
    reset,
    setBeneficiary,
    setAmount,
    setIntervalDays,
  } = useDemoState();

  return (
    <section id="demo" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <DemoInfo log={state.log} />

          <div className="rounded-2xl glass-strong glow-ring p-5 sm:p-7">
            <div className="flex items-center justify-between rounded-xl bg-white/3 border border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-linear-to-br from-[#ab9ff2] to-[#7e6df0]">
                  <svg viewBox="0 0 24 24" className="size-5" fill="white">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 5 3.667 9.142 8.461 9.878.347-.108.633-.31.844-.587.176-.236.317-.604.317-1.143v-2.293s-.49.088-1.07.088c-1.71 0-2.444-1.502-2.444-1.502-.484-1.227-1.18-1.554-1.18-1.554-.967-.66.073-.647.073-.647 1.067.075 1.629 1.097 1.629 1.097.95 1.628 2.49 1.158 3.098.885.096-.689.372-1.158.677-1.424-2.36-.268-4.844-1.18-4.844-5.252 0-1.16.415-2.108 1.095-2.852-.11-.268-.475-1.35.105-2.81 0 0 .892-.286 2.925 1.09a10.18 10.18 0 0 1 2.665-.358c.905.004 1.815.122 2.665.358 2.03-1.376 2.92-1.09 2.92-1.09.585 1.46.22 2.542.11 2.81.68.744 1.09 1.692 1.09 2.852 0 4.082-2.488 4.98-4.856 5.243.382.33.722.972.722 1.96 0 1.416-.013 2.557-.013 2.905 0 .547.14.92.317 1.155.215.282.5.482.85.585A10.005 10.005 0 0 0 22 12Z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-muted">Wallet</div>
                  <div className="text-sm font-mono">{state.connected ? shorten(state.wallet) : "Not connected"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {state.connected ? (
                  <div className="text-right">
                    <div className="text-xs text-muted">Sealed</div>
                    <div className="text-sm font-mono">8 docs · IPFS</div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={connect}
                    disabled={state.connecting}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {state.connecting ? "Connecting…" : "Connect Phantom"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Beneficiary address">
                <input
                  type="text"
                  value={state.beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-transparent font-mono text-[12px] outline-none placeholder:text-muted"
                  placeholder="9xVu…"
                />
              </Field>
              <Field label="Allocation (%)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent font-mono text-sm outline-none"
                />
                <span className="text-xs text-muted font-mono">of estate</span>
              </Field>
              <Field label="Inactivity window">
                <div className="flex w-full items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={365}
                    value={state.intervalDays}
                    onChange={(e) => setIntervalDays(Number(e.target.value))}
                    className="flex-1 accent-[var(--accent)]"
                  />
                  <span className="font-mono text-sm tabular-nums w-16 text-right">{state.intervalDays}d</span>
                </div>
              </Field>
              <Field label="Custodian quorum">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-mono">2 of 3</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--neon)]">
                    <span className="size-1.5 rounded-full bg-[var(--neon)] shadow-[0_0_8px_#9efce0]" />
                    required
                  </span>
                </div>
              </Field>
            </div>

            <div className="mt-6 rounded-xl bg-white/[0.03] border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full ${statusMeta.bg} ${statusMeta.border} border px-3 py-1 text-xs ${statusMeta.text}`}>
                    <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                    {statusMeta.label}
                  </span>
                  <span className="text-xs text-muted">
                    {state.lastPingMs
                      ? `Last check-in ${new Date(state.lastPingMs).toLocaleTimeString([], { hour12: false })}`
                      : "No check-ins yet"}
                  </span>
                </div>
                <SimulateDeathToggle
                  active={state.status === "triggered" || state.status === "claimed"}
                  onTrigger={simulateDeath}
                  disabled={!state.connected || state.status === "claimed"}
                />
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Time until claimable</p>
                  <p className="mt-1 font-mono text-2xl sm:text-3xl tabular-nums">
                    {state.status === "triggered" || state.status === "claimed"
                      ? "00d 00h 00m 00s"
                      : state.lastPingMs
                      ? formatDuration(remainingMs)
                      : `${state.intervalDays.toString().padStart(2, "0")}d 00h 00m 00s`}
                  </p>
                </div>
                <div className="hidden sm:block text-right text-xs text-muted">
                  Window: <span className="font-mono">{state.intervalDays}d</span>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="relative h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(progress * 100, state.lastPingMs ? 4 : 0)}%`,
                    background:
                      state.status === "triggered" || state.status === "claimed"
                        ? "linear-gradient(90deg,#ff6b9a,#b794ff)"
                        : state.status === "at-risk"
                        ? "linear-gradient(90deg,#ffb86b,#ff6b9a)"
                        : "linear-gradient(90deg,#9efce0,#b794ff 60%,#6c46ff)",
                  }}
                >
                  <div className="absolute inset-0 animate-shimmer rounded-full" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={ping}
                disabled={!state.connected || state.pinging || state.status === "triggered" || state.status === "claimed"}
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.pinging ? "Signing…" : "Check in"}
              </button>

              {state.status === "triggered" && (
                <button
                  type="button"
                  onClick={claim}
                  disabled={state.claiming}
                  className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium bg-gradient-to-r from-[#ff6b9a] to-[#b794ff] text-white shadow-[0_10px_30px_-10px_rgba(255,107,154,0.5)] hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.claiming ? "Claiming…" : "Claim as beneficiary →"}
                </button>
              )}

              {state.status === "claimed" && (
                <span className="inline-flex items-center gap-2 text-sm text-[var(--neon)]">
                  <svg viewBox="0 0 16 16" className="size-4" fill="none">
                    <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Documents unlocked for beneficiary
                </span>
              )}

              <button
                type="button"
                onClick={reset}
                className="ml-auto text-xs text-muted hover:text-foreground transition-colors"
              >
                Reset simulation
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
