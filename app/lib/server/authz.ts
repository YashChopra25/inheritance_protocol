/**
 * Authorization for the API layer (fixes C4).
 *
 * A session proves *which wallet* is calling (see `session.ts`). This module
 * answers the separate question of *what that wallet is allowed to touch*.
 *
 * Authority is anchored on the **uploader** of a pin — the wallet whose session
 * pinned it, recorded server-side as a Pinata key-value (see `pinata.ts`) — and
 * the chain is consulted for heirs:
 *
 *   write (delete / rename)  → only the wallet that pinned the file
 *   read  (fetch / metadata) → the uploader, or an heir of the uploader's will
 *                              while that will still references the CID, once
 *                              the will is Claimable AND the grace period has
 *                              elapsed — exactly when `claim_inheritance` and
 *                              `claim_token` open on-chain
 *
 * Why not "anyone whose will references the CID", as before: the program's
 * `add_media_reference` accepts arbitrary CID bytes and every CID is public, so
 * an attacker could reference a victim's CID from their own will and then
 * delete the victim's document through this API. Owning a reference proves
 * nothing; having pinned the bytes does.
 *
 * Pins made before uploader tagging existed ("legacy") fall back to the chain:
 * writable only when exactly one will references the CID and it is the
 * caller's (a second, attacker-made reference therefore blocks writes rather
 * than granting them). Reads keep the old rule; they only ever yield ciphertext.
 *
 * Accounts are decoded by explicit byte offset rather than through the Anchor
 * coder: these layouts are fixed-size and the offsets are asserted against the
 * account sizes below, which keeps the server bundle small and makes a layout
 * change fail loudly instead of silently mis-parsing.
 *
 * RPC: lookups go to the server-only `SOLANA_RPC_URL` when set (a private,
 * authenticated endpoint — public RPCs are rate limited and restrict
 * `getProgramAccounts` on mainnet), falling back to the public
 * `NEXT_PUBLIC_RPC_ENDPOINT`. It must point at the same cluster as the client.
 *
 * Caching: see `cached` below — POSITIVE read-path results only, for
 * POSITIVE_CACHE_TTL_MS.
 */

import { createHash } from "crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import type { PinataSDK } from "pinata";
import {
  PROGRAM_ID,
  RPC_ENDPOINT,
  SEEDS,
  GRACE_PERIOD_SECONDS,
  CID_BYTE_LEN,
} from "../config";
import { pinsForCid, type PinRecord } from "./pinata";

// ---- account layouts (byte offsets, little-endian) ---------------------

const WILL_LEN = 91;
const MEDIA_LEN = 123;
const BENEFICIARY_LEN = 108;

const WILL_OFFSETS = {
  owner: 8,
  status: 40,
  claimableAt: 65,
  custodianCount: 76,
  minApprovals: 77,
} as const;

const MEDIA_OFFSETS = {
  will: 8,
  mediaType: 42,
  ipfsCid: 58,
} as const;

const BENEFICIARY_OFFSETS = {
  will: 8,
  wallet: 40,
  allocation: 72,
  hasClaimed: 74,
} as const;

/** Anchor account discriminator: first 8 bytes of sha256("account:<Name>"). */
function discriminator(name: string): Buffer {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

/** `WillStatus` is a unit-only enum, so Anchor encodes it as a single byte. */
const WILL_STATUS = { Active: 0, PendingInheritance: 1, Claimable: 2 } as const;

let cachedConnection: Connection | null = null;
function connection(): Connection {
  if (!cachedConnection) {
    // Server-only, so a paid RPC URL with an API key in it never ships in the
    // client bundle. `||` so an empty `SOLANA_RPC_URL=` still falls back.
    const endpoint = process.env.SOLANA_RPC_URL?.trim() || RPC_ENDPOINT;
    cachedConnection = new Connection(endpoint, "confirmed");
  }
  return cachedConnection;
}

// ---- lookup cache ------------------------------------------------------

/**
 * How long a positive lookup is reused.
 *
 * A vault page fires one metadata/retrieve request per document, and each heir
 * check costs two or three RPC calls, so without a cache a single page view can
 * be dozens of identical round-trips.
 *
 * Why this cannot widen access dangerously:
 *   * Only results that GRANT something are cached (a will exists, a beneficiary
 *     record matches, a media reference exists). Denials always hit the chain,
 *     so a freshly created will or reference is usable immediately.
 *   * The worst case is therefore that access which the chain has just
 *     withdrawn — an owner revoking during grace, removing an heir or a media
 *     reference — keeps working for at most this long. That is the same order
 *     as the transaction's own confirmation latency, and grants only ciphertext
 *     reads (heirs never get write access through these paths).
 *   * Time-based checks (the grace period) are re-evaluated against the clock on
 *     every request, not cached.
 *   * Write authorization on legacy pins (`willsReferencing`) is never cached.
 *
 * Per-process by design: it is a load shedder, not shared state.
 */
const POSITIVE_CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 2_000;

const lookupCache = new Map<string, { value: unknown; expiresAt: number }>();

async function cached<T>(
  key: string,
  load: () => Promise<T>,
  isPositive: (value: T) => boolean
): Promise<T> {
  const now = Date.now();
  const hit = lookupCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await load();
  if (isPositive(value)) {
    if (lookupCache.size >= CACHE_MAX_ENTRIES) {
      for (const [k, e] of lookupCache) {
        if (e.expiresAt <= now) lookupCache.delete(k);
      }
      // Still full of live entries: drop everything rather than grow unbounded.
      if (lookupCache.size >= CACHE_MAX_ENTRIES) lookupCache.clear();
    }
    lookupCache.set(key, { value, expiresAt: now + POSITIVE_CACHE_TTL_MS });
  }
  return value;
}

// ---- decoding ----------------------------------------------------------

interface WillView {
  address: PublicKey;
  owner: PublicKey;
  status: number;
  claimableAt: bigint;
  custodianCount: number;
  minApprovals: number;
}

function decodeWill(address: PublicKey, data: Buffer): WillView | null {
  if (data.length !== WILL_LEN) return null;
  if (!data.subarray(0, 8).equals(discriminator("Will"))) return null;
  return {
    address,
    owner: new PublicKey(
      data.subarray(WILL_OFFSETS.owner, WILL_OFFSETS.owner + 32)
    ),
    status: data.readUInt8(WILL_OFFSETS.status),
    claimableAt: data.readBigInt64LE(WILL_OFFSETS.claimableAt),
    custodianCount: data.readUInt8(WILL_OFFSETS.custodianCount),
    minApprovals: data.readUInt8(WILL_OFFSETS.minApprovals),
  };
}

/** Right-pad a CID to the on-chain `[u8; CID_BYTE_LEN]` representation. */
function paddedCid(cid: string): Buffer {
  const buf = Buffer.alloc(CID_BYTE_LEN);
  const raw = Buffer.from(cid, "utf8");
  if (raw.length === 0 || raw.length > CID_BYTE_LEN) {
    throw new Error(`CID must be 1..=${CID_BYTE_LEN} bytes`);
  }
  raw.copy(buf);
  return buf;
}

// ---- lookups -----------------------------------------------------------

function willPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.WILL, owner.toBuffer()],
    PROGRAM_ID
  )[0];
}

async function fetchWillUncached(address: PublicKey): Promise<WillView | null> {
  const info = await connection().getAccountInfo(address);
  if (!info || !info.owner.equals(PROGRAM_ID)) return null;
  return decodeWill(address, info.data);
}

/**
 * Cached will lookup for the read path. A cached will can only be stale for
 * `POSITIVE_CACHE_TTL_MS`; a stale `status` there can delay an heir's access
 * but not extend it past the grace check, which uses the live clock and a
 * `claimableAt` the program never moves backwards once Claimable.
 */
async function fetchWill(address: PublicKey): Promise<WillView | null> {
  return cached(
    `will:${address.toBase58()}`,
    () => fetchWillUncached(address),
    (will) => will !== null
  );
}

/**
 * Whether `will` holds a MediaReference for `cid`. Cached when true (see
 * `cached`); the unscoped lookup used for legacy write checks is not.
 */
async function willReferences(cid: string, will: PublicKey): Promise<boolean> {
  return cached(
    `media:${will.toBase58()}:${cid}`,
    async () => (await mediaReferencing(cid, will)).length > 0,
    (found) => found
  );
}

/** MediaReference accounts holding `cid`, optionally restricted to one will. */
async function mediaReferencing(cid: string, will?: PublicKey) {
  return connection().getProgramAccounts(PROGRAM_ID, {
    dataSlice: { offset: MEDIA_OFFSETS.will, length: 32 },
    filters: [
      { dataSize: MEDIA_LEN },
      {
        memcmp: {
          offset: 0,
          bytes: discriminator("MediaReference").toString("base64"),
          encoding: "base64",
        },
      },
      ...(will
        ? [
            {
              memcmp: {
                offset: MEDIA_OFFSETS.will,
                bytes: will.toBase58(),
              },
            },
          ]
        : []),
      {
        memcmp: {
          offset: MEDIA_OFFSETS.ipfsCid,
          bytes: paddedCid(cid).toString("base64"),
          encoding: "base64",
        },
      },
    ],
  });
}

/**
 * Every will that references `cid`. Filtered server-side by the RPC via memcmp
 * on the exact CID bytes, so this is a targeted lookup, not a program scan.
 */
async function willsReferencing(cid: string): Promise<WillView[]> {
  const media = await mediaReferencing(cid);
  if (media.length === 0) return [];

  const willKeys = [
    ...new Set(media.map((m) => new PublicKey(m.account.data).toBase58())),
  ].map((k) => new PublicKey(k));

  const infos = await connection().getMultipleAccountsInfo(willKeys);
  const out: WillView[] = [];
  infos.forEach((info, i) => {
    if (!info || !info.owner.equals(PROGRAM_ID)) return;
    const decoded = decodeWill(willKeys[i], info.data);
    if (decoded) out.push(decoded);
  });
  return out;
}

function beneficiaryPda(will: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.BENEFICIARY, will.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  )[0];
}

/**
 * True when `wallet` is an heir of `will` whose claim window has opened.
 *
 * The timing test is the same one the program enforces, so the API can never be
 * more permissive than the chain: quorum reached (`Claimable`) *and* the owner's
 * grace period fully elapsed. During grace the owner may still revoke, so an
 * heir must not be able to read the estate yet.
 */
async function isEntitledHeir(
  will: WillView,
  wallet: PublicKey
): Promise<boolean> {
  if (will.status !== WILL_STATUS.Claimable) return false;

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < will.claimableAt + BigInt(GRACE_PERIOD_SECONDS)) return false;

  return isBeneficiary(will.address, wallet);
}

/** A Beneficiary account for (`will`, `wallet`) exists. Cached when true. */
async function isBeneficiary(
  will: PublicKey,
  wallet: PublicKey
): Promise<boolean> {
  return cached(
    `beneficiary:${will.toBase58()}:${wallet.toBase58()}`,
    async () => {
      const info = await connection().getAccountInfo(
        beneficiaryPda(will, wallet)
      );
      if (!info || info.data.length !== BENEFICIARY_LEN) return false;
      if (!info.owner.equals(PROGRAM_ID)) return false;

      // Re-check the back-reference rather than trusting the PDA derivation alone.
      const backRef = new PublicKey(
        info.data.subarray(
          BENEFICIARY_OFFSETS.will,
          BENEFICIARY_OFFSETS.will + 32
        )
      );
      const heirWallet = new PublicKey(
        info.data.subarray(
          BENEFICIARY_OFFSETS.wallet,
          BENEFICIARY_OFFSETS.wallet + 32
        )
      );
      return backRef.equals(will) && heirWallet.equals(wallet);
    },
    (found) => found
  );
}

/** Heir of an uploader's own will, while that will still lists the CID. */
async function isHeirOfUploader(
  uploader: string,
  cid: string,
  caller: PublicKey
): Promise<boolean> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(uploader);
  } catch {
    return false;
  }
  const will = await fetchWill(willPda(owner));
  if (!will || !will.owner.equals(owner)) return false;
  if (!(await isEntitledHeir(will, caller))) return false;
  return willReferences(cid, will.address);
}

export type CidAccess = "read" | "write";

export interface AuthzResult {
  allowed: boolean;
  /** Safe to show the caller; never leaks whether other people's wills exist. */
  reason?: string;
  /** No pin exists for this CID at all. */
  notPinned?: boolean;
  /** Pin records the caller may act on. Writes must touch only these. */
  pins: PinRecord[];
}

/**
 * Decide whether `wallet` may act on `cid`. A failing RPC or pinning lookup
 * always denies — this must never fail open.
 */
export async function authorizeCid(
  pinata: PinataSDK,
  wallet: string,
  cid: string,
  access: CidAccess
): Promise<AuthzResult> {
  let caller: PublicKey;
  try {
    caller = new PublicKey(wallet);
  } catch {
    return { allowed: false, reason: "Invalid wallet in session", pins: [] };
  }

  const pins = await pinsForCid(pinata, cid);
  if (pins.length === 0) {
    return {
      allowed: false,
      notPinned: true,
      reason: "That document is not pinned",
      pins: [],
    };
  }

  const own = pins.filter((p) => p.uploader === wallet);
  if (own.length > 0) return { allowed: true, pins: own };

  const legacy = pins.filter((p) => p.uploader === null);
  const uploaders = [
    ...new Set(pins.map((p) => p.uploader).filter((u): u is string => !!u)),
  ];

  try {
    if (access === "read") {
      for (const uploader of uploaders) {
        if (await isHeirOfUploader(uploader, cid, caller)) {
          return { allowed: true, pins: pins.filter((p) => p.uploader === uploader) };
        }
      }
    }

    if (legacy.length > 0) {
      const wills = await willsReferencing(cid);
      if (access === "write") {
        if (wills.length === 1 && wills[0].owner.equals(caller)) {
          return { allowed: true, pins: legacy };
        }
      } else {
        for (const will of wills) {
          if (
            will.owner.equals(caller) ||
            (await isEntitledHeir(will, caller))
          ) {
            return { allowed: true, pins: legacy };
          }
        }
      }
    }
  } catch (err) {
    console.error("[authz] chain lookup failed:", err);
    return {
      allowed: false,
      reason: "Could not verify access on-chain; try again shortly",
      pins: [],
    };
  }

  return {
    allowed: false,
    reason:
      access === "write"
        ? "Only the wallet that uploaded this document can modify it"
        : "You do not have access to this document yet",
    pins: [],
  };
}

/**
 * Whether `wallet` may pin new documents at all.
 *
 * Sessions are free — anyone can mint a keypair and sign in — so a per-wallet
 * quota alone bounds nothing. Requiring an Active will whose quorum is
 * reachable (the exact precondition of `add_media_reference`) makes every
 * uploading identity cost rent plus a custodian, and means nothing is pinned
 * that could never be recorded on-chain.
 */
export async function canPinFor(
  wallet: string
): Promise<{ allowed: boolean; reason?: string }> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return { allowed: false, reason: "Invalid wallet in session" };
  }
  let will: WillView | null;
  try {
    // Uncached: uploads are rare, and an owner who has just revoked a trigger
    // (status back to Active) should be able to upload immediately.
    will = await fetchWillUncached(willPda(owner));
  } catch (err) {
    console.error("[authz] will lookup failed:", err);
    return {
      allowed: false,
      reason: "Could not verify your vault on-chain; try again shortly",
    };
  }
  if (!will || !will.owner.equals(owner)) {
    return { allowed: false, reason: "Create your will before adding documents" };
  }
  if (will.status !== WILL_STATUS.Active) {
    return {
      allowed: false,
      reason: "Documents can only be added while the will is active",
    };
  }
  if (will.custodianCount === 0 || will.minApprovals > will.custodianCount) {
    return {
      allowed: false,
      reason:
        "Add a custodian, and keep required approvals within the custodian count, before adding documents",
    };
  }
  return { allowed: true };
}

// Fail fast at import time if a layout ever drifts out from under the offsets.
if (
  MEDIA_OFFSETS.ipfsCid + CID_BYTE_LEN + 1 !== MEDIA_LEN ||
  BENEFICIARY_OFFSETS.hasClaimed + 1 + 32 + 1 !== BENEFICIARY_LEN ||
  WILL_OFFSETS.minApprovals + 1 + 1 + 1 + 4 + 2 + 2 + 2 + 1 !== WILL_LEN
) {
  throw new Error(
    "authz.ts account offsets no longer match the program layout — regenerate them"
  );
}
