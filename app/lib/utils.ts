import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CLUSTER } from "./config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function explorerTxUrl(sig: string): string {
  const cluster = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/tx/${sig}${cluster}`;
}

export function humanizeError(e: unknown): string {
  if (e instanceof Error) {
    // Anchor wraps program errors; surface the readable message if present.
    const m = e.message;
    const match = m.match(/Error Message: (.+?)\./);
    if (match) return match[1];
    return m.length > 160 ? m.slice(0, 160) + "…" : m;
  }
  return "Transaction failed";
}

/** Anchor enums deserialize as `{ active: {} }`; return the lowercase variant name. */
export function willStatusLabel(status: object): string {
  return Object.keys(status)[0] ?? "unknown";
}

export function short(key: { toBase58: () => string } | string): string {
  const s = typeof key === "string" ? key : key.toBase58();
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** `93_784_000` ms → `"01d 02h 03m 04s"`. Padded for a monospace timer. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00d 00h 00m 00s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/**
 * `93_784_000` ms → `"1 day"`. The coarsest unit that still says something
 * useful, for prose where a ticking timer would be noise.
 */
export function formatRelativeDuration(ms: number): string {
  if (ms <= 0) return "0 minutes";
  const totalSec = Math.floor(ms / 1000);
  const plural = (n: number, unit: string) =>
    `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (totalSec >= 86400) return plural(Math.floor(totalSec / 86400), "day");
  if (totalSec >= 3600) return plural(Math.floor(totalSec / 3600), "hour");
  if (totalSec >= 60) return plural(Math.floor(totalSec / 60), "minute");
  return plural(totalSec, "second");
}
