import { FC, ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export const Field: FC<FieldProps> = ({ label, children }) => {
  return (
    <label className="block rounded-xl bg-white/[0.03] border border-[var(--border)] px-3.5 py-2.5 focus-within:border-[var(--border-strong)] transition-colors">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">{children}</div>
    </label>
  );
};
