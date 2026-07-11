import { FC } from "react";
import dynamic from "next/dynamic";
import { LifecycleFlow } from "../overview/LifecycleFlow";
import { ContextFlowDiagram } from "../overview/ContextFlowDiagram";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

export const DisconnectedView: FC = () => {
  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">
      {/* Wallet Not Connected Card */}
      <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-white/10 bg-white/[0.01] glass-strong max-w-2xl mx-auto w-full">
        <div className="p-4 rounded-full bg-white/[0.02] border border-white/10 mb-4 text-muted">
          <svg
            className="size-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-md font-semibold text-white">
          Wallet Not Connected
        </h3>
        <p className="mt-2 max-w-sm text-xs text-muted leading-relaxed">
          Connect your Solana browser wallet (like Phantom or Solflare)
          to start creating your digital will or claim an inheritance.
        </p>
        <div className="mt-5">
          <WalletMultiButton />
        </div>
      </div>

      {/* Animations side-by-side to minimize height */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch w-full">
        <LifecycleFlow />
        <ContextFlowDiagram />
      </div>

      {/* Security Notice Card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-5 glass max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 text-[var(--warn)]">
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m0-6h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
            />
          </svg>
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Trustless Architecture
          </h3>
        </div>
        <p className="mt-2.5 text-xs text-muted leading-relaxed">
          This is a fully non-custodial decentralized application. Your
          files never touch a centralized server; they are pinned to IPFS,
          and the smart contract controls all state transitions on the
          Solana network. No third party can modify your will settings or
          preview your files.
        </p>
      </div>
    </div>
  );
};
