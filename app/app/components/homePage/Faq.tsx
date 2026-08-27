"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Does VaultWill hold my crypto?",
    a: "No. The program never custodies SOL, SPL tokens, or NFTs. It stores the content hashes (IPFS CIDs) of the files you seal, your beneficiaries and their allocation splits, and your custodians. What your heirs inherit is access to the encrypted payload you uploaded — not funds moved by the contract.",
  },
  {
    q: "What actually unlocks the will?",
    a: "Two gates. First, your inactivity window has to elapse — staying active keeps everything sealed. Then your custodians sign on-chain death confirmations; once the M-of-N quorum you set is reached, the will becomes Claimable and each beneficiary can claim.",
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
    a: "Any file type — documents, keys, images, video — pinned to IPFS. Encrypt it client-side before uploading; the chain only ever sees the CID and a short media-type tag, never the contents.",
  },
  {
    q: "What does it cost?",
    a: "Just Solana rent and fees. Each on-chain account (the will, each beneficiary, custodian, and media reference) is a small rent deposit that's refunded when you remove it or close the will. The protocol itself takes no fee.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative">
      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
            The questions everyone asks first.
          </h2>
        </div>

        <ul className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <li
                key={f.q}
                className={`rounded-2xl glass transition-colors ${
                  isOpen ? "border-[var(--border-strong)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left"
                >
                  <span className="text-[15px] sm:text-base font-medium">
                    {f.q}
                  </span>
                  <span
                    className={`grid size-7 place-items-center rounded-full border border-[var(--border-strong)] transition-transform ${
                      isOpen ? "rotate-45 bg-[rgba(183,148,255,0.15)]" : ""
                    }`}
                    aria-hidden
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                      {f.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
