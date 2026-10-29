import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkCid } from "@/lib/cid";

/** Build a CIDv1 (raw codec, sha2-256) the way IPFS does for a single block. */
function rawCid(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest();
  const cid = Uint8Array.from([1, 0x55, 0x12, 32, ...digest]);
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of cid) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return `b${out}`;
}

describe("CID integrity", () => {
  const data = new TextEncoder().encode("sealed container bytes");

  it("verifies matching raw-codec content", async () => {
    await expect(checkCid(rawCid(data), data)).resolves.toBe("verified");
  });

  it("rejects bytes that do not match the on-chain CID", async () => {
    const forged = new TextEncoder().encode("forged container bytes");
    await expect(checkCid(rawCid(data), forged)).rejects.toThrow(/does not match/);
  });

  it("reports dag-pb CIDs as unverifiable rather than guessing", async () => {
    await expect(
      checkCid("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", data)
    ).resolves.toBe("unverifiable");
    await expect(
      checkCid("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", data)
    ).resolves.toBe("unverifiable");
  });
});
