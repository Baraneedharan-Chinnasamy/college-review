import "server-only";

/** Base URL of the FastAPI backend, as seen from the Next.js server (never exposed to browsers). */
export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_PREFIX = "/api/v1";

/** httpOnly cookie that holds the JWT; JavaScript in the browser can never read it. */
export const TOKEN_COOKIE = "cr_token";
