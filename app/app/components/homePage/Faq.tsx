"use client";

import { useState } from "react";
import { ScrambleText } from "@/app/components/fx/ScrambleText";
import { SectionHead } from "./SectionHead";

const faqs = [
  {
    q: "Does VaultWill hold my crypto?",
    a: "Only what you choose to escrow. Tokens you deposit (SPL tokens, or SOL as wrapped SOL) sit in a vault owned by your will's program address — not by us — and you can withdraw them while the will is active. Everything else stays in your wallet. For documents, the program stores only IPFS content hashes, your beneficiaries and their splits, and your custodians.",
  },
  {
    q: "What actually unlocks the will?",
    a: "Three gates. First, your inactivity window has to elapse — only an explicit check-in from the dashboard resets it; ordinary wallet activity does not. Then your custodians sign on-chain death confirmations. Once the M-of-N quorum is reached, a 7-day grace period starts in which you can still revoke; after it, each beneficiary can claim.",
  },
  {
    q: "Who are custodians, and what can they see?",
    a: "Custodians are wallets you trust to confirm your passing. Their only power is to approve a death confirmation — they can't read your files, change beneficiaries, or move anything. You choose how many must agree (the min_approvals quorum) and can add or remove them anytime the will is active.",
  },
  {
    q: "Can I update beneficiaries and documents later?",
    a: "Yes. While the will is Active, you can add, remove, or reweight beneficiaries, add or remove media references, and swap custodians — each a single signed transaction. Once a quorum confirms death, the will freezes into its Claimable state.",
  },
  {
    q: "What can I store, and is it private?",
    a: "Any file type — documents, keys, images, video. Files are encrypted in your browser and the key is sealed to you and each heir who has registered a document key, then pinned to IPFS through this app's server. The chain only sees the CID and a short media-type tag. Note that a sealed heir holds a working key from upload onward, so only seal documents to people you trust with them; and keep your own copies, since pinning depends on the operator.",
  },
  {
    q: "What does it cost?",
    a: "Just Solana rent and network fees (including a small priority fee so transactions land). Each on-chain account is a rent deposit that's refunded when you remove it or the estate is closed. The protocol itself takes no fee. It currently runs on devnet only, with test funds.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-b border-border">
      <SectionHead eyebrow="FAQ" title="The questions everyone asks first." />

      <ul className="border-t border-border">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.q} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="group flex w-full items-baseline gap-5 px-5 py-5 text-left transition-colors hover:bg-[rgba(233,229,220,0.025)] sm:px-8"
              >
                <span className="index-mono shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[15px] font-medium">
                  <ScrambleText text={f.q} speed={52} />
                </span>
                <span
                  className={`shrink-0 font-mono text-sm transition-colors ${
                    isOpen ? "text-accent" : "text-muted group-hover:text-foreground"
                  }`}
                  aria-hidden
                >
                  {isOpen ? "[−]" : "[+]"}
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-3xl px-5 pb-6 pl-5 text-sm leading-relaxed text-muted sm:px-8 sm:pl-[76px]">
                    {f.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
