import { NextResponse, type NextRequest } from "next/server";

import {
  backendUnavailable,
  callBackend,
  clearSessionCookie,
  errorJson,
  isSameOrigin,
} from "@/lib/bff";
import { TOKEN_COOKIE } from "@/lib/config";

/** Forwards `/api/backend/<path>` to `<API_URL>/api/v1/<path>` with the session's bearer token. */
async function forward(request: NextRequest, ctx: RouteContext<"/api/backend/[...path]">) {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return errorJson(403, "FORBIDDEN", "Cross-site request blocked");
  }

  const { path } = await ctx.params;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const target = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const body = request.method === "GET" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await callBackend(request, target, {
      method: request.method,
      body: body || undefined,
      token,
    });
  } catch {
    return backendUnavailable();
  }

  const response = new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
  if (upstream.status === 401 && token) clearSessionCookie(response); // expired/revoked token
  return response;
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST };
