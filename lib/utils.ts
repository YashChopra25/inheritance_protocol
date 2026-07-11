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
