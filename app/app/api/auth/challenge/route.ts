import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/server/session";
import { rateLimit, serverError, WRITE_LIMIT } from "@/lib/server/guard";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

/**
 * Step 1 of sign-in: hand the client a single-use message to sign.
 *
 * Unauthenticated by definition, so it is rate limited by the claimed wallet to
 * keep challenge minting from becoming a free CPU sink.
 */
export async function GET(request: Request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }
    try {
      new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { error: "That is not a valid Solana address" },
        { status: 400 }
      );
    }

    const limited = rateLimit(`challenge:${wallet}`, WRITE_LIMIT);
    if (limited) return limited;

    return NextResponse.json(createChallenge(wallet), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError("auth/challenge", err);
  }
}
