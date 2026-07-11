const pillars = [
  {
    title: "Non-custodial by design",
    body:
      "Your files, your keys. The contract never holds your data — only IPFS content hashes — and only the rules you signed can open it.",
  },
  {
    title: "Custodian-gated release",
    body:
      "The will turns claimable only after you go inactive and an M-of-N custodian quorum confirms. No off-chain authority can override it.",
  },
  {
    title: "Open & auditable logic",
    body:
      "Source verified on Solana Explorer. Two independent audits in progress (OtterSec and Neodyme).",
  },
  {
    title: "Owner stays in control",
    body:
      "While the will is active you can re-seal documents, reweight heirs, swap custodians, or revoke the whole thing — every action a signed transaction.",
  },
];

export function Security() {
  return (
    <section id="security" className="relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--neon)]">
              Security
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
              Trustless, not trust-me.
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              VaultWill executes a contract you read, signed, and can verify
              on-chain. Your files are encrypted before they ever reach IPFS. No
              backdoors, no admin keys, no recovery hotline. That&apos;s the
              point.
            </p>

            <div className="mt-8 rounded-2xl glass p-5 font-mono text-xs leading-relaxed">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted">custodian.rs</span>
                <span className="text-[var(--neon)]">verified</span>
              </div>
              <pre className="overflow-x-auto text-foreground">
                {`pub fn confirm_death(ctx: Context<ConfirmDeath>) -> Result<()> {
  let will = &mut ctx.accounts.will;
  let custodian = &mut ctx.accounts.custodian;
  require!(!custodian.has_approved, ErrorCode::AlreadyApproved);

  custodian.has_approved = true;
  will.approvals_received += 1;

  // Quorum reached -> beneficiaries may now claim.
  if will.approvals_received >= will.min_approvals {
    will.will_status = WillStatus::Claimable;
  }
  Ok(())
}`}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pillars.map((p, i) => (
              <div
                key={p.title}
                className="rounded-2xl glass p-6 relative overflow-hidden"
              >
                <span className="absolute right-4 top-4 font-mono text-[10px] text-muted">
                  0{i + 1}
                </span>
                <h3 className="text-base font-medium tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
