import { FC } from "react";
import { LogEntry } from "@/app/types/demo.types";

interface DemoInfoProps {
  log: LogEntry[];
}

export const DemoInfo: FC<DemoInfoProps> = ({ log }) => {
  return (
    <div className="lg:sticky lg:top-28">
      <p className="text-xs uppercase tracking-[0.18em] text-accent">Interactive demo</p>
      <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold gradient-text">
        Walk through a full will lifecycle.
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        Connect a simulated Phantom wallet, seal a will, and check in to stay active. Or skip
        the wait — toggle <span className="text-foreground">Simulate Death</span> to have the
        custodian quorum confirm, then watch your beneficiary unlock the sealed documents.
      </p>
      <p className="mt-3 text-xs text-muted">
        Demo time runs at 3,600× real-time so the countdown is visible. No transactions are broadcast.
      </p>

      <div className="mt-8 rounded-xl glass p-4 text-sm">
        <p className="text-xs uppercase tracking-wider text-muted">On-chain log</p>
        <ul className="mt-3 space-y-2 font-mono text-[12px]">
          {log.length === 0 ? (
            <li className="text-muted">{"// awaiting wallet connection…"}</li>
          ) : (
            log.map((l) => (
              <li key={l.id} className="flex items-start gap-2 text-muted">
                <span
                  className={
                    l.kind === "ok"
                      ? "text-[var(--neon)]"
                      : l.kind === "warn"
                      ? "text-[var(--warn)]"
                      : l.kind === "err"
                      ? "text-[var(--danger)]"
                      : "text-[var(--accent)]"
                  }
                >
                  ›
                </span>
                <span>
                  <span className="text-foreground/70">
                    {new Date(l.t).toLocaleTimeString([], { hour12: false })}
                  </span>{" "}
                  {l.msg}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};
