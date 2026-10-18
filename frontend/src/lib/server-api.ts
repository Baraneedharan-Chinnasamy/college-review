import "server-only";

import { connection } from "next/server";

import { API_PREFIX, API_URL } from "./config";
import { toQueryString, type QueryValue } from "./query";

/**
 * Fetches public data from the backend inside Server Components.
 * Returns `null` for 404 so pages can call `notFound()`.
 */
export async function serverGet<T>(
  path: string,
  query: Record<string, QueryValue> = {},
): Promise<T | null> {
  // Always fetch at request time: ratings change whenever someone posts a review.
  await connection();
  const res = await fetch(`${API_URL}${API_PREFIX}${path}${toQueryString(query)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
