import { NextResponse } from "next/server";
import { createChallenge, signInOrigin } from "@/lib/server/session";
import {
  rateLimit,
  rateLimitByIp,
  serverError,
  WRITE_LIMIT,
} from "@/lib/server/guard";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

/**
 * Step 1 of sign-in: hand the client a single-use message to sign.
 *
 * Unauthenticated by definition, so it is rate limited by the claimed wallet
 * and, behind a trusted proxy, by IP — wallets are free to mint, so the wallet
 * key alone would not keep challenge minting from becoming a free CPU sink.
 *
 * The message is bound to this site's origin (`APP_ORIGIN`, else this
 * request's Host) — see `signInOrigin` — so a challenge relayed through a
 * phishing site cannot be redeemed here.
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

    const limited =
      (await rateLimit(`challenge:${wallet}`, WRITE_LIMIT)) ??
      (await rateLimitByIp(request, "challenge"));
    if (limited) return limited;

    return NextResponse.json(createChallenge(wallet, signInOrigin(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError("auth/challenge", err);
  }
}
