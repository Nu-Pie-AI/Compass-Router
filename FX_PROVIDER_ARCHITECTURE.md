# M15 FX Provider Architecture

Compass Router uses a provider-neutral `FxRateQuote` contract in `apps/api/app/fx.py`.

- Primary: Frankfurter `GET /v2/rates?base=USD&quotes=INR`.
- Fallback: Fawaz currency API `.../v1/currencies/usd.json` using its documented jsDelivr endpoint.
- Rates are parsed as `Decimal`, require USD/INR, a positive finite rate, and a publication date.
- Approved quotes are durable rows in `fx_rate_quotes`. Redis is only an acceleration cache.
- `POST /internal/jobs/fx-refresh` is intended for an authenticated Cloud Scheduler job. No scheduler or cloud resource is created by M15.
- Production managed inference is rejected when no fresh approved quote exists. BYOK remains independent.

Publication, retrieval, and approval timestamps are stored separately.
