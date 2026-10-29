/** What `/api/ipfs/metadata` reports: facts about the CIPHERTEXT pin only. */
export interface PinataFileMetadata {
  id: string;
  cid: string;
  /** Operator-visible pin label, not the real (encrypted) filename. */
  name: string | null;
  /** Size of the sealed container. */
  size: number;
  createdAt: string;
}
