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

/** Maximum length of the pin label. Long enough to be useful, short enough to bound. */
const MAX_LABEL = 128;

/**
 * Rename a pin. Uploader-only (see `authz.ts`).
 *
 * The label stored here is NOT the document's real filename — that lives
 * encrypted inside the sealed container (C5) and the server never sees it. This
 * label is visible to the pinning provider, which the rename UI says plainly.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const limited = await rateLimit(`update:${auth.wallet}`, WRITE_LIMIT);
    if (limited) return limited;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { cid, name } = json.body;
    if (!isValidCid(cid)) return invalidCidResponse();

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Provide a non-empty name" },
        { status: 400 }
      );
    }
    if (name.length > MAX_LABEL) {
      return NextResponse.json(
        { error: `Name must be ${MAX_LABEL} characters or fewer` },
        { status: 400 }
      );
    }

    const pinata = getPinata();
    const decision = await authorizeCid(pinata, auth.wallet, cid, "write");
    if (decision.notPinned) {
      return NextResponse.json(
        { error: "That document is not pinned" },
        { status: 404 }
      );
    }
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason }, { status: 403 });
    }

    await Promise.all(
      decision.pins.map((p) =>
        pinata.files.private.update({ id: p.id, name: name.trim() })
      )
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError("ipfs/update", err);
  }
}
