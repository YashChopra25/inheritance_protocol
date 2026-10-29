import { describe, expect, it } from "vitest";
import {
  checkUploadLength,
  checkUploadQuota,
  isValidCid,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES_PER_HOUR,
  rateLimit,
  recordUpload,
} from "@/lib/server/guard";

describe("rate limiting", () => {
  it("allows the burst, then answers 429 with Retry-After", async () => {
    const limit = { perMinute: 6, burst: 3 };
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(await rateLimit(key, limit)).toBeNull();
    const blocked = await rateLimit(key, limit);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("keeps separate keys separate", async () => {
    const limit = { perMinute: 1, burst: 1 };
    expect(await rateLimit(`a:${Math.random()}`, limit)).toBeNull();
    expect(await rateLimit(`b:${Math.random()}`, limit)).toBeNull();
  });
});

describe("upload limits", () => {
  it("requires a Content-Length and rejects oversized declarations", () => {
    const req = (len?: string) =>
      new Request("https://x/api/ipfs/upload", {
        method: "POST",
        headers: len ? { "content-length": len } : {},
      });
    expect(checkUploadLength(req())?.status).toBe(411);
    expect(checkUploadLength(req(String(MAX_UPLOAD_BYTES * 2)))?.status).toBe(413);
    expect(checkUploadLength(req("1024"))).toBeNull();
  });

  it("enforces the per-wallet hourly budget", async () => {
    const wallet = `wallet-${Math.random()}`;
    expect(await checkUploadQuota(wallet, 10)).toBeNull();
    await recordUpload(wallet, MAX_UPLOAD_BYTES_PER_HOUR - 5);
    expect((await checkUploadQuota(wallet, 10))?.status).toBe(429);
  });
});

describe("CID validation", () => {
  it("accepts CIDv0 and CIDv1, rejects junk", () => {
    expect(isValidCid("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG")).toBe(true);
    expect(isValidCid("bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e")).toBe(true);
    expect(isValidCid("../../etc/passwd")).toBe(false);
    expect(isValidCid(42)).toBe(false);
  });
});
