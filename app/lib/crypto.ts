/**
 * Client-side envelope encryption for vault documents (fixes C5).
 *
 * The threat model this closes: every CID stored on-chain is world-readable, so
 * anything pinned to IPFS in plaintext is public the moment it is referenced —
 * no attacker ever needs to touch this application. Access control implemented
 * in React, or even in the API, cannot fix that.
 *
 * So the bytes are sealed before they leave the browser:
 *
 *   1. Every file gets a fresh random 256-bit **data key**.
 *   2. The file — and its own metadata, since a filename is often as sensitive
 *      as its contents — is encrypted with AES-256-GCM under that key.
 *   3. The data key is sealed separately to each recipient using anonymous
 *      X25519 + XSalsa20-Poly1305 (`nacl.box` with a per-recipient ephemeral
 *      sender key). Recipients are the owner plus every heir who has published
 *      an `encryption_pubkey` on-chain.
 *   4. Only the sealed keys and the ciphertext ever leave the browser.
 *
 * Consequences that matter:
 *   * The server, the pinning service and any IPFS gateway only ever hold
 *     ciphertext. Compromising all three still reveals nothing.
 *   * Nobody can be granted access retroactively — a recipient who was not
 *     sealed to at upload time cannot be added without re-uploading. That is a
 *     deliberate trade: it is what makes the guarantee cryptographic rather
 *     than policy-based.
 *   * Losing the owner's wallet loses the owner's copy. The heirs' sealed
 *     copies are the recovery path, which is the whole point of the product.
 */

import nacl from "tweetnacl";

/** Container magic + version. Bumped only on a breaking format change. */
const MAGIC = "VSEAL1";
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);
const DATA_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;

/**
 * Largest document the browser will seal. Mirrors the server's
 * `MAX_UPLOAD_BYTES` (25 MB on the sealed container) minus headroom for the
 * header and GCM tags, so an oversized file is refused before it is read into
 * memory and encrypted rather than after the upload is rejected.
 */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024 - 64 * 1024;

/**
 * Domain-separated message the owner/heir signs to derive their X25519 identity.
 *
 * Ed25519 signatures from Solana wallets are deterministic (RFC 8032), so the
 * same wallet always reproduces the same key material without anything being
 * stored anywhere — for wallets that follow RFC 8032. Some (MPC / embedded)
 * wallets do not, so registration signs twice and refuses a key that does not
 * reproduce (see `deriveRecipientKeypair`), and every new container records the
 * recipient's public key so a later mismatch is diagnosed instead of reported
 * as "not sealed to you".
 *
 * The text is versioned and deliberately unchanged: altering a single byte
 * would change every registered key and orphan every document already sealed.
 * Note what it cannot do: any site can ask a wallet to sign these exact bytes
 * and so learn the key. A plain `signMessage` cannot be bound to an origin; the
 * UI therefore only ever requests it from this app's own pages, and a v2
 * derivation should move to a wallet-verified Sign-In-With-Solana domain.
 */
export const KEY_DERIVATION_MESSAGE =
  "vault-inheritance: derive document encryption key (v1)\n\n" +
  "Signing this proves you control this wallet and generates the key that " +
  "unseals your vault documents. It authorizes no transaction and moves no funds.";

export interface RecipientKeypair {
  /** X25519 public key, 32 bytes — published on-chain via `register_recipient_key`. */
  publicKey: Uint8Array;
  /** X25519 secret key, 32 bytes — never leaves the browser. */
  secretKey: Uint8Array;
}

/** One sealed copy of a file's data key, addressed to a single wallet. */
interface SealedKey {
  /** Recipient wallet, base58. Lets a client find its own copy quickly. */
  w: string;
  /** Ephemeral X25519 sender public key, base64. */
  epk: string;
  /** Box nonce, base64. */
  n: string;
  /** The sealed data key, base64. */
  k: string;
  /**
   * Recipient's X25519 public key, base64. Optional: containers sealed before
   * it was recorded omit it. Lets re-sealing compare by key rather than by
   * wallet label (an heir who rotated their key must be re-sealed), and lets a
   * failed open explain *why* it failed.
   */
  pk?: string;
}

/** A recipient as recorded in a container header. */
export interface SealedRecipientInfo {
  wallet: string;
  /** Base64 X25519 public key, or null for containers that predate it. */
  publicKey: string | null;
}

interface SealHeader {
  v: 1;
  alg: "AES-256-GCM";
  /** Sealed data keys, one per recipient. */
  r: SealedKey[];
  /** AES-GCM IV for the encrypted metadata blob, base64. */
  miv: string;
  /** Encrypted `{ name, mime }`, base64. */
  meta: string;
  /** AES-GCM IV for the file body, base64. */
  iv: string;
}

/** Plaintext file metadata, encrypted alongside the body. */
export interface SealedFileMeta {
  name: string;
  mime: string;
}

// ---- small helpers -----------------------------------------------------

const b64 = {
  enc(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  },
  dec(text: string): Uint8Array {
    const bin = atob(text);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};

function u32le(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function readU32le(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4
  ).getUint32(0, true);
}

/**
 * Copy a view into a standalone ArrayBuffer. WebCrypto accepts a BufferSource,
 * but passing a subarray's underlying buffer would hand it the whole allocation;
 * slicing keeps the boundaries exact.
 */
function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

// ---- identity ----------------------------------------------------------

/**
 * Derive this wallet's X25519 keypair from a signature over
 * `KEY_DERIVATION_MESSAGE`.
 *
 * Pass the wallet adapter's `signMessage`. The signature is hashed (SHA-512,
 * truncated) rather than used directly, so the raw signature is never itself the
 * key and cannot be replayed as one.
 */
export async function deriveRecipientKeypair(
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
  options: { verifyDeterministic?: boolean } = {}
): Promise<RecipientKeypair> {
  const message = new TextEncoder().encode(KEY_DERIVATION_MESSAGE);
  const signature = await signMessage(message);
  if (!signature || signature.length < 32) {
    throw new Error("Wallet returned an unusable signature");
  }
  // A key published on-chain must be reproducible forever: documents are
  // sealed to it and the heir re-derives it at claim time, possibly years
  // later. A wallet that signs non-deterministically would publish a key it can
  // never derive again, silently locking the heir out. Signing twice catches
  // that before anything is published.
  if (options.verifyDeterministic) {
    const again = await signMessage(message);
    const same =
      again.length === signature.length &&
      again.every((b, i) => b === signature[i]);
    if (!same) {
      throw new Error(
        "This wallet produces a different signature each time, so it cannot hold a stable document key. Use a wallet with standard (deterministic) message signing, such as a browser-extension wallet."
      );
    }
  }
  const seed = nacl.hash(signature).slice(0, DATA_KEY_BYTES);
  const pair = nacl.box.keyPair.fromSecretKey(seed);
  return { publicKey: pair.publicKey, secretKey: pair.secretKey };
}

// ---- sealing -----------------------------------------------------------

export interface Recipient {
  /** Wallet address, base58 — recorded so a client can find its own copy. */
  wallet: string;
  /** That wallet's registered X25519 public key (32 bytes). */
  encryptionPublicKey: Uint8Array;
}

/**
 * Encrypt `file` so that exactly `recipients` can open it.
 *
 * Returns the full container — magic, header (sealed keys + encrypted metadata)
 * and the AES-GCM body — which is what gets pinned to IPFS.
 */
export async function sealFile(
  file: File,
  recipients: Recipient[]
): Promise<Uint8Array> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(
      `File is too large. The limit is ${Math.floor(
        MAX_DOCUMENT_BYTES / (1024 * 1024)
      )} MB.`
    );
  }
  if (recipients.length === 0) {
    throw new Error(
      "A document needs at least one recipient. Register your encryption key first."
    );
  }
  for (const r of recipients) {
    if (r.encryptionPublicKey.length !== nacl.box.publicKeyLength) {
      throw new Error(`Recipient ${r.wallet} has a malformed encryption key`);
    }
  }

  const dataKey = crypto.getRandomValues(new Uint8Array(DATA_KEY_BYTES));
  const aesKey = await crypto.subtle.importKey(
    "raw",
    bufferSource(dataKey),
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Body.
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const body = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: bufferSource(iv) },
      aesKey,
      await file.arrayBuffer()
    )
  );

  // Metadata, under the same key but its own IV.
  const metaIv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const metaPlain: SealedFileMeta = {
    name: file.name,
    mime: file.type || "application/octet-stream",
  };
  const meta = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: bufferSource(metaIv) },
      aesKey,
      bufferSource(new TextEncoder().encode(JSON.stringify(metaPlain)))
    )
  );

  // One sealed data key per recipient, each under a fresh ephemeral sender key
  // so the sealed copies are unlinkable and the sender stays anonymous.
  const sealed: SealedKey[] = recipients.map((r) => {
    const ephemeral = nacl.box.keyPair();
    const nonce = crypto.getRandomValues(new Uint8Array(nacl.box.nonceLength));
    const boxed = nacl.box(
      dataKey,
      nonce,
      r.encryptionPublicKey,
      ephemeral.secretKey
    );
    return {
      w: r.wallet,
      epk: b64.enc(ephemeral.publicKey),
      n: b64.enc(nonce),
      k: b64.enc(boxed),
      pk: b64.enc(r.encryptionPublicKey),
    };
  });

  // The data key must not outlive this function.
  dataKey.fill(0);

  const header: SealHeader = {
    v: 1,
    alg: "AES-256-GCM",
    r: sealed,
    miv: b64.enc(metaIv),
    meta: b64.enc(meta),
    iv: b64.enc(iv),
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));

  const out = new Uint8Array(
    MAGIC_BYTES.length + 4 + headerBytes.length + body.length
  );
  let o = 0;
  out.set(MAGIC_BYTES, o);
  o += MAGIC_BYTES.length;
  out.set(u32le(headerBytes.length), o);
  o += 4;
  out.set(headerBytes, o);
  o += headerBytes.length;
  out.set(body, o);
  return out;
}

export interface UnsealedFile {
  bytes: Uint8Array;
  name: string;
  mime: string;
}

/** True if `bytes` is a vault-sealed container rather than a legacy plaintext file. */
export function isSealed(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC_BYTES.length) return false;
  return MAGIC_BYTES.every((b, i) => bytes[i] === b);
}

/**
 * Open a sealed container with this wallet's X25519 secret key.
 *
 * Throws a plain-language error when the caller is simply not a recipient —
 * that is an expected outcome (an heir before they were named, a stranger), not
 * a bug, and the UI shows it as such.
 */
export async function unsealFile(
  container: Uint8Array,
  identity: RecipientKeypair,
  wallet: string
): Promise<UnsealedFile> {
  const { header, bodyOffset: o } = parseHeader(container);

  // Prefer the copy addressed to this wallet, then try the rest: a wallet may
  // hold a key that was sealed under a different address label.
  const ordered = [
    ...header.r.filter((s) => s.w === wallet),
    ...header.r.filter((s) => s.w !== wallet),
  ];

  let dataKey: Uint8Array | null = null;
  for (const s of ordered) {
    const opened = nacl.box.open(
      b64.dec(s.k),
      b64.dec(s.n),
      b64.dec(s.epk),
      identity.secretKey
    );
    if (opened) {
      dataKey = opened;
      break;
    }
  }
  if (!dataKey) {
    // Distinguish "you were never a recipient" from "you were, but your wallet
    // no longer derives the key it was sealed to" — the second is a wallet
    // problem the user can act on, not an access decision.
    const mine = header.r.find((s) => s.w === wallet && s.pk);
    if (mine && mine.pk !== b64.enc(identity.publicKey)) {
      throw new Error(
        "This document was sealed to your wallet, but your wallet now produces a different document key than the one it was sealed to. This happens with wallets that do not sign deterministically; open it with the same wallet software you registered with."
      );
    }
    throw new Error(
      "This document was not sealed to your wallet, so it cannot be opened here."
    );
  }

  const aesKey = await crypto.subtle.importKey(
    "raw",
    bufferSource(dataKey),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  dataKey.fill(0);

  const metaJson = new TextDecoder().decode(
    new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bufferSource(b64.dec(header.miv)) },
        aesKey,
        bufferSource(b64.dec(header.meta))
      )
    )
  );
  const meta: SealedFileMeta = JSON.parse(metaJson);

  const bytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bufferSource(b64.dec(header.iv)) },
      aesKey,
      bufferSource(container.subarray(o))
    )
  );

  return { bytes, name: meta.name, mime: meta.mime };
}

function parseHeader(container: Uint8Array): {
  header: SealHeader;
  bodyOffset: number;
} {
  if (!isSealed(container)) {
    throw new Error("This file is not in the vault's sealed format");
  }
  let o = MAGIC_BYTES.length;
  if (container.length < o + 4) {
    throw new Error("Sealed file is corrupt: truncated header");
  }
  const headerLen = readU32le(container, o);
  o += 4;
  if (headerLen <= 0 || o + headerLen > container.length) {
    throw new Error("Sealed file is corrupt: bad header length");
  }
  const header: SealHeader = JSON.parse(
    new TextDecoder().decode(container.subarray(o, o + headerLen))
  );
  if (header.v !== 1 || !Array.isArray(header.r)) {
    throw new Error(`Unsupported sealed-file version ${header.v}`);
  }
  return { header, bodyOffset: o + headerLen };
}

/** Base64 of an X25519 public key, in the form container headers record it. */
export function encodePublicKey(key: Uint8Array): string {
  return b64.enc(key);
}

/** Recipients a sealed container can be opened by, with their keys when recorded. */
export function sealedRecipients(container: Uint8Array): SealedRecipientInfo[] {
  try {
    return parseHeader(container).header.r.map((s) => ({
      wallet: s.w,
      publicKey: s.pk ?? null,
    }));
  } catch {
    return [];
  }
}
