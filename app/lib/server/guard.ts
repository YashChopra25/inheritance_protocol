/**
 * Shared request guard for the IPFS routes: session, rate limit, upload limits
 * and error shaping (fixes C4, H3, M11).
 *
 * Every route funnels through `requireSession` and `rateLimit` before it touches
 * Pinata, so the pinning credentials can only ever be spent on behalf of a
 * wallet that proved control of itself, within a bounded budget.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { kv } from "./kv";

// ---- session -----------------------------------------------------------

/** The authenticated wallet, or null when the caller has no valid session. */
export async function currentWallet(): Promise<string | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Resolve the caller's wallet or produce a 401.
 *
 * Returns a discriminated union so route handlers stay linear:
 * `const auth = await requireSession(); if (!auth.ok) return auth.response;`
 */
export async function requireSession(): Promise<
  { ok: true; wallet: string } | { ok: false; response: NextResponse }
> {
  const wallet = await currentWallet();
  if (!wallet) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in with your wallet to continue" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, wallet };
}

// ---- rate limiting -----------------------------------------------------

export interface RateLimit {
  /** Sustained requests per minute. */
  perMinute: number;
  /** Burst capacity. */
  burst: number;
}

/** Read-ish endpoints: generous, but not unbounded. */
export const READ_LIMIT: RateLimit = { perMinute: 60, burst: 20 };
/**
 * Per-row lookups a list view fires all at once (one per document), so the
 * burst must cover a full vault page.
 */
export const BULK_READ_LIMIT: RateLimit = { perMinute: 300, burst: 100 };
/** Mutating endpoints, including uploads: deliberately tight. */
export const WRITE_LIMIT: RateLimit = { perMinute: 12, burst: 5 };

/**
 * Fixed-window limiter keyed by wallet (or IP) and route, held in the shared
 * KV store (`kv.ts`) so the limit is the same across restarts and instances.
 *
 * A `RateLimit` maps onto a window as follows: the window lasts as long as it
 * takes to earn `burst` requests at `perMinute`, and allows `burst` requests.
 * The sustained rate is therefore exactly `perMinute`, and a burst is capped at
 * `burst` — at most `2 × burst` straddling a window boundary, the usual
 * fixed-window slack, which is acceptable for abuse limits like these. Each
 * request is one atomic INCR (+ PEXPIRE) on Redis, so concurrent instances
 * cannot both slip under the limit.
 *
 * Fails OPEN if the store is unreachable: a limiter outage should degrade
 * abuse protection, not take the API down. The things that must not fail open
 * — nonce burning, session revocation, upload budgets — handle errors
 * themselves.
 */
export async function rateLimit(
  key: string,
  limit: RateLimit = WRITE_LIMIT
): Promise<NextResponse | null> {
  const windowMs = Math.max(
    1_000,
    Math.round((limit.burst / limit.perMinute) * 60_000)
  );
  const now = Date.now();
  const window = Math.floor(now / windowMs);

  let count: number;
  try {
    count = await kv().incrBy(`rl:${key}:${window}`, 1, windowMs);
  } catch (err) {
    console.error("[rate-limit] store unavailable, allowing request:", err);
    return null;
  }

  if (count > limit.burst) {
    const retryAfter = Math.max(
      1,
      Math.ceil(((window + 1) * windowMs - now) / 1000)
    );
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}

/** Per-IP ceiling across all wallets, on top of the per-wallet limit. */
export const IP_WRITE_LIMIT: RateLimit = { perMinute: 30, burst: 10 };

/**
 * Per-IP limit, for endpoints where a per-wallet key alone is meaningless
 * because wallets are free to mint.
 *
 * Forwarding headers are client-controlled unless a reverse proxy overwrites
 * them, so they are trusted only when `TRUST_PROXY_HEADERS=true` says one does.
 * Without a trustworthy address the limit is skipped rather than collapsing
 * every user into one shared bucket; the global upload budget still applies.
 */
export async function rateLimitByIp(
  request: Request,
  scope: string,
  limit: RateLimit = IP_WRITE_LIMIT
): Promise<NextResponse | null> {
  if (process.env.TRUST_PROXY_HEADERS?.trim() !== "true") return null;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  return ip ? rateLimit(`${scope}:ip:${ip}`, limit) : null;
}

// ---- request bodies ----------------------------------------------------

/** Parse a JSON body, or produce a 400 instead of letting it surface as a 500. */
export async function readJson(
  request: Request
): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }
> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return { ok: true, body: body as Record<string, unknown> };
    }
  } catch {
    // fall through
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    ),
  };
}

// ---- upload limits -----------------------------------------------------

/**
 * Hard ceiling on a single upload (H3).
 *
 * Applies to the *sealed* container, which is the plaintext plus AES-GCM tags
 * and the sealed-key header — a few hundred bytes of overhead.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Per-wallet budget per rolling hour, so an authenticated user still cannot run
 * up an unbounded pinning bill.
 */
export const MAX_UPLOAD_BYTES_PER_HOUR = 200 * 1024 * 1024; // 200 MB

/**
 * Ceiling across ALL wallets per rolling hour — the backstop that bounds the
 * pinning bill even if every other limit is defeated. Override with
 * `MAX_UPLOAD_BYTES_GLOBAL_PER_HOUR` (bytes).
 */
function globalHourlyBudget(): number {
  const raw = Number(process.env.MAX_UPLOAD_BYTES_GLOBAL_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? raw : 2 * 1024 * 1024 * 1024; // 2 GB
}

/** Multipart framing on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Reject an oversized upload from its `Content-Length` BEFORE the body is
 * parsed — `request.formData()` buffers the whole body in memory, so checking
 * `file.size` afterwards is too late to protect the process.
 */
export function checkUploadLength(request: Request): NextResponse | null {
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) {
    return NextResponse.json(
      { error: "Uploads must declare a Content-Length" },
      { status: 411 }
    );
  }
  if (declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return tooLarge();
  }
  return null;
}

function tooLarge(): NextResponse {
  return NextResponse.json(
    {
      error: `File is too large. The limit is ${
        MAX_UPLOAD_BYTES / (1024 * 1024)
      } MB.`,
    },
    { status: 413 }
  );
}

const GLOBAL_QUOTA_KEY = "*";
const HOUR_MS = 60 * 60_000;

/**
 * Quota counters live in the shared KV store, one key per wallet per clock
 * hour (`quota:<wallet>:<hour>`), so budgets survive restarts and are shared
 * across instances. The key expires with its hour; a fresh hour simply starts a
 * fresh key.
 */
function quotaKey(key: string, now: number): string {
  return `quota:${key}:${Math.floor(now / HOUR_MS)}`;
}

async function quotaUsed(key: string, now: number): Promise<number> {
  return Number((await kv().get(quotaKey(key, now))) ?? 0) || 0;
}

/**
 * Validate `size` against the per-file, per-wallet and global limits.
 *
 * Fails CLOSED (503) if the store is unreachable: the global budget is the
 * backstop on the pinning bill, so it must not silently stop applying.
 */
export async function checkUploadQuota(
  wallet: string,
  size: number
): Promise<NextResponse | null> {
  if (size <= 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) return tooLarge();

  const now = Date.now();
  let walletUsed: number;
  let globalUsed: number;
  try {
    [walletUsed, globalUsed] = await Promise.all([
      quotaUsed(wallet, now),
      quotaUsed(GLOBAL_QUOTA_KEY, now),
    ]);
  } catch (err) {
    console.error("[upload] quota store unavailable:", err);
    return NextResponse.json(
      { error: "Uploads are temporarily unavailable. Try again shortly." },
      { status: 503 }
    );
  }

  if (walletUsed + size > MAX_UPLOAD_BYTES_PER_HOUR) {
    return NextResponse.json(
      {
        error:
          "Hourly upload limit reached for this wallet. Try again in an hour.",
      },
      { status: 429 }
    );
  }
  if (globalUsed + size > globalHourlyBudget()) {
    console.error("[upload] global hourly upload budget exhausted");
    return NextResponse.json(
      { error: "Uploads are temporarily paused. Try again later." },
      { status: 503 }
    );
  }
  return null;
}

/**
 * Charge a completed upload against the budgets. Separate from the check so a
 * rejected or failed upload never consumes anyone's quota.
 *
 * Check-then-charge is not one atomic step, so concurrent uploads can overshoot
 * a budget by at most the uploads in flight (each bounded by MAX_UPLOAD_BYTES
 * and the write rate limit). The charge itself is an atomic INCRBY. A failed
 * charge is logged, not surfaced: the file is already pinned and its CID must
 * still reach the client.
 */
export async function recordUpload(wallet: string, size: number): Promise<void> {
  const now = Date.now();
  try {
    await Promise.all(
      [wallet, GLOBAL_QUOTA_KEY].map((key) =>
        // TTL a little past the hour so a key never outlives its usefulness by
        // much, but cannot expire while its hour is still current.
        kv().incrBy(quotaKey(key, now), size, HOUR_MS + 60_000)
      )
    );
  } catch (err) {
    console.error("[upload] could not record upload against quota:", err);
  }
}

// ---- CID validation (M11: CIDv0 and CIDv1) -----------------------------

/**
 * Accept both CID versions the on-chain `[u8; 64]` field can hold:
 * CIDv0 (46-char base58 `Qm...`) and CIDv1 (base32 `b...`, typically 59 chars).
 *
 * The previous `length !== 46` check rejected every CIDv1, even though the
 * account field had already been widened to accept them.
 */
const CIDV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CIDV1 = /^b[a-z2-7]{20,62}$/;

export function isValidCid(cid: unknown): cid is string {
  return typeof cid === "string" && (CIDV0.test(cid) || CIDV1.test(cid));
}

export function invalidCidResponse(): NextResponse {
  return NextResponse.json(
    { error: "Invalid CID. Expected a CIDv0 (Qm…) or CIDv1 (b…) identifier." },
    { status: 400 }
  );
}

// ---- error shaping (M12) ----------------------------------------------

/**
 * Log the real error, return a generic one.
 *
 * Upstream messages from Pinata leak infrastructure detail and account state to
 * anyone who can trigger a 500, so they stay in the server log.
 */
export function serverError(scope: string, err: unknown): NextResponse {
  console.error(`[${scope}]`, err);
  return NextResponse.json(
    { error: "Something went wrong handling that request." },
    { status: 500 }
  );
}
