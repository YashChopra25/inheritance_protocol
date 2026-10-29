import type { PinataFileMetadata } from "@/app/types/pinata.types";

/** The label every new pin gets — see `SEALED_PIN_NAME` on the server. */
const DEFAULT_PIN_NAME = "sealed.vseal";

/**
 * What to call a document in a list without decrypting it.
 *
 * The real filename is sealed inside the container, so lists show the owner's
 * own pin label if they set one, else a neutral "Document #n". Legacy pins were
 * labelled `<real name>.vseal`; the suffix is stripped so they still read well.
 */
export function documentLabel(
  metadata: PinataFileMetadata | null | undefined,
  mediaIndex: number
): string {
  const name = metadata?.name?.trim();
  if (!name || name === DEFAULT_PIN_NAME) return `Document #${mediaIndex}`;
  return name.endsWith(".vseal") ? name.slice(0, -".vseal".length) : name;
}
