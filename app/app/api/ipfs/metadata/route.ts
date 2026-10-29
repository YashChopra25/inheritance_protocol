import { NextResponse } from "next/server";
import { authorizeCid } from "@/lib/server/authz";
import {
  invalidCidResponse,
  isValidCid,
  rateLimit,
  BULK_READ_LIMIT,
  requireSession,
  serverError,
} from "@/lib/server/guard";
import { getPinata } from "@/lib/server/pinata";

export const runtime = "nodejs";

/**
 * Pinning metadata for one document.
 *
 * Note what is NOT here any more: the stored `name` and `mime_type` used to be
 * the real filename and type. Those are now encrypted inside the sealed
 * container (C5), so this endpoint reports only what the server legitimately
 * knows — when the ciphertext was pinned and how large it is.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const limited = await rateLimit(`metadata:${auth.wallet}`, BULK_READ_LIMIT);
    if (limited) return limited;

    const cid = new URL(request.url).searchParams.get("cid");
    if (!isValidCid(cid)) return invalidCidResponse();

    const pinata = getPinata();
    const decision = await authorizeCid(pinata, auth.wallet, cid, "read");
    if (decision.notPinned) {
      return NextResponse.json(
        { error: "That document is not pinned" },
        { status: 404 },
      );
    }
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason }, { status: 403 });
    }

    const file = decision.pins[0];
    return NextResponse.json(
      {
        id: file.id,
        cid: file.cid,
        /** Operator-visible pin label — NOT the real filename (C5). */
        name: file.name,
        /** Size of the CIPHERTEXT, not the original file. */
        size: file.size,
        createdAt: file.createdAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return serverError("ipfs/metadata", err);
  }
}
