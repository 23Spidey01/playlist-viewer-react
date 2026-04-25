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
