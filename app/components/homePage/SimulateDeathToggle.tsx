import { FC, useState } from "react";

interface SimulateDeathToggleProps {
  active: boolean;
  onTrigger: () => void;
  disabled: boolean;
}

export const SimulateDeathToggle: FC<SimulateDeathToggleProps> = ({
  active,
  onTrigger,
  disabled,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (disabled || active) return;
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 2500);
      return;
    }
    setConfirming(false);
    onTrigger();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || active}
      className={`group inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${
        active
          ? "border-[rgba(255,107,154,0.4)] bg-[rgba(255,107,154,0.1)] text-[var(--danger)]"
          : confirming
          ? "border-[rgba(255,184,107,0.4)] bg-[rgba(255,184,107,0.08)] text-[var(--warn)]"
          : "border-[var(--border-strong)] text-muted hover:text-foreground hover:border-[rgba(255,107,154,0.4)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
      aria-pressed={active}
    >
      <span
        className={`size-2 rounded-full ${
          active ? "bg-[var(--danger)]" : "bg-white/30"
        }`}
      />
      {active
        ? "Custodians confirmed"
        : confirming
        ? "Tap again to confirm"
        : "Simulate Death"}
    </button>
  );
};
