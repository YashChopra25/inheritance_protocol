"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_ENDPOINT } from "@/lib/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => RPC_ENDPOINT, []);

  // Empty array: modern wallet-adapter auto-discovers Wallet-Standard wallets
  // (Phantom, Solflare, Backpack, ...) that are installed in the browser.
  const wallets = useMemo(() => [], []);

  // Create QueryClient inside useMemo to prevent multiple instances
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster richColors theme="dark" position="bottom-right" />
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
