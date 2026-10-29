import { CLUSTER } from "@/lib/config";

const LABELS: Record<string, string> = {
  devnet: "Devnet",
  testnet: "Testnet",
  localnet: "Localnet",
  "mainnet-beta": "Mainnet",
};

/**
 * Which Solana cluster the app talks to. Anything other than mainnet is shown
 * in the warning colour so nobody mistakes test funds for real ones (or
 * deposits real value into an unaudited preview).
 */
export function ClusterBadge({ className = "" }: { className?: string }) {
  const test = CLUSTER !== "mainnet-beta";
  return (
    <span
      title={test ? `Connected to Solana ${CLUSTER} — test network, no real funds` : "Solana mainnet"}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
        test ? "border-warn/50 text-warn" : "border-border text-muted"
      } ${className}`}
    >
      <span className={`size-1.5 rounded-full ${test ? "bg-warn" : "bg-neon"}`} />
      {LABELS[CLUSTER] ?? CLUSTER}
    </span>
  );
}
