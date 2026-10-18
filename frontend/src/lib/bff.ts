import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { API_PREFIX, API_URL, TOKEN_COOKIE } from "./config";

/**
 * Backend-for-frontend helpers used by the route handlers in `app/api`.
 * The browser only ever talks to Next.js; the JWT lives in an httpOnly cookie.
 */

export function errorJson(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, details: null } }, { status });
}

/** CSRF defence for cookie-authenticated writes: the Origin must match this host. */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, tests) don't send Origin
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function callBackend(
  request: NextRequest,
  path: string,
  init: { method: string; body?: string; token?: string },
): Promise<Response> {
  const headers = new Headers({ Accept: "application/json" });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  // Correlate web and API logs, and let the API rate-limit by the real client address.
  headers.set(
    "X-Request-ID",
    request.headers.get("x-request-id") ?? crypto.randomUUID().replaceAll("-", ""),
  );
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor);

  return fetch(`${API_URL}${API_PREFIX}${path}`, {
    method: init.method,
    headers,
    body: init.body,
  });
}

export const backendUnavailable = () =>
  errorJson(502, "BAD_GATEWAY", "The API is unreachable. Is the backend running?");

export function setSessionCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(TOKEN_COOKIE);
}
