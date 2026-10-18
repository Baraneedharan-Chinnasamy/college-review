# Production readiness

## Already in place

**Security**
- bcrypt password hashing, run in a thread pool so it never blocks the event loop; enforced password policy and bcrypt's 72-byte limit.
- Short-lived JWTs (HS256, `exp`/`iat`/`type` claims, algorithm pinned on decode). The user and role are reloaded from the DB on every request, so deactivation and role changes apply immediately.
- Login gives no clue whether an email exists (same message, constant-time path).
- Rate limiting on `/auth/login` and `/auth/register`.
- Request bodies reject unknown fields (no mass assignment of `role`, `author_id`, …), and regex search input is escaped.
- CORS allow-list, security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`), no stack traces in 5xx responses.
- The app refuses to start in `production` with the default JWT secret.
- Web app: the JWT lives in an httpOnly, SameSite=Lax cookie that JavaScript can't read. Writes through the proxy are Origin-checked (CSRF), and post-login redirects only accept relative paths.

**Data**
- Unique indexes enforce invariants (one review per user per college; case-insensitive unique college names; unique emails) instead of relying on check-then-insert.
- Every list and aggregation is backed by an index; ratings are aggregated with `$lookup` + `$group` in a single `$facet` round-trip, and paginated before aggregating when the sort allows.

**Operations**
- 12-factor config via environment variables (`.env.example`), health endpoint with DB check (`200`/`503`), Docker health checks.
- Request IDs (`X-Request-ID`, propagated from the web tier) and access logs with timings.
- Non-root, slim Docker images; standalone Next.js build; MongoDB bound to localhost in Compose.
- CI pipeline (lint, format, type-check, 131 tests with a 90% coverage gate, production build).

## Before a real launch

| Area | Change |
| --- | --- |
| Secrets & TLS | Load `JWT_SECRET` and DB credentials from a secrets manager; terminate HTTPS at a load balancer (cookies are already `Secure` in production). |
| MongoDB | Run a replica set or Atlas with auth/TLS, backups and point-in-time restore. Wrap the cascade delete (college → reviews) in a **transaction**. |
| Rating at scale | Keep `avg_rating`/`review_count` denormalised on `colleges`, updated on each review write (or via change streams), so listing never has to `$lookup`. The current read-time aggregation is fine for thousands of reviews, not millions. |
| Search | Move to Atlas Search (fuzzy, prefix and multi-field relevance) instead of `$text` + regex. |
| Rate limiting | Use Redis storage for the limiter (currently in-memory per worker), add limits on write endpoints, and only trust `X-Forwarded-For` from your own load balancer (set `FORWARDED_ALLOW_IPS` to its address rather than `*`). |
| Auth | Refresh tokens with rotation and a revocation list, email verification, password reset, and verification of teacher accounts before they get edit rights. |
| Observability | Structured JSON logs, OpenTelemetry tracing, metrics (latency, error rate), alerting, Sentry for both tiers. |
| Abuse & content | Review moderation queue/reporting, profanity/spam checks, audit log of admin actions. |
| Delivery | Container registry + IaC (Terraform), staging environment, migrations/index rollout step, load testing, Dependabot/Snyk scanning. |
| Frontend | Add Playwright end-to-end tests and a CSP header; cache public college pages with `use cache` + tag revalidation on review writes. |
