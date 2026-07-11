import { PinataFileMetadata } from "../types/pinata.types";

export async function fetchPinataMetadata(cid: string): Promise<PinataFileMetadata> {
  const res = await fetch(`/api/ipfs/metadata?cid=${cid}`);
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Failed to load metadata"));
  }
  return res.json();
}
