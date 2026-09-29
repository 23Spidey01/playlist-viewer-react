# Hitbloq Spring Proxy

Spring Boot equivalent of the provided Node/Express `proxy.cjs`.

## Requirements

- Java 17+
- Maven 3.9+

## Run

```bash
mvn spring-boot:run
```

The proxy starts on port `3001`, matching the original Express app.

Cross-origin browser access is denied by default. If the frontend is hosted on a separate origin,
set `APP_CORS_ALLOWED_ORIGINS` to its exact origin (or a comma-separated list), without trailing
slashes or wildcards. Same-origin deployments need no setting. The `dev` profile allows
`http://localhost:5173` and `http://127.0.0.1:5173` unless overridden.

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
