import Link from "next/link";

export function FinalCta() {
  return (
    <section id="cta" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-24">
        <div className="relative overflow-hidden rounded-4xl glass-strong px-6 py-16 sm:px-16 sm:py-24 text-center">
          <div className="pointer-events-none absolute inset-0 subtle-grid opacity-60" />
          <div className="pointer-events-none absolute -top-32 left-1/2 size-120 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(108,70,255,0.45),transparent_60%)] blur-3xl" />

          <p className="relative text-xs uppercase tracking-[0.18em] text-neon">
            Final step
          </p>
          <h2 className="relative mt-3 text-4xl sm:text-5xl lg:text-6xl tracking-tight font-semibold gradient-text">
            Secure your legacy in minutes.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-muted">
            Connect a wallet, seal your documents, name your heirs and
            custodians. Stay active and nothing moves — go silent and your will
            does exactly what you wrote.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center rounded-xl px-6 text-sm font-medium btn-primary"
            >
              Launch App
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
              className="inline-flex h-12 items-center rounded-xl px-6 text-sm font-medium btn-ghost"
            >
              View Demo
            </Link>
          </div>

          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-neon shadow-[0_0_10px_#9efce0]" />
              Devnet open · Mainnet Q3
            </span>
            <span>•</span>
            <span>Audits: OtterSec, Neodyme</span>
            <span>•</span>
            <span>Source on Solana Explorer</span>
          </div>
        </div>
      </div>
    </section>
  );
}
