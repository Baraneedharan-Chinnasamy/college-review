/** Only allow same-site relative paths after login, to prevent open redirects (`//evil.com`). */
export function safeNext(value: string | string[] | undefined, fallback = "/colleges"): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
