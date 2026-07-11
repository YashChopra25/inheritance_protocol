import Link from "next/link";
import { Logo } from "./Logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#demo", label: "Demo" },
  { href: "#features", label: "Features" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mt-4 flex items-center justify-between rounded-2xl px-4 py-2.5 glass">
          <Link
            href="/"
            className="flex items-center"
            aria-label="VaultWill home"
          >
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <a
              href="#demo"
              className="hidden sm:inline-flex h-9 items-center rounded-lg px-3.5 text-sm btn-ghost"
            >
              Try Demo
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium btn-primary"
            >
              Launch App
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
