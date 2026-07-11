import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const gateway = process.env.PINATA_GATEWAY?.trim() || "gateway.pinata.cloud";
    // Prepend protocol if missing
    const gatewayUrl = gateway.startsWith("http") ? gateway : `https://${gateway}`;
    const fileUrl = `${gatewayUrl}/ipfs/${cid}`;

    const headers: Record<string, string> = {};
    if (process.env.PINATA_JWT_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.PINATA_JWT_TOKEN.trim()}`;
    }

    const res = await fetch(fileUrl, { headers });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[ipfs/retrieve] Gateway returned status ${res.status}:`, errorText);
      return NextResponse.json(
        { error: `Gateway returned status ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();

    return new Response(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${cid}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve IPFS content";
    console.error("[ipfs/retrieve] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
