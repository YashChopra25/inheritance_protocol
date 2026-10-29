import { NextResponse } from "next/server";
import { authorizeCid } from "@/lib/server/authz";
import {
  invalidCidResponse,
  isValidCid,
  rateLimit,
  readJson,
  requireSession,
  serverError,
  WRITE_LIMIT,
} from "@/lib/server/guard";
import { getPinata } from "@/lib/server/pinata";

export const runtime = "nodejs";

/**
 * Unpin a document. Uploader-only.
 *
 * Authorization binds to the wallet that pinned the file, not to whoever's will
 * references the CID — references can be forged by anyone, since every CID is
 * public (see `authz.ts`). Binding to the uploader is also what lets the owner
 * clean up after the on-chain reference is already gone, or was never written
 * because the transaction failed.
 *
 * Only the caller's own pin records are removed; a byte-identical pin made by
 * someone else is left alone.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const limited = await rateLimit(`delete:${auth.wallet}`, WRITE_LIMIT);
    if (limited) return limited;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { cid } = json.body;
    if (!isValidCid(cid)) return invalidCidResponse();

    const pinata = getPinata();
    const decision = await authorizeCid(pinata, auth.wallet, cid, "write");
    if (decision.notPinned) {
      // Already gone: report success so a retried teardown is idempotent.
      return NextResponse.json({ success: true, alreadyRemoved: true });
    }
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason }, { status: 403 });
    }

    await pinata.files.private.delete(decision.pins.map((p) => p.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError("ipfs/delete", err);
  }
}
