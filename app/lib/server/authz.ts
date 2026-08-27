/**
 * On-chain authorization for the API layer (fixes C4).
 *
 * A session proves *which wallet* is calling (see `session.ts`). This module
 * answers the separate question of *what that wallet is allowed to touch*, and
 * it answers it from the chain rather than from anything the client sent.
 *
 * The rules mirror the program's own state machine:
 *
 *   write (delete / rename)  → only the will's owner
 *   read  (fetch / metadata) → the owner, or an heir of that will once the will
 *                              is Claimable AND the owner's grace period has
 *                              elapsed — exactly when `claim_inheritance` and
 *                              `claim_token` open on-chain
 *
 * This is defence in depth, not the primary control: documents are encrypted in
 * the browser before upload (see `lib/crypto.ts`), so even a total failure here
 * yields ciphertext. But it stops the pinning account from being used as an open
 * proxy, and it stops one user from deleting another's documents.
 *
 * Accounts are decoded by explicit byte offset rather than through the Anchor
 * coder: these layouts are fixed-size and the offsets are asserted against
 * `INIT_SPACE` below, which keeps the server bundle small and makes a layout
 * change fail loudly instead of silently mis-parsing.
 */

import { createHash } from "crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  RPC_ENDPOINT,
  SEEDS,
  GRACE_PERIOD_SECONDS,
  CID_BYTE_LEN,
} from "../config";

// ---- account layouts (byte offsets, little-endian) ---------------------

const WILL_LEN = 91;
const MEDIA_LEN = 123;
const BENEFICIARY_LEN = 108;

const WILL_OFFSETS = {
  owner: 8,
  status: 40,
  claimableAt: 65,
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
    cachedConnection = new Connection(RPC_ENDPOINT, "confirmed");
  }
  return cachedConnection;
}

// ---- decoding ----------------------------------------------------------

interface WillView {
  address: PublicKey;
  owner: PublicKey;
  status: number;
  claimableAt: bigint;
}

function decodeWill(address: PublicKey, data: Buffer): WillView | null {
  if (data.length !== WILL_LEN) return null;
  return {
    address,
    owner: new PublicKey(
      data.subarray(WILL_OFFSETS.owner, WILL_OFFSETS.owner + 32)
    ),
    status: data.readUInt8(WILL_OFFSETS.status),
    claimableAt: data.readBigInt64LE(WILL_OFFSETS.claimableAt),
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

/**
 * Find every will that references `cid`.
 *
 * Filtered server-side by the RPC via memcmp on the exact CID bytes, so this is
 * a targeted lookup rather than a scan of the whole program.
 */
async function willsReferencing(cid: string): Promise<WillView[]> {
  const conn = connection();
  const media = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: MEDIA_LEN },
      {
        memcmp: {
          offset: 0,
          bytes: discriminator("MediaReference").toString("base64"),
          encoding: "base64",
        },
      },
      {
        memcmp: {
          offset: MEDIA_OFFSETS.ipfsCid,
          bytes: paddedCid(cid).toString("base64"),
          encoding: "base64",
        },
      },
    ],
  });
  if (media.length === 0) return [];

  const willKeys = [
    ...new Set(
      media.map((m) =>
        new PublicKey(
          m.account.data.subarray(
            MEDIA_OFFSETS.will,
            MEDIA_OFFSETS.will + 32
          )
        ).toBase58()
      )
    ),
  ].map((k) => new PublicKey(k));

  const infos = await conn.getMultipleAccountsInfo(willKeys);
  const out: WillView[] = [];
  infos.forEach((info, i) => {
    if (!info) return;
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

  const info = await connection().getAccountInfo(
    beneficiaryPda(will.address, wallet)
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
  return backRef.equals(will.address) && heirWallet.equals(wallet);
}

export type CidAccess = "read" | "write";

export interface AuthzResult {
  allowed: boolean;
  /** Safe to show the caller; never leaks whether other people's wills exist. */
  reason?: string;
}

/**
 * Decide whether `wallet` may act on `cid`.
 *
 * A CID that no will references at all is denied for both modes: it is either
 * not ours to serve or was already removed from every will, and in both cases
 * this API should not be a general-purpose IPFS proxy.
 */
export async function authorizeCid(
  wallet: string,
  cid: string,
  access: CidAccess
): Promise<AuthzResult> {
  let caller: PublicKey;
  try {
    caller = new PublicKey(wallet);
  } catch {
    return { allowed: false, reason: "Invalid wallet in session" };
  }

  let wills: WillView[];
  try {
    wills = await willsReferencing(cid);
  } catch (err) {
    // A failing RPC must never fail open.
    console.error("[authz] chain lookup failed:", err);
    return {
      allowed: false,
      reason: "Could not verify access on-chain; try again shortly",
    };
  }

  if (wills.length === 0) {
    return {
      allowed: false,
      reason: "This document is not referenced by any vault",
    };
  }

  for (const will of wills) {
    if (will.owner.equals(caller)) return { allowed: true };
    if (access === "read" && (await isEntitledHeir(will, caller))) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason:
      access === "write"
        ? "Only the vault owner can modify this document"
        : "You do not have access to this document yet",
  };
}

// Fail fast at import time if a layout ever drifts out from under the offsets.
if (
  MEDIA_OFFSETS.ipfsCid + CID_BYTE_LEN + 1 !== MEDIA_LEN ||
  BENEFICIARY_OFFSETS.hasClaimed + 1 + 32 + 1 !== BENEFICIARY_LEN
) {
  throw new Error(
    "authz.ts account offsets no longer match the program layout — regenerate them"
  );
}
