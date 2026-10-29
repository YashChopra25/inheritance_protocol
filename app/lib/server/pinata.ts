import { PinataSDK } from "pinata";

/**
 * Server-side Pinata client.
 *
 * The JWT never reaches the browser, and every caller of this module has already
 * passed `requireSession` + `authorizeCid`, so these credentials can only be
 * spent on behalf of a wallet that owns (or has inherited) the target document.
 */
export function getPinata(): PinataSDK {
  const jwt = process.env.PINATA_JWT_TOKEN?.trim();
  if (!jwt) {
    throw new Error("PINATA_JWT_TOKEN is not configured on the server");
  }
  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: process.env.PINATA_GATEWAY?.trim() || undefined,
  });
}

/**
 * Key-value tag recording which wallet pinned a file.
 *
 * This is what authorization binds to. The chain cannot answer "who uploaded
 * this CID": `add_media_reference` accepts any CID bytes, and every CID is
 * public, so anyone can reference someone else's document from their own will.
 * The pin record, written server-side under an authenticated session, can.
 */
export const UPLOADER_KEY = "vaultOwner";

/**
 * Deliberately uninformative pin label. The real filename is encrypted inside
 * the sealed container; anything put here is visible to the pinning provider.
 */
export const SEALED_PIN_NAME = "sealed.vseal";

export interface PinRecord {
  id: string;
  cid: string;
  name: string | null;
  size: number;
  createdAt: string;
  /** Wallet that pinned it, or null for legacy pins made before tagging. */
  uploader: string | null;
}

/** Every pin record for `cid`. Identical bytes pinned twice yield two records. */
export async function pinsForCid(
  pinata: PinataSDK,
  cid: string
): Promise<PinRecord[]> {
  const response = await pinata.files.private.list().cid(cid);
  return (response?.files ?? []).map((f) => ({
    id: f.id,
    cid: f.cid,
    name: f.name,
    size: f.size,
    createdAt: f.created_at,
    uploader: f.keyvalues?.[UPLOADER_KEY] ?? null,
  }));
}

/** Pin `file` privately, tagged with the wallet that uploaded it. */
export async function pinSealedFile(
  pinata: PinataSDK,
  file: File,
  wallet: string
): Promise<string | undefined> {
  const result = await pinata.upload.private
    .file(file)
    .name(SEALED_PIN_NAME)
    .keyvalues({ [UPLOADER_KEY]: wallet });
  return result.cid;
}
