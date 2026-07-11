const features = [
  {
    title: "On-chain + IPFS",
    body:
      "Wills, beneficiaries, and custodians live in a Solana program; your files live on IPFS. Only the content hash is stored on-chain — read straight from the chain.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M4 7l8-4 8 4M4 7l8 4 8-4M12 11v8"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Custodian quorum",
    body:
      "Appoint trusted custodians and require M-of-N to confirm your passing before the will unlocks. No single party — including us — can trigger a release.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9 4.8-.6 8-4.5 8-9V6l-8-3Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="m9 12 2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Inactivity dead-man's switch",
    body:
      "Set the inactivity window that arms your will. Custodians can only confirm once you've gone quiet — staying active keeps everything sealed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M4 7h4M4 12h6M4 17h4M14 5l3 3-3 3M20 12l-3 3 3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Weighted beneficiaries",
    body:
      "Name multiple heirs, each with an allocation in basis points totalling up to 100%. Add, remove, or reweight them anytime while the will is active.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="17" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 19c.3-2.2 2-4 4.5-4 1.4 0 2.5.5 3 1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Transparent & auditable",
    body:
      "Every will update, custodian confirmation, and claim is a public transaction. Anyone — including your heirs — can verify the state.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    title: "Solana-fast and cheap",
    body:
      "Sealing a will, confirming death, and claiming each cost a fraction of a cent, with sub-second confirmation. Account rent is refunded when a will is closed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            Built for keeps
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
            Everything a will should be — and nothing it shouldn&apos;t.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl glass p-6 transition-all hover:translate-y-[-2px] hover:border-[var(--border-strong)]"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-[rgba(183,148,255,0.1)] text-[var(--accent)] transition-colors group-hover:bg-[rgba(183,148,255,0.18)]">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-medium tracking-tight">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
