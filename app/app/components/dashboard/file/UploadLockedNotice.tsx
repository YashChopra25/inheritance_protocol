import { FC } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown instead of the upload controls while the will cannot reach quorum. */
export const UploadLockedNotice: FC = () => (
  <div className="max-w-2xl mx-auto w-full rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] p-8 text-center">
    <div className="mx-auto mb-3 w-fit rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-300">
      <Lock className="size-6" />
    </div>
    <p className="text-sm font-semibold text-foreground">
      Uploads are locked until your will can reach quorum
    </p>
    <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-white/65">
      Solana will not accept a document into a will whose custodians could
      never confirm your passing. Complete the setup steps above first.
    </p>
    <Link
      href="/dashboard/custodians"
      className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-xs font-semibold text-foreground transition hover:bg-[var(--accent)]/90"
    >
      Manage custodians
    </Link>
  </div>
);
