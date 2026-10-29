/**
 * Integrity check for bytes fetched by CID.
 *
 * The retrieve route proxies through our server and the pinning gateway, and a
 * sealed container is addressed to heirs with anonymous `nacl.box` — so if
 * either hop were compromised, it could serve a *different* container sealed to
 * an heir's public on-chain key, and it would decrypt cleanly. Checking the
 * bytes against the CID recorded on-chain closes that, because the CID is a
 * hash of the content and the chain is the one source the server cannot forge.
 *
 * Coverage is honest rather than total: a CIDv1 with the `raw` codec is a plain
 * SHA-256 of the bytes and is verified exactly. A `dag-pb` CID (CIDv0 `Qm…`, or
 * CIDv1 `bafy…`) hashes a UnixFS DAG whose chunking parameters are chosen by
 * the pinning service; recomputing it with guessed parameters would reject
 * genuine files, so those report `unverifiable` instead of a false verdict.
 */

const RAW_CODEC = 0x55;
const SHA2_256 = 0x12;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export type CidCheck = "verified" | "unverifiable";

function base32Decode(text: string): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character in CID");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** Read one unsigned LEB128 varint. */
function varint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let o = offset;
  for (;;) {
    if (o >= bytes.length) throw new Error("Truncated CID");
    const b = bytes[o++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [result, o];
    shift += 7;
    if (shift > 28) throw new Error("CID varint too long");
  }
}

/**
 * Throws if `bytes` provably do not match `cid`; otherwise reports whether the
 * match was proven (`verified`) or could not be checked (`unverifiable`).
 */
export async function checkCid(
  cid: string,
  bytes: Uint8Array
): Promise<CidCheck> {
  // Multibase prefix `b` = lowercase base32: the only CIDv1 form we pin.
  if (!cid.startsWith("b")) return "unverifiable";

  const raw = base32Decode(cid.slice(1));
  const [version, o1] = varint(raw, 0);
  const [codec, o2] = varint(raw, o1);
  const [hashFn, o3] = varint(raw, o2);
  const [digestLen, o] = varint(raw, o3);
  if (version !== 1) return "unverifiable";
  if (codec !== RAW_CODEC || hashFn !== SHA2_256) return "unverifiable";

  const expected = raw.subarray(o, o + digestLen);
  const actual = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer
    )
  );
  const match =
    expected.length === actual.length &&
    expected.every((b, i) => b === actual[i]);
  if (!match) {
    throw new Error(
      "The document returned by the server does not match the copy recorded on-chain. It has not been opened."
    );
  }
  return "verified";
}
