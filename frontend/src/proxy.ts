import { NextResponse, type NextRequest } from "next/server";

const TOKEN_COOKIE = "cr_token";

/** Signed-out visitors are sent to /login before reaching account pages. Roles are checked by the API. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(TOKEN_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/my-reviews/:path*"],
};
