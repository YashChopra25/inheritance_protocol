const cases = [
  {
    tag: "Personal",
    title: "Key & seed-phrase escrow",
    body:
      "Seal encrypted recovery info on IPFS so heirs can reach your wallets and accounts — but only after custodians confirm you're gone.",
    metric: "Encrypted on IPFS",
  },
  {
    tag: "Documents",
    title: "Estate instructions",
    body:
      "Wills, deeds, insurance policies, and asset directories, hashed on-chain and released to the people you named.",
    metric: "Any file type",
  },
  {
    tag: "Messages",
    title: "Final words",
    body:
      "Letters, photos, and video for loved ones, delivered exactly when your custodians confirm — not a moment before.",
    metric: "Per-heir allocation",
  },
  {
    tag: "Business",
    title: "Succession & access",
    body:
      "Hand off credentials, ops runbooks, and signing instructions so a company keeps running if a key person goes dark.",
    metric: "M-of-N custodians",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              Use cases
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
              Built for anyone who can&apos;t afford to disappear.
            </h2>
          </div>
          <p className="text-sm text-muted max-w-sm">
            Four patterns we see most often. The protocol is general — your
            rules can be too.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cases.map((c) => (
            <article
              key={c.title}
              className="group relative overflow-hidden rounded-2xl glass p-6 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[rgba(183,148,255,0.5)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[var(--border-strong)] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                  {c.tag}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {c.metric}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-medium tracking-tight">
                {c.title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {c.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
