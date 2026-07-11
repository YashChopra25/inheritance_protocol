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

export async function POST(request: Request) {
  try {
    const { cid, fileId, name } = await request.json();
    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Missing or empty name parameter" },
        { status: 400 }
      );
    }

    const pinata = getPinata();
    let targetFileId = fileId;

    if (!targetFileId && cid) {
      if (cid.length !== 46) {
        return NextResponse.json(
          { error: "Invalid CID parameter" },
          { status: 400 }
        );
      }
      const response = await pinata.files.public.list().cid(cid);
      if (response && response.files && response.files.length > 0) {
        targetFileId = response.files[0].id;
      } else {
        return NextResponse.json(
          { error: "File not found on Pinata for the given CID" },
          { status: 404 }
        );
      }
    }

    if (!targetFileId) {
      return NextResponse.json(
        { error: "Missing fileId or cid parameter" },
        { status: 400 }
      );
    }

    const updateResponse = await pinata.files.public.update({
      id: targetFileId,
      name: name.trim(),
    });

    return NextResponse.json({ success: true, file: updateResponse });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update metadata";
    console.error("[ipfs/update] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
