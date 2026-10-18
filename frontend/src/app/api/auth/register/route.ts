import type { NextRequest } from "next/server";

import { exchangeForSession } from "@/lib/auth-handlers";

export function POST(request: NextRequest) {
  return exchangeForSession(request, "/auth/register");
}
