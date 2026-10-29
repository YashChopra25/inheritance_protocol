import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSessionToken, SESSION_COOKIE } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * End the current session. Safe to call when not signed in.
 *
 * Clearing the cookie alone only deletes this browser's copy; a cookie that was
 * copied or exfiltrated earlier would stay valid until it expired. So the
 * session id it carries is first added to the revocation list in the shared KV
 * store, which `readSessionToken` consults on every request.
 *
 * Revocation is per session, not per wallet: the client calls this whenever
 * the user switches wallet accounts, and that must not sign the same wallet out
 * on the user's other devices.
 *
 * If the revocation write fails the cookie is still cleared — the user asked
 * to leave — and the failure is reported as `revoked: false` (and logged).
 */
export async function POST() {
  const jar = await cookies();
  const revoked = await revokeSessionToken(jar.get(SESSION_COOKIE)?.value);
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json(
    { ok: true, revoked },
    { headers: { "Cache-Control": "no-store" } }
  );
}
