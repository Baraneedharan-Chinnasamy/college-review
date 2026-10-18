import { NextResponse, type NextRequest } from "next/server";

import { backendUnavailable, callBackend, clearSessionCookie } from "@/lib/bff";
import { TOKEN_COOKIE } from "@/lib/config";

/** Returns `{ user }` for the session cookie, or `{ user: null }` when signed out. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });

  let upstream: Response;
  try {
    upstream = await callBackend(request, "/auth/me", { method: "GET", token });
  } catch {
    return backendUnavailable();
  }

  if (!upstream.ok) {
    const response = NextResponse.json({ user: null });
    clearSessionCookie(response);
    return response;
  }
  return NextResponse.json({ user: await upstream.json() });
}
