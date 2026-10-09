# Monitoring

The Router exposes operational data for a Cloud Monitoring or Sentry integration:

- `GET /health/live` checks process liveness.
- `GET /health/ready` checks database, Redis, and LiteLLM readiness.
- `GET /admin/operations/metrics` returns request, provider-circuit, payment-failure, and pending-refund counters.
- `GET /admin/operations/events` returns durable operational events, including provider circuit openings.

Every HTTP request also emits one structured JSON event through the `compass.http`
logger. The current allow-list is `timestamp`, `severity`, `message`, `logger`,
`request_id`, `method`, `path`, `status_code`, `latency_ms`, and `error_type`.
The formatter never serializes arbitrary log extras, query strings, headers,
request bodies, provider payloads, API keys, or authorization values.

Production alert policies should notify on:

- readiness failures or elevated 5xx responses;
- any `provider_circuit_open` event;
- payment failures or reconciliation mismatches;
- sustained rate-limit responses;
- wallet ledger and payment-order mismatches.

The endpoints are admin-authenticated. Cloud Run logs should include the request ID returned in Compass responses, and the deployment should export structured logs and metrics to Cloud Logging and Cloud Monitoring. The local formatter and request middleware are verified; Cloud Logging/Monitoring ingestion, tracing correlation, alert delivery, and production redaction review still require staging verification.
