import { useQuery } from "@tanstack/react-query";
import { fetchPinataMetadata } from "@/app/services/pinata.service";
import { PinataFileMetadata } from "@/app/types/pinata.types";
import { useVaultSession } from "./useVaultSession";

/**
 * Pin metadata for one document. The route requires a session, so this waits
 * for one rather than firing a request that can only 401 — and it never signs
 * in by itself, because a wallet prompt per row on page load is hostile.
 */
export function usePinataMetadata(cid: string) {
  const { wallet, signedIn } = useVaultSession();
  const query = useQuery<PinataFileMetadata>({
    queryKey: ["ipfs-metadata", cid, wallet],
    queryFn: () => fetchPinataMetadata(cid),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    // CIDv0 is 46 chars, CIDv1 ~59; just require a non-empty CID.
    enabled: cid.length > 0 && signedIn,
    retry: false,
  });
  return { ...query, needsSignIn: !signedIn };
}
