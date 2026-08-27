const steps = [
  {
    n: "01",
    title: "Seal your will",
    body:
      "Upload documents, keys, and messages to IPFS, name beneficiaries with their allocation splits, and set your inactivity window — all on-chain.",
    bullets: ["Encrypted files on IPFS", "Weighted beneficiary splits", "Set the inactivity timer"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M4 7a3 3 0 0 1 3-3h7l6 6v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M14 4v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 14h6M9 17h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Appoint custodians",
    body:
      "Name trusted custodians and choose how many must agree before anything unlocks. They can only confirm your passing — never read or move your files.",
    bullets: ["M-of-N custodian quorum", "On-chain death confirmation", "Add or remove anytime"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M5.6 5.6a9 9 0 0 1 12.8 0M5.6 18.4a9 9 0 0 0 12.8 0M3 12h1.5M19.5 12H21"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Heirs inherit",
    body:
      "Once you've gone inactive and your custodian quorum confirms, the will turns claimable. Each beneficiary signs to unlock the IPFS payload — no executor, no intermediary.",
    bullets: ["Contract-enforced release", "Per-beneficiary claim", "Access to sealed documents"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="m8 12 3 3 5-6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
            Three steps. One signature each.
          </h2>
          <p className="mt-3 text-muted">
            VaultWill replaces lawyers, paperwork, and goodwill with a program
            that releases exactly what you sealed — to exactly who you named,
            exactly when your custodians confirm.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl glass p-6 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted">STEP {s.n}</span>
                <span className="grid size-9 place-items-center rounded-lg bg-[rgba(183,148,255,0.1)] text-[var(--accent)]">
                  {s.icon}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-medium tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {s.body}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-muted">
                    <span className="mt-1.5 size-1 rounded-full bg-[var(--accent)]" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {i < steps.length - 1 ? (
                <div className="absolute top-1/2 -right-2.5 hidden md:block">
                  <div className="h-px w-5 tick-line" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
