import { NextResponse } from "next/server";
import { PinataSDK } from "pinata";

// This route IS the IPFS backend: the browser POSTs a file here, we pin it to
// IPFS via Pinata (server-side, so the JWT never reaches the client) and return
// the CID, which the frontend then writes on-chain.
//
// The on-chain `MediaReference.ipfs_cid` field is a fixed `[u8; 46]`, which is
// exactly the length of a CIDv0 ("Qm..."). We therefore force `cidVersion(0)`.

export const runtime = "nodejs";

function getPinata() {
  const jwt = process.env.PINATA_JWT_TOKEN?.trim();
  if (!jwt) {
    throw new Error("PINATA_JWT_TOKEN is not configured on the server");
  }
  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: process.env.PINATA_GATEWAY?.trim() || undefined,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided under the 'file' field" },
        { status: 400 }
      );
    }

    const pinata = getPinata();
    const result = await pinata.upload.public.file(file).cidVersion("v0");
    const cid = result.cid;

    if (!cid || cid.length !== 46) {
      // Defensive: the contract only accepts 46-byte CIDv0 strings.
      return NextResponse.json(
        {
          error: `Pinata returned a CID of length ${cid?.length ?? 0}; expected 46 (CIDv0). Cannot store on-chain.`,
          cid,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      cid,
      name: file.name,
      size: file.size,
      mediaType: file.type || "application/octet-stream",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[ipfs/upload]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
