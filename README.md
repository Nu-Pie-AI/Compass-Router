# Compass

Compass is a single AI marketplace and model-routing product. Marketplace provides the canonical login and product entry point; Compass Router provides the model catalog, BYOK, API keys, usage, billing, workspaces, and OpenAI-compatible API.

## Repository Layout

- `apps/api` and `apps/web` - Compass Router API and web console.
- `marketplace` - Marketplace application and shared-login entry point.
- `compass-code` - VS Code coding-agent extension backed by Compass Router.
- `packages`, `services`, `docs`, and `tests` - shared contracts, local infrastructure, documentation, and tests.

## Local Development

The Router can be started with the root Docker Compose stack. The Marketplace has its own Next.js development workflow under `marketplace`.

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

The Router console is available at `http://localhost:23000/` and the API at `http://localhost:28000/` when using the controlled-beta Compose configuration. Marketplace `/compass` is the single-login handoff into the Router console.

## Deployment

The `cloudbuild-router-images.yaml` and `cloudbuild-router-web-production.yaml` files build the Router images. Marketplace contains its own `cloudbuild-marketplace-image.yaml`. Provider credentials and application secrets must be supplied through the deployment secret manager; they are not stored in this repository.

## Security and Persistence

Never commit `.env` files, provider keys, OAuth secrets, API keys, or local databases. Production deployments must use a managed database instead of the temporary SQLite configuration used for the current deployment smoke test.

## Local Console

The public homepage remains at `http://localhost:23000/`. The console uses a light layout with a page search, team workspace selector, and mobile navigation.

- `/api-keys`: searchable team-scoped key list, model grants, expiry/last-used timestamps, one-time secret display, and individual/bulk revocation.
- `/teams`: team wallet summaries, team creation, member listing/creation, and links to the selected team's keys and wallet.
- `/workspaces`: all team workspaces and balances.
- `/profile`: the signed-in local customer or administrator identity.
- `/models`: an OpenRouter-style searchable directory backed by the controlled LiteLLM model registry, with provider, modality, context, capability, and pricing filters.
- `/byok`: encrypted, team-scoped provider API keys for supported single-key providers. Raw provider keys are never returned after submission.
- Existing `/dashboard`, `/chat`, `/playground`, `/usage`, `/wallet`, and `/admin` workflows remain available.

Workspace selection persists in browser storage. Per-key request totals and daily/monthly spending limits are enforced before provider execution and are visible in the API-key console. Model lifecycle, provider health, routing aliases, and team model budgets are documented in `docs/model-governance.md`. Personal-to-team credit allocation, member budgets, guardrails, files, classifiers, presets, and management keys remain outside the current beta scope. Unsupported navigation is disabled; no sample balances or limits are substituted for real data. Platform Keys remain operator-managed; BYOK keys belong to a team and are preferred for that team's requests.

The directory reads the same LiteLLM-maintained registry exposed by the controlled proxy. It is broad provider metadata, not a claim that every model on the internet is callable. Catalog discovery alone does not grant access. A team owner saves a supported BYOK key, enables a chat model, and then attaches that provider-native model ID to a Compass API key.

## Repository Layout

- `apps/api` - FastAPI backend.
- `apps/web` - Next.js web application shell.
- `packages/shared` - shared TypeScript contracts.
- `services/litellm` - legacy deterministic LiteLLM-compatible test helper.
- `infra/docker` - Docker Compose and local infrastructure.
- `docs` - architecture, security, billing, deployment, and runbooks.
- `tests` - API integration tests.

## Quick Start

```powershell
Copy-Item .env.example .env
notepad .env
python -m venv .venv
.\.venv\Scripts\python -m pip install -r apps/api/requirements.txt
$env:PYTHONPATH='apps/api'
.\.venv\Scripts\python -m pytest tests
.\.venv\Scripts\uvicorn app.main:app --app-dir apps/api --reload --port 8000
```

Open `http://127.0.0.1:8000/health`.

When `LOCAL_TEST_MODE=true`, three active local accounts are seeded idempotently into the application database on API startup:

- Admin: `admin@example.com` / `CompassAdmin123!`
- Customer 1: `customer@example.com` / `CompassCustomer123!`
- Customer 2: `customer2@example.com` / `CompassCustomer456!`

The values are configurable with `ADMIN_*`, `LOCAL_TEST_CUSTOMER_*`, and `LOCAL_TEST_CUSTOMER_2_*` in `.env`. These are local development fixtures only. Self-service signup remains enabled in local Compose through `PUBLIC_SIGNUP_ENABLED=true`.

When `LOCAL_TEST_MODE=false`, startup does not create fixture models, provider credentials, provider availability, or customer pricing. Production model rows must come from a verified catalog synchronization, an explicit pricing policy, configured provider credentials, provider enablement, and administrator activation.

Use the dashboard to create a beta team, credit its test wallet, issue a Compass API key, and run requests from the Playground. API keys are shown once and only the hash is stored.

## LiteLLM Integration

Compass calls LiteLLM through `COMPASS_LITELLM_URL` and authenticates to the proxy with `LITELLM_MASTER_KEY`. The controlled LiteLLM source/build lives in the separate sibling repository:

`C:\Users\tohee\Desktop\compass-litellm`

Upstream source: `https://github.com/BerriAI/litellm`. Public model reference: `https://models.litellm.ai/`.

The local Compose stack in this nested copy builds that controlled proxy from `..\..\compass-litellm` as `compass-litellm:1.99.0-compass.1` from upstream LiteLLM `v1.99.0` commit `fa647f742d7baefe8eb1181899d9c81b41559772`. The legacy mock at `services/litellm/local_dev_server.py` is retained only for deterministic tests and emergency local debugging.

## Controlled Beta Flow

1. A Compass operator logs in to the dashboard.
2. The operator creates a tester team and member.
3. The team owner optionally saves a provider key under BYOK and enables compatible chat models.
4. The operator grants model access and creates a Compass API key.
5. The operator credits the team wallet with local test INR paise.
6. The tester configures Cline or another OpenAI-compatible client with:
   - Base URL: `http://localhost:28000/v1`
   - API key: `sk-compass-...`
   - Models: provider-native IDs such as `openai/gpt-5` or `gemini/gemini-3.6-flash`
7. Compass validates the key, checks model grants, checks wallet balance, selects team BYOK before a platform credential, calls controlled LiteLLM, records usage, debits the wallet, and returns an OpenAI-compatible response.

`LOCAL_TEST_MODE=true` keeps three provider-native demonstration IDs mapped to deterministic controlled-LiteLLM routes unless a team BYOK key is present. BYOK requests use the requested provider-native ID and are real provider calls.

## Docker

```powershell
docker compose up --build -d
```

The root Compose file starts:

- PostgreSQL on host port `25432`
- Redis on host port `26379`
- Compass API on host port `28000`
- Compass Web on host port `23000`
- controlled LiteLLM on host port `24000`

Health checks:

```powershell
Invoke-RestMethod http://localhost:28000/health
Invoke-RestMethod http://localhost:28000/health/ready
```

## Frontend

```powershell
Set-Location apps/web
npm run lint
npm run typecheck
npm run build
```

## VS Code Extension

The sibling `..compass-code` folder contains a local-alpha VS Code coding-agent extension. Build and install it from the repository root:

```powershell
Set-Location ..\compass-code
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run package
code.cmd --install-extension .\compass-router-0.3.6.vsix --force
```

Open the Compass Code activity-bar view and connect it to `http://localhost:28000` with a Compass API key. The extension uses `/v1/models`, `/v1/account`, and `/v1/chat/completions`; provider keys remain server-side.

## Current Status

The Router includes session revocation and login throttling, Secret Manager/BYOK references, Responses and batch lifecycle endpoints, billing webhooks/refunds/invoices/reconciliation, model governance, provider-health events, operational metrics, and an SMTP-backed transactional email outbox worker. Native provider adapters remain outside this codebase; production OAuth, SMTP credentials and deliverability, live Razorpay verification, GCP IAM/alert policy configuration, and Cloud Run secret values remain deployment prerequisites.
