import { NextResponse } from "next/server";
import { PinataSDK } from "pinata";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");
    if (!cid || cid.length !== 46) {
      return NextResponse.json(
        { error: "Invalid or missing CID parameter (expected 46-char CIDv0)" },
        { status: 400 }
      );
    }

    const pinata = getPinata();
    
    // Fetch files matching the CID
    const response = await pinata.files.public.list().cid(cid);
    
    if (response && response.files && response.files.length > 0) {
      const file = response.files[0];
      return NextResponse.json({
        id: file.id,
        cid: file.cid,
        name: file.name,
        size: file.size,
        mimeType: file.mime_type,
        createdAt: file.created_at,
        keyvalues: file.keyvalues,
      });
    }

    return NextResponse.json(
      { error: "File not found on Pinata" },
      { status: 404 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch metadata";
    console.error("[ipfs/metadata] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
