/**
 * Wallet-signature sessions for the API layer (fixes C4).
 *
 * Before this existed, every `/api/ipfs/*` route acted on any caller's behalf
 * using the server's Pinata credentials: anyone could delete or rename another
 * user's inheritance documents with nothing but a CID scraped off the public
 * ledger.
 *
 * The flow is the standard sign-in-with-wallet handshake:
 *
 *   GET  /api/auth/challenge → server issues a signed, single-use nonce
 *   POST /api/auth/verify    → client returns the wallet's ed25519 signature
 *                              over that challenge; server verifies it and sets
 *                              an HttpOnly session cookie
 *
 * Both the challenge and the session are stateless HMAC-signed tokens, so no
 * database is required and nothing breaks if the process restarts mid-handshake.
 * A small in-memory cache burns each nonce on use, which stops replay inside the
 * challenge's short lifetime.
 *
 * NOTE: the burned-nonce cache is per-process. On a single PM2 instance (the
 * current deployment) that is exact; behind multiple instances it degrades to
 * "replayable within CHALLENGE_TTL_MS", which is why that TTL is kept short.
 * Moving to Redis is the one change needed to scale this horizontally.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const SESSION_COOKIE = "vault_session";
const CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes to sign
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * HMAC key for challenge and session tokens.
 *
 * Deliberately throws rather than falling back to a default: a predictable
 * signing key would let anyone mint a session for any wallet, which is strictly
 * worse than the server refusing to start.
 */
function secret(): Buffer {
  const raw = process.env.SESSION_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "SESSION_SECRET is not configured (needs >= 32 chars). Refusing to issue sessions."
    );
  }
  return Buffer.from(raw, "utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, mac: string): boolean {
  const expected = Buffer.from(sign(payload), "utf8");
  const given = Buffer.from(mac, "utf8");
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---- challenge ---------------------------------------------------------

/** Nonces already redeemed, with the time they expire. */
const burned = new Map<string, number>();

function sweepBurned(now: number) {
  for (const [nonce, expiry] of burned) {
    if (expiry <= now) burned.delete(nonce);
  }
}

export interface Challenge {
  /** The exact text the wallet must sign. */
  message: string;
  /** Opaque token echoed back on verify; carries the nonce and its expiry. */
  token: string;
}

/**
 * Mint a challenge for `wallet`.
 *
 * The message is human-readable on purpose — the user sees it in their wallet,
 * and it says plainly that signing authorizes no transaction.
 */
export function createChallenge(wallet: string): Challenge {
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${wallet}.${nonce}.${expiresAt}`;
  const token = `${payload}.${sign(payload)}`;

  const message = [
    "Sign in to Vault Inheritance",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "This signature proves you control this wallet. It authorizes no",
    "transaction and moves no funds.",
  ].join("\n");

  return { message, token };
}

export interface VerifyResult {
  ok: boolean;
  wallet?: string;
  error?: string;
}

/**
 * Verify a signed challenge and return the authenticated wallet.
 *
 * Checks, in order: token integrity, expiry, single use, that the message the
 * wallet signed is exactly the one this token describes, and finally the
 * ed25519 signature itself against the claimed public key.
 */
export function verifyChallenge(
  token: string,
  wallet: string,
  message: string,
  signatureB58: string
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, error: "Malformed challenge token" };
  const [tokenWallet, nonce, expiryRaw, mac] = parts;
  const payload = `${tokenWallet}.${nonce}.${expiryRaw}`;

  if (!verifySignature(payload, mac)) {
    return { ok: false, error: "Challenge token failed verification" };
  }
  if (tokenWallet !== wallet) {
    return { ok: false, error: "Challenge was issued for a different wallet" };
  }

  const expiresAt = Number(expiryRaw);
  const now = Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return { ok: false, error: "Challenge expired; request a new one" };
  }

  sweepBurned(now);
  if (burned.has(nonce)) {
    return { ok: false, error: "Challenge already used" };
  }

  // The signed text must be exactly what this token authorizes — otherwise a
  // signature harvested for one purpose could be presented for another.
  const expectedMessage = [
    "Sign in to Vault Inheritance",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "This signature proves you control this wallet. It authorizes no",
    "transaction and moves no funds.",
  ].join("\n");
  if (message !== expectedMessage) {
    return { ok: false, error: "Signed message does not match the challenge" };
  }

  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = bs58.decode(wallet);
    signature = bs58.decode(signatureB58);
  } catch {
    return { ok: false, error: "Wallet or signature is not valid base58" };
  }
  if (publicKey.length !== 32 || signature.length !== 64) {
    return { ok: false, error: "Wallet or signature has the wrong length" };
  }

  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    signature,
    publicKey
  );
  if (!verified) return { ok: false, error: "Signature does not match wallet" };

  burned.set(nonce, expiresAt);
  return { ok: true, wallet };
}

// ---- session -----------------------------------------------------------

/** Mint the cookie value for an authenticated wallet. */
export function createSessionToken(wallet: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${wallet}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Recover the wallet from a session cookie, or null if it is invalid/expired. */
export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [wallet, expiryRaw, mac] = parts;
  if (!verifySignature(`${wallet}.${expiryRaw}`, mac)) return null;
  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return wallet;
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
