import { NextResponse } from "next/server";
import { canPinFor } from "@/lib/server/authz";
import {
  checkUploadLength,
  checkUploadQuota,
  rateLimit,
  rateLimitByIp,
  recordUpload,
  requireSession,
  serverError,
  WRITE_LIMIT,
} from "@/lib/server/guard";
import { getPinata, pinSealedFile } from "@/lib/server/pinata";

// This route is the IPFS backend: the browser POSTs an ALREADY-ENCRYPTED
// container here (see `lib/crypto.ts`), we pin it via Pinata — server-side, so
// the JWT never reaches the client — and return the CID, which the frontend
// then writes on-chain.
//
// Guards, in order of cost:
//   * session, per-wallet and per-IP rate limits, and a Content-Length ceiling
//     checked before the body is buffered (C4, H3);
//   * the caller must own an Active will that can accept media — sessions are
//     free, wills are not, so this is what makes the quotas mean anything;
//   * per-wallet and global byte budgets, charged only on success;
//   * the body must be a sealed container, pinned PRIVATELY and tagged with the
//     uploader, which is what `authorizeCid` later binds write access to (C5).

export const runtime = "nodejs";

/** Sealed containers always start with this magic — see `lib/crypto.ts`. */
const SEAL_MAGIC = "VSEAL1";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const limited =
      (await rateLimit(`upload:${auth.wallet}`, WRITE_LIMIT)) ??
      (await rateLimitByIp(request, "upload"));
    if (limited) return limited;

    const badLength = checkUploadLength(request);
    if (badLength) return badLength;

    const eligible = await canPinFor(auth.wallet);
    if (!eligible.allowed) {
      return NextResponse.json({ error: eligible.reason }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided under the 'file' field" },
        { status: 400 }
      );
    }

    const overQuota = await checkUploadQuota(auth.wallet, file.size);
    if (overQuota) return overQuota;

    // Refuse anything that is not a sealed container. Without this check a
    // client bug (or a tampered build) could silently publish plaintext, and the
    // CID would be on-chain before anyone noticed.
    const head = new TextDecoder().decode(
      new Uint8Array(await file.slice(0, SEAL_MAGIC.length).arrayBuffer())
    );
    if (head !== SEAL_MAGIC) {
      return NextResponse.json(
        {
          error:
            "Refusing to pin an unencrypted file. Documents must be sealed in the browser first.",
        },
        { status: 400 }
      );
    }

    const cid = await pinSealedFile(getPinata(), file, auth.wallet);
    if (!cid) {
      return NextResponse.json(
        { error: "Pinning service did not return a CID" },
        { status: 502 }
      );
    }
    await recordUpload(auth.wallet, file.size);

    // Size describes the CIPHERTEXT only; the real filename and type are
    // encrypted inside the container and never touch the server.
    return NextResponse.json(
      { cid, size: file.size },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError("ipfs/upload", err);
  }
}
