import type { ApiErrorBody, ApiErrorDetail, User } from "./types";
import { toQueryString, type QueryValue } from "./query";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, body?: Partial<ApiErrorBody> | null) {
    super(body?.message ?? "Something went wrong. Please try again.");
    this.status = status;
    this.code = body?.code ?? "UNKNOWN";
    this.details = body?.details ?? [];
  }

  /** Field-level validation messages keyed by field name (e.g. `{ email: "..." }`). */
  get fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const detail of this.details) {
      if (detail.field && !errors[detail.field]) {
        errors[detail.field] = detail.message.replace(/^Value error, /, "");
      }
    }
    return errors;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
}

async function request<T>(url: string, { method = "GET", body, query }: RequestOptions = {}) {
  let res: Response;
  try {
    res = await fetch(`${url}${query ? toQueryString(query) : ""}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, { message: "Network error. Check your connection and try again." });
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data as T;
}

/** Calls the backend through the Next.js proxy, which attaches the session token. */
export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>) =>
    request<T>(`/api/backend${path}`, { query }),
  post: <T>(path: string, body: unknown) =>
    request<T>(`/api/backend${path}`, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(`/api/backend${path}`, { method: "PATCH", body }),
  delete: (path: string) => request<void>(`/api/backend${path}`, { method: "DELETE" }),
};

export const authApi = {
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (body: { email: string; password: string }) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    role: "student" | "teacher";
  }) => request<{ user: User }>("/api/auth/register", { method: "POST", body }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
};
