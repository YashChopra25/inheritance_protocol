import { useMemo } from "react";
import { PublicKey } from "@solana/web3.js";

export function useParsedKey(addr: string): PublicKey | null {
  return useMemo(() => {
    try {
      return addr.trim() ? new PublicKey(addr.trim()) : null;
    } catch {
      return null;
    }
  }, [addr]);
}
