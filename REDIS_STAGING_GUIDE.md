# Redis Staging Integration

Compass Router uses standard Redis over TCP/TLS through `redis-py`. The same
`REDIS_URL` setting is used locally, in Cloud Run, and by the rate limiter.

## Required Redis behavior

- `PING` for readiness checks.
- Lua `EVAL` for atomic per-team request and token reservations.
- `INCR`, `INCRBY`, and `EXPIRE` from the Lua script.
- TLS and URL authentication for hosted staging Redis.
- Connection pooling, bounded connect/read timeouts, and bounded retries.

The wallet, payment, and ledger remain authoritative in Neon PostgreSQL. Redis
does not store balances or settle financial records.

## Staging configuration

Set the following in the ignored local `.env` for local verification, or in the
staging Secret Manager version referenced by the Cloud Run template:

```text
REDIS_URL=rediss://USERNAME:PASSWORD@HOST:PORT/0
REDIS_SOCKET_TIMEOUT_SECONDS=1.5
REDIS_CONNECT_TIMEOUT_SECONDS=3.0
REDIS_MAX_CONNECTIONS=20
REDIS_RETRY_ATTEMPTS=2
```

The password must be URL-encoded. Do not put this value in Git, a Docker build
argument, a browser variable, or a rendered Cloud Run YAML file.

Upstash is acceptable only when the provisioned endpoint supports standard
Redis TLS, authentication, Lua `EVAL`, and the commands above. Upstash REST is
not a substitute for this Redis protocol because the limiter requires atomic
server-side Lua execution. Google Cloud Memorystore is the compatible
alternative if the selected Upstash plan does not provide those semantics.

## Verification

Run from the repository root:

```text
python -m pytest -q tests/test_redis.py
```

The live check is intentionally read-only and performs only `PING`:

```text
python -c "from app.config import get_settings; from app.services import check_redis; print(check_redis(get_settings().redis_url))"
```

Do not run the live check until a dedicated staging Redis endpoint is in the
ignored `.env`. A production deployment must reference the Redis Secret Manager
version through `REDIS_URL_SECRET` and `REDIS_URL_SECRET_VERSION`.
