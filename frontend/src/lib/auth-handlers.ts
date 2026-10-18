import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { backendUnavailable, callBackend, errorJson, isSameOrigin, setSessionCookie } from "./bff";
import type { User } from "./types";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  user: User;
}

/** Shared by /api/auth/login and /api/auth/register: obtain a JWT and store it in the cookie. */
export async function exchangeForSession(request: NextRequest, backendPath: string) {
  if (!isSameOrigin(request)) return errorJson(403, "FORBIDDEN", "Cross-site request blocked");

  let upstream: Response;
  try {
    upstream = await callBackend(request, backendPath, {
      method: "POST",
      body: await request.text(),
    });
  } catch {
    return backendUnavailable();
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(data ?? {}, { status: upstream.status });
  }

  const { access_token, expires_in, user } = data as TokenResponse;
  const response = NextResponse.json({ user }, { status: upstream.status });
  setSessionCookie(response, access_token, expires_in);
  return response;
}
