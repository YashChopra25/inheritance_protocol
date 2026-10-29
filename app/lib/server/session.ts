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
 *   POST /api/auth/logout    → server revokes the session id and clears the cookie
 *
 * Both the challenge and the session are HMAC-signed tokens, so nothing breaks
 * if the process restarts mid-handshake. Two pieces of state live in the shared
 * KV store (`kv.ts`): burned nonces, which stop replay inside a challenge's
 * short lifetime, and revoked session ids, which make logout actually end a
 * session instead of merely deleting one copy of the cookie.
 *
 * **Domain binding.** The signed text follows the Sign-In With Solana (SIWS)
 * message format, whose first line names the domain asking for the signature
 * and which carries the origin as `URI:`. That defeats the phishing relay where
 * a look-alike site fetches a genuine challenge from us and asks the victim to
 * sign it: SIWS-aware wallets warn when the domain in the message is not the
 * site requesting it, and the challenge token commits (under the HMAC) to the
 * origin it was issued for, so a signature collected for any other origin is
 * rejected at verify. The origin comes from `APP_ORIGIN` when configured — set
 * it in production — and otherwise from the request's own Host.
 *
 * **Domain separation.** Challenge and session tokens share one HMAC key, so
 * every MAC'd payload starts with a purpose tag (`chal:v2` / `sess:v2`). A
 * challenge token can therefore never be replayed as a session cookie (or vice
 * versa), whatever the field counts happen to be.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { CLUSTER } from "../config";
import { kv } from "./kv";

export const SESSION_COOKIE = "vault_session";
const CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes to sign
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Purpose tags mixed into every MAC (see "Domain separation" above). */
const CHALLENGE_TAG = "chal:v2";
const SESSION_TAG = "sess:v2";

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

function sign(tag: string, payload: string): string {
  return createHmac("sha256", secret())
    .update(`${tag}|${payload}`)
    .digest("base64url");
}

function verifySignature(tag: string, payload: string, mac: string): boolean {
  const expected = Buffer.from(sign(tag, payload), "utf8");
  const given = Buffer.from(mac, "utf8");
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---- origin ------------------------------------------------------------

/** Where a sign-in is happening, as it appears in the signed message. */
export interface SignInOrigin {
  /** Host (and port, if any) — the SIWS `domain`, e.g. `vault.example.com`. */
  domain: string;
  /** Full origin — the SIWS `URI`, e.g. `https://vault.example.com`. */
  uri: string;
}

/**
 * The origin a challenge is issued for and a signature is checked against.
 *
 * `APP_ORIGIN` wins when set, which pins the value regardless of what any
 * client sends. Without it, the request's Host is used; that is still safe for
 * the relay attack, because challenge and verify each derive it independently
 * from their own request: a relaying site that forges Host on the challenge
 * gets a message naming ITS domain, which then fails verify on ours.
 * `X-Forwarded-Host`/`-Proto` are honoured only behind a trusted proxy, under
 * the same `TRUST_PROXY_HEADERS` switch as the per-IP rate limits.
 */
export function signInOrigin(request: Request): SignInOrigin {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    return { domain: url.host, uri: url.origin };
  }

  const url = new URL(request.url);
  const trustProxy = process.env.TRUST_PROXY_HEADERS?.trim() === "true";
  const forwardedHost = trustProxy
    ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    : undefined;
  const forwardedProto = trustProxy
    ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    : undefined;

  const host = forwardedHost || request.headers.get("host")?.trim() || url.host;
  const proto = forwardedProto || url.protocol.replace(/:$/, "");
  // Round-trip through URL so the pair is normalised (lower-case host, default
  // ports dropped) identically on both legs of the handshake.
  const normalised = new URL(`${proto}://${host}`);
  return { domain: normalised.host, uri: normalised.origin };
}

// ---- challenge ---------------------------------------------------------

export interface Challenge {
  /** The exact text the wallet must sign. */
  message: string;
  /** Opaque token echoed back on verify; carries the nonce, times and origin. */
  token: string;
}

/** SIWS `Chain ID` for the configured cluster. */
function chainId(): string {
  return CLUSTER === "mainnet-beta" ? "mainnet" : CLUSTER;
}

/**
 * The SIWS message text for a challenge.
 *
 * Built in one place and used by both legs, so verify compares against exactly
 * what was issued. Field order and wording follow the SIWS / EIP-4361 layout so
 * wallets can recognise it and run their own domain check. The statement is
 * human-readable on purpose: the user sees it in their wallet, and it says
 * plainly that signing authorizes no transaction.
 */
function challengeMessage(
  origin: SignInOrigin,
  wallet: string,
  nonce: string,
  issuedAt: number,
  expiresAt: number
): string {
  return [
    `${origin.domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to Vault Inheritance. This signature proves you control this wallet. It authorizes no transaction and moves no funds.",
    "",
    `URI: ${origin.uri}`,
    "Version: 1",
    `Chain ID: ${chainId()}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
}

/**
 * Mint a challenge for `wallet`, bound to `origin`.
 *
 * Token layout: `wallet.originB64.nonce.issuedAt.expiresAt.mac`. The origin is
 * base64url-encoded because hosts contain dots, and it is carried (not just
 * MAC'd) so verify can name a domain mismatch precisely instead of reporting a
 * generic integrity failure. The nonce is hex because SIWS requires an
 * alphanumeric nonce.
 */
export function createChallenge(wallet: string, origin: SignInOrigin): Challenge {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const expiresAt = issuedAt + CHALLENGE_TTL_MS;
  const originB64 = Buffer.from(origin.uri, "utf8").toString("base64url");
  const payload = `${wallet}.${originB64}.${nonce}.${issuedAt}.${expiresAt}`;
  const token = `${payload}.${sign(CHALLENGE_TAG, payload)}`;

  return {
    message: challengeMessage(origin, wallet, nonce, issuedAt, expiresAt),
    token,
  };
}

export interface VerifyResult {
  ok: boolean;
  wallet?: string;
  error?: string;
}

/**
 * Verify a signed challenge and return the authenticated wallet.
 *
 * Checks, in order: token integrity, wallet, origin, expiry, that the message
 * the wallet signed is exactly the one this token describes, the ed25519
 * signature itself against the claimed public key, and finally single use.
 *
 * The nonce is burned last, with an atomic set-if-absent in the shared store,
 * so only a fully valid signature can consume it, and two concurrent verifies
 * of the same signature cannot both win. If the store is unreachable the
 * sign-in is REJECTED: without the burn there is no replay protection, and an
 * auth path must fail closed.
 */
export async function verifyChallenge(
  token: string,
  wallet: string,
  message: string,
  signatureB58: string,
  origin: SignInOrigin
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 6) return { ok: false, error: "Malformed challenge token" };
  const [tokenWallet, originB64, nonce, issuedRaw, expiryRaw, mac] = parts;
  const payload = `${tokenWallet}.${originB64}.${nonce}.${issuedRaw}.${expiryRaw}`;

  if (!verifySignature(CHALLENGE_TAG, payload, mac)) {
    return { ok: false, error: "Challenge token failed verification" };
  }
  if (tokenWallet !== wallet) {
    return { ok: false, error: "Challenge was issued for a different wallet" };
  }
  if (Buffer.from(originB64, "base64url").toString("utf8") !== origin.uri) {
    return { ok: false, error: "Challenge was issued for a different site" };
  }

  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiryRaw);
  const now = Date.now();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    return { ok: false, error: "Malformed challenge token" };
  }
  if (expiresAt <= now) {
    return { ok: false, error: "Challenge expired; request a new one" };
  }

  // The signed text must be exactly what this token authorizes — for this
  // origin — otherwise a signature harvested for one purpose or site could be
  // presented for another.
  const expectedMessage = challengeMessage(
    origin,
    wallet,
    nonce,
    issuedAt,
    expiresAt
  );
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

  let fresh: boolean;
  try {
    // TTL just past the challenge's own expiry: after that the expiry check
    // rejects the token anyway, so the burn record is no longer needed.
    fresh = await kv().setIfAbsent(
      `nonce:${nonce}`,
      "1",
      expiresAt - now + 1_000
    );
  } catch (err) {
    console.error("[session] could not burn sign-in nonce:", err);
    return {
      ok: false,
      error: "Sign-in is temporarily unavailable; try again shortly",
    };
  }
  if (!fresh) return { ok: false, error: "Challenge already used" };

  return { ok: true, wallet };
}

// ---- session -----------------------------------------------------------

/**
 * Mint the cookie value for an authenticated wallet.
 *
 * Layout: `wallet.sid.issuedAt.expiresAt.mac`. `sid` is a random per-session
 * id — the handle logout revokes. Revocation is per session, not per wallet,
 * on purpose: the client logs out automatically whenever the user switches
 * wallet accounts, and a wallet-wide cut-off would sign that wallet out on
 * every other device each time.
 */
export function createSessionToken(wallet: string): string {
  const sid = randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload = `${wallet}.${sid}.${issuedAt}.${expiresAt}`;
  return `${payload}.${sign(SESSION_TAG, payload)}`;
}

interface SessionClaims {
  wallet: string;
  sid: string;
  issuedAt: number;
  expiresAt: number;
}

/** Integrity and expiry only — no revocation lookup. */
function parseSessionToken(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [wallet, sid, issuedRaw, expiryRaw, mac] = parts;
  if (!verifySignature(SESSION_TAG, `${wallet}.${sid}.${issuedRaw}.${expiryRaw}`, mac)) {
    return null;
  }
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= Date.now()) return null;
  return { wallet, sid, issuedAt, expiresAt };
}

const revokedKey = (sid: string) => `revoked-sid:${sid}`;

/**
 * Recover the wallet from a session cookie, or null if it is invalid, expired
 * or revoked.
 *
 * Fails CLOSED: if the revocation list cannot be consulted, the session is
 * treated as invalid rather than risk honouring one the user has logged out.
 */
export async function readSessionToken(
  token: string | undefined
): Promise<string | null> {
  const claims = parseSessionToken(token);
  if (!claims) return null;
  try {
    if (await kv().get(revokedKey(claims.sid))) return null;
  } catch (err) {
    console.error("[session] revocation lookup failed:", err);
    return null;
  }
  return claims.wallet;
}

/**
 * Revoke the session a cookie carries, until the moment it would have expired
 * anyway (after which the expiry check covers it and the record can lapse).
 *
 * Returns false only when there was a valid session but the store write failed;
 * a missing or invalid cookie has nothing to revoke and returns true.
 */
export async function revokeSessionToken(
  token: string | undefined
): Promise<boolean> {
  const claims = parseSessionToken(token);
  if (!claims) return true;
  try {
    await kv().set(
      revokedKey(claims.sid),
      claims.wallet,
      claims.expiresAt - Date.now() + 1_000
    );
    return true;
  } catch (err) {
    console.error("[session] could not revoke session:", err);
    return false;
  }
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
