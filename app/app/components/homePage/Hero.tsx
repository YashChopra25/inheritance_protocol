import Link from "next/link";
import { VaultVisual } from "./VaultVisual";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 subtle-grid" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-[var(--neon)] shadow-[0_0_10px_#9efce0]" />
              Live on Solana devnet · Audit in progress
            </span>
            <h1 className="mt-5 text-[44px] sm:text-6xl lg:text-[68px] leading-[1.04] tracking-tight font-semibold">
              <span className="gradient-text">Your digital will,</span>
              <br />
              <span className="gradient-text">enforced on-chain.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
              Seal documents, keys, and final messages on IPFS, name your heirs,
              and appoint trusted custodians. When you go silent and your
              custodians confirm it, your beneficiaries inherit access — no
              lawyers, no executor, no custody of your files.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center rounded-xl px-5 text-sm font-medium btn-primary"
              >
                Create Your Will
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className="ml-2"
                  fill="none"
                >
                  <path
                    d="M3 8h10m0 0-3.5-3.5M13 8l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="#demo"
                className="inline-flex h-12 items-center rounded-xl px-5 text-sm font-medium btn-ghost"
              >
                Try Demo
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-4 max-w-xl">
              {[
                { k: "Non-custodial", v: "100%" },
                { k: "Storage", v: "IPFS + on-chain" },
                { k: "Release", v: "M-of-N custodians" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl glass px-4 py-3.5">
                  <dt className="text-[11px] uppercase tracking-wider text-muted">
                    {s.k}
                  </dt>
                  <dd className="mt-1 text-base font-medium text-foreground">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <VaultVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
