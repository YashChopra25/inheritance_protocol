import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signInOrigin,
  verifyChallenge,
} from "@/lib/server/session";
import {
  rateLimit,
  rateLimitByIp,
  readJson,
  serverError,
  WRITE_LIMIT,
} from "@/lib/server/guard";

export const runtime = "nodejs";

/**
 * Step 2 of sign-in: verify the wallet's signature over the challenge and set
 * the session cookie.
 *
 * The cookie is HttpOnly (so no script can read it, including anything that
 * ever slips past the CSP), SameSite=Strict (so no cross-site request can spend
 * it) and Secure outside development.
 */
export async function POST(request: Request) {
  try {
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { token, wallet, message, signature } = json.body;

    if (
      typeof token !== "string" ||
      typeof wallet !== "string" ||
      typeof message !== "string" ||
      typeof signature !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing token, wallet, message or signature" },
        { status: 400 }
      );
    }

    const limited =
      (await rateLimit(`verify:${wallet}`, WRITE_LIMIT)) ??
      (await rateLimitByIp(request, "verify"));
    if (limited) return limited;

    // Recomputed independently from this request, never taken from the body:
    // a signature collected on another origin must not verify here.
    const result = await verifyChallenge(
      token,
      wallet,
      message,
      signature,
      signInOrigin(request)
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(SESSION_COOKIE, createSessionToken(wallet), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json(
      { wallet },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError("auth/verify", err);
  }
}
