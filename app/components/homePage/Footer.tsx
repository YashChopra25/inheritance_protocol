import { Logo } from "./Logo";

const cols: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Demo", href: "#demo" },
      { label: "Features", href: "#features" },
      { label: "Use cases", href: "#use-cases" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Security", href: "#security" },
      { label: "Audits", href: "#" },
      { label: "Open source", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#" },
      { label: "Whitepaper", href: "#" },
      { label: "FAQ", href: "#faq" },
      { label: "Brand kit", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_repeat(3,1fr)] gap-10">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted leading-relaxed">
              Decentralized inheritance on Solana. No lawyers. No custody. Just
              signed rules and chain time.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-xs uppercase tracking-wider text-muted">
                {c.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-xs text-muted">
          <p>© 2026 VaultWill Labs. Not legal advice.</p>
          <p>
            Built on <span className="text-foreground">Solana</span> · Devnet
            program{" "}
            <span className="font-mono text-foreground/80">VWiLLpr0t…aZ8</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
