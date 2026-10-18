# CollegeReview — frontend

Next.js 16 (App Router, TypeScript, Tailwind CSS v4). See the [project README](../README.md) for setup.

```bash
npm run dev     # http://localhost:3000 (expects the API on http://localhost:8000)
npm run lint
npm run build
```

## How it talks to the API

The browser never sees the JWT. Route handlers in `src/app/api` act as a small backend-for-frontend:

| Route                                        | Purpose                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`, `/api/auth/register` | Call the API, store the token in an **httpOnly, SameSite=Lax** cookie, return only the user                    |
| `POST /api/auth/logout`                      | Clear the cookie                                                                                               |
| `GET /api/auth/me`                           | Current user (or `null`)                                                                                       |
| `/api/backend/*`                             | Proxy to `API_URL/api/v1/*`, adding `Authorization: Bearer <cookie>`; rejects cross-site writes (Origin check) |

Public pages (`/`, `/colleges`, `/colleges/[id]`) are Server Components that fetch the API directly and
stream in behind `<Suspense>` (Cache Components / Partial Prerendering). Interactive parts (reviews,
forms, admin) are Client Components that call `/api/backend/*`.

## Structure

```
src/
  app/                 routes (home, colleges, colleges/[id], login, register, my-reviews, admin, api/*)
  components/          UI building blocks (cards, stars, review form, navbar, ui/*)
  lib/                 API clients, types, formatting, BFF helpers
  proxy.ts             redirects signed-out users away from /admin and /my-reviews
```
