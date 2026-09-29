# Model Governance

Compass separates model discovery from model access and execution.

## Lifecycle

Administrators manage each catalog entry through `PATCH /admin/router/models/{model_id}`:

- `available`: eligible for routing when the provider is healthy and credentials exist.
- `unavailable`: temporarily blocked while retaining the catalog record.
- `deprecated`: no longer accepted for new requests.
- `expired`: permanently retired from request routing.

The same endpoint controls `enabled`, `published`, and `fallback_model_id`. The public model list only exposes enabled and published entries; `/admin/router/models` exposes the full governance view.

## Provider health

`GET /admin/router/providers` exposes provider status, enabled state, latest health check, latency, and error rate. Circuit-open events are persisted in the operational event log and surfaced through `/admin/operations/metrics` and `/admin/operations/events`.

## Routing policies

Administrators can create stable aliases without changing client configuration:

- `PUT /admin/router/policies/{alias}` with `{ "candidate_models": ["openai/gpt-5", "gemini/gemini-3.6-flash"], "enabled": true }`
- `GET /admin/router/policies`
- `DELETE /admin/router/policies/{alias}`

Candidates are evaluated in order. Disabled or unavailable candidates are skipped, and the alias fails clearly when no candidate can route. API-key model grants still apply to the underlying candidate models.

## Team model policies

Team owners and administrators can inspect effective policies with `GET /teams/{team_id}/model-policies` and update one with `PUT /teams/{team_id}/model-policies/{model_id}`.

Each policy supports:

- enable/disable for the team;
- requests per minute;
- daily spend limit in INR paise;
- monthly spend limit in INR paise.

Limits are checked before provider execution for chat, Responses, embeddings, image, audio, and batch-compatible paths. A missing override means enabled with no model-specific quota; team and API-key limits still apply.

Native provider adapters remain outside this module. Governance controls the catalog and routing boundary around the existing LiteLLM proxy.
