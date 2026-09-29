# Hitbloq Spring Proxy

Spring Boot equivalent of the provided Node/Express `proxy.cjs`.

## Requirements

- Java 17+
- Maven 3.9+

The backend uses Spring Boot 4.0.8 (Spring Security 7.0.7). The configured password encoder
explicitly rejects input longer than 72 UTF-8 bytes for both hashing and verification.

## Run

```bash
mvn spring-boot:run
```

The proxy starts on port `3001`, matching the original Express app.

Cross-origin browser access is denied by default. If the frontend is hosted on a separate origin,
set `APP_CORS_ALLOWED_ORIGINS` to its exact origin (or a comma-separated list), without trailing
slashes or wildcards. Same-origin deployments need no setting. The `dev` profile allows
`http://localhost:5173` and `http://127.0.0.1:5173` unless overridden.

Registration and password changes require at least 12 characters and at most 72 UTF-8 bytes,
matching BCrypt's input limit. Oversized login and current-password inputs are rejected rather
than truncated. Existing `{bcrypt}` password hashes remain compatible. Authentication endpoints return
HTTP 429 with `Retry-After` when their attempt budget is exhausted. Defaults per 15-minute window:
50 logins/IP, 10 logins/account (shared between username and email), 5 registrations/IP,
30 account changes/IP, and 10 account changes/account. Configure these with
`app.auth-rate-limit.*` (`login-per-ip`, `login-per-account`, `registration-per-ip`,
`changes-per-ip`, `changes-per-account`, `window-seconds`, `max-buckets`).
Counters are bounded to 10,000 entries and kept per application process; multiple replicas
need a shared gateway/limiter for a deployment-wide budget. The limiter uses the direct peer IP;
do not enable forwarded-header trust without a proxy that strips untrusted forwarding headers.

Account usernames are normalized to lowercase and must contain 3–50 letters, digits, `.`, `_`,
or `-`; emails are trimmed, normalized, and validated. Email-only registration gets a generated
username and can still log in with the email. New identifiers are checked against both columns,
including legacy email-shaped usernames. Login fails with 401 if a legacy identifier is ambiguous.

Startup installs case-insensitive unique indexes on usernames and emails after Hibernate schema
initialization. If existing accounts conflict, startup stops without renaming or merging accounts.
Before deploying, identify conflicts with this PostgreSQL query and assign distinct identifiers
to the affected accounts after verifying their ownership; invalidate their sessions by incrementing
`session_version`. Restart after resolving conflicts. No existing account data is automatically rewritten.

```sql
SELECT identifier, array_agg(DISTINCT id) AS account_ids
FROM (
    SELECT id, lower(trim(username)) AS identifier FROM users
    UNION ALL
    SELECT id, lower(trim(email)) AS identifier FROM users WHERE email IS NOT NULL
) identifiers
GROUP BY identifier HAVING count(DISTINCT id) > 1;
```

## Endpoints

```text
POST /proxy/unrank                     -> POST https://hitbloq.com/api/pools/unrank
POST /proxy/rank                       -> POST https://hitbloq.com/api/pools/rank
GET  /proxy/map_pools_detailed         -> GET  https://hitbloq.com/api/map_pools_detailed
GET  /proxy/ranked_list_detailed/{pool_id}/{page}
POST /proxy/recalculate_cr             -> POST https://hitbloq.com/api/pools/recalculate_cr
POST /proxy/set_manual                 -> POST https://hitbloq.com/api/pools/set_manual
POST /proxy/set_automatic              -> POST https://hitbloq.com/api/pools/set_automatic
```
