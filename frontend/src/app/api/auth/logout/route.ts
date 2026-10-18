import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookie, errorJson, isSameOrigin } from "@/lib/bff";

export function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorJson(403, "FORBIDDEN", "Cross-site request blocked");
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
