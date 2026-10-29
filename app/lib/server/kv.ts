/**
 * Shared, expiring key-value state for the API layer.
 *
 * Rate-limit windows, burned sign-in nonces, upload quotas and revoked session
 * ids used to live in per-process `Map`s. That is exact on one PM2 instance and
 * silently wrong everywhere else: a restart forgot every burned nonce (replay
 * window) and every revoked session, and behind N instances each limit was
 * really N times looser. This module gives all of them one async interface with
 * two backends:
 *
 *   * **Upstash Redis (REST)** — used whenever `UPSTASH_REDIS_REST_URL` and
 *     `UPSTASH_REDIS_REST_TOKEN` are both set. Plain `fetch`, no client library.
 *     Every operation is a single atomic Redis command (or a MULTI/EXEC
 *     transaction), so concurrent instances cannot race each other.
 *   * **In-memory** — the previous behaviour, kept for development and for
 *     single-instance deployments. Entries carry a TTL and are swept lazily.
 *
 * Production without Redis is allowed (it is how the app ran before) but logs a
 * single warning, because the guarantees above quietly degrade.
 *
 * Callers decide their own failure mode when the store throws: sign-in and
 * session checks fail CLOSED, rate limits fail open (see `guard.ts`).
 */

/** The small surface the API layer actually needs. */
export interface KvStore {
  /**
   * Set `key` only if it does not exist yet (`SET NX PX`). Returns true when
   * this call created it — i.e. the caller "won" — and false if it was present.
   */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Unconditionally set `key` with an expiry. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** Current value, or null when missing or expired. */
  get(key: string): Promise<string | null>;
  /**
   * Atomically add `by` to an integer counter and (re)arm its expiry, returning
   * the new total. A missing key counts from zero.
   */
  incrBy(key: string, by: number, ttlMs: number): Promise<number>;
}

/** Every key is namespaced so the Redis database can be shared safely. */
const PREFIX = "vault:";

// ---- in-memory ----------------------------------------------------------

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * Single-process store. Expired entries are ignored on read and swept once the
 * map grows, so its size is bounded by recent activity rather than by every key
 * ever written (keys are often derived from free-to-mint wallets).
 */
class MemoryKv implements KvStore {
  private entries = new Map<string, Entry>();
  private writesSinceSweep = 0;

  private live(key: string, now: number): Entry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  private write(key: string, value: string, ttlMs: number, now: number) {
    this.entries.set(key, { value, expiresAt: now + ttlMs });
    if (++this.writesSinceSweep >= 500 || this.entries.size > 5_000) {
      this.writesSinceSweep = 0;
      for (const [k, e] of this.entries) {
        if (e.expiresAt <= now) this.entries.delete(k);
      }
    }
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    const now = Date.now();
    if (this.live(key, now)) return false;
    this.write(key, value, ttlMs, now);
    return true;
  }

  async set(key: string, value: string, ttlMs: number) {
    this.write(key, value, ttlMs, Date.now());
  }

  async get(key: string) {
    return this.live(key, Date.now())?.value ?? null;
  }

  async incrBy(key: string, by: number, ttlMs: number) {
    const now = Date.now();
    const next = Number(this.live(key, now)?.value ?? 0) + by;
    this.write(key, String(next), ttlMs, now);
    return next;
  }
}

// ---- Upstash Redis REST -------------------------------------------------

type RedisArg = string | number;

/**
 * Upstash's REST protocol: POST a command as a JSON array, get `{ result }` or
 * `{ error }` back. `/multi-exec` takes an array of commands and runs them as a
 * Redis transaction, returning one `{ result | error }` per command.
 */
class UpstashKv implements KvStore {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.url}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      // A hung store must not hang the request that is waiting on it.
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      throw new Error(`Upstash request failed with HTTP ${res.status}`);
    }
    return res.json();
  }

  private async command(...args: RedisArg[]): Promise<unknown> {
    const json = (await this.post("", args.map(String))) as {
      result?: unknown;
      error?: string;
    };
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result ?? null;
  }

  private async transaction(...commands: RedisArg[][]): Promise<unknown[]> {
    const json = (await this.post(
      "/multi-exec",
      commands.map((c) => c.map(String))
    )) as { result?: unknown; error?: string }[] | { error?: string };
    if (!Array.isArray(json)) {
      throw new Error(`Upstash: ${json.error ?? "malformed transaction reply"}`);
    }
    return json.map((r) => {
      if (r.error) throw new Error(`Upstash: ${r.error}`);
      return r.result ?? null;
    });
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    // Replies "OK" when the key was created, null when NX found it present.
    const result = await this.command(
      "SET",
      PREFIX + key,
      value,
      "NX",
      "PX",
      Math.max(1, Math.ceil(ttlMs))
    );
    return result === "OK";
  }

  async set(key: string, value: string, ttlMs: number) {
    await this.command("SET", PREFIX + key, value, "PX", Math.max(1, Math.ceil(ttlMs)));
  }

  async get(key: string) {
    const result = await this.command("GET", PREFIX + key);
    return typeof result === "string" ? result : null;
  }

  async incrBy(key: string, by: number, ttlMs: number) {
    // INCRBY and PEXPIRE in one transaction so a crash between them can never
    // leave an immortal counter behind.
    const [total] = await this.transaction(
      ["INCRBY", PREFIX + key, Math.trunc(by)],
      ["PEXPIRE", PREFIX + key, Math.max(1, Math.ceil(ttlMs))]
    );
    const n = Number(total);
    if (!Number.isFinite(n)) throw new Error("Upstash: INCRBY returned a non-number");
    return n;
  }
}

// ---- selection ----------------------------------------------------------

let store: KvStore | null = null;

/**
 * The process-wide store, chosen once on first use.
 *
 * Lazy rather than at import time so that `next build` (which evaluates route
 * modules with NODE_ENV=production) never logs the production warning.
 */
export function kv(): KvStore {
  if (store) return store;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    store = new UpstashKv(url, token);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[kv] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set; " +
          "rate limits, upload quotas, burned sign-in nonces and session " +
          "revocations are held in process memory. They reset on restart and " +
          "are not shared between instances."
      );
    }
    store = new MemoryKv();
  }
  return store;
}
