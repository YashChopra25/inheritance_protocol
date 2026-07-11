import { useQuery } from "@tanstack/react-query";
import { fetchPinataMetadata } from "@/app/services/pinata.service";
import { PinataFileMetadata } from "@/app/types/pinata.types";

export function usePinataMetadata(cid: string) {
  return useQuery<PinataFileMetadata>({
    queryKey: ["ipfs-metadata", cid],
    queryFn: () => fetchPinataMetadata(cid),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    // CIDv0 is 46 chars, CIDv1 ~59; just require a non-empty CID.
    enabled: cid.length > 0,
  });
}
