import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import {
  createChallenge,
  createSessionToken,
  readSessionToken,
  revokeSessionToken,
  signInOrigin,
  verifyChallenge,
} from "@/lib/server/session";

const kp = nacl.sign.keyPair();
const wallet = bs58.encode(kp.publicKey);
const origin = signInOrigin(
  new Request("https://vault.example.com/api/auth/challenge", {
    headers: { host: "vault.example.com" },
  })
);
const sign = (message: string) =>
  bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));

describe("wallet sign-in", () => {
  it("binds the challenge to the site's domain (SIWS)", () => {
    const { message } = createChallenge(wallet, origin);
    expect(message.split("\n")[0]).toBe(
      "vault.example.com wants you to sign in with your Solana account:"
    );
    expect(message).toContain("URI: https://vault.example.com");
  });

  it("accepts a valid signature once, then refuses replay", async () => {
    const ch = createChallenge(wallet, origin);
    const sig = sign(ch.message);
    expect((await verifyChallenge(ch.token, wallet, ch.message, sig, origin)).ok).toBe(true);
    expect(
      (await verifyChallenge(ch.token, wallet, ch.message, sig, origin)).error
    ).toMatch(/already used/);
  });

  it("refuses a challenge relayed through another site", async () => {
    const ch = createChallenge(wallet, origin);
    const res = await verifyChallenge(ch.token, wallet, ch.message, sign(ch.message), {
      domain: "evil.example",
      uri: "https://evil.example",
    });
    expect(res.ok).toBe(false);
  });

  it("refuses a signature from a different wallet", async () => {
    const ch = createChallenge(wallet, origin);
    const other = nacl.sign.keyPair();
    const sig = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(ch.message), other.secretKey)
    );
    expect((await verifyChallenge(ch.token, wallet, ch.message, sig, origin)).ok).toBe(false);
  });
});

describe("sessions", () => {
  it("round-trips, and a challenge token is never a session", async () => {
    const token = createSessionToken(wallet);
    expect(await readSessionToken(token)).toBe(wallet);
    expect(await readSessionToken(createChallenge(wallet, origin).token)).toBeNull();
  });

  it("rejects tampered tokens", async () => {
    const token = createSessionToken(wallet);
    const other = bs58.encode(nacl.sign.keyPair().publicKey);
    expect(await readSessionToken(token.replace(wallet, other))).toBeNull();
  });

  it("logout revokes only that session", async () => {
    const a = createSessionToken(wallet);
    const b = createSessionToken(wallet);
    await revokeSessionToken(a);
    expect(await readSessionToken(a)).toBeNull();
    expect(await readSessionToken(b)).toBe(wallet);
  });
});
