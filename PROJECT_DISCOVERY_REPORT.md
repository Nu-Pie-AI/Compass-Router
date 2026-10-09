# Compass Router Project Discovery Report

Audit date: 2026-10-08 (Asia/Calcutta)
Audit mode: read-only source inspection
Repository: Compass-Litellm-Router
Baseline: main at 9d34810, tag compass-baseline-2026-10-08

## Executive summary

Compass Router is a substantial multi-surface product rather than a single demo. The canonical checkout contains a FastAPI routing and billing service, a Next.js Router console, a separate Next.js marketplace and identity surface, a VS Code extension, shared types, a LiteLLM service definition, Docker Compose, and Cloud Build files.

The strongest implemented path is the authenticated Router API: users, organizations, projects, teams, API keys, model policies, provider selection, wallet reservations, request accounting, and OpenAI-compatible endpoints are represented in code. The VS Code extension also has a real agent loop, workspace tools, permissions, transcript state, and a streaming client contract.

The main production risks are operational rather than cosmetic: no versioned database migration system, no confirmed email delivery worker, provider support is broader in catalog than in direct adapters, streamed chat is synthesized after a complete response, payment and live-provider paths were not verified in this audit, and extension UI tests use a mocked VS Code bridge. The current configuration is intentionally development-oriented unless production variables are supplied and validated.

## Scope and evidence method

This report is based on source inspection, package manifests, configuration, route decorators, model definitions, tests, Docker and Cloud Build files, and tracked documentation. No application code was changed. No dependency was installed. No service was started. No fresh test run is claimed.

Status labels used in this report:
- Implemented: source path is present and internally connected.
- Partial: important pieces exist but a required production or end-to-end piece is missing.
- Mocked: behavior is deliberately local, fixture-backed, or test-bridge based.
- Planned or unverified: referenced by docs or configuration but not proven by current source or live deployment.
- Broken risk: evidence indicates a likely defect or deployment failure that needs a focused reproduction.

## Repository shape

The canonical root includes:
- apps/api: FastAPI application, SQLAlchemy models, schemas, security, services, and tests.
- apps/web: Next.js Router console.
- marketplace: separate Next.js marketplace, identity, Prisma schema, and API routes.
- compass-code: VS Code extension source, webview UI, agent loop, tools, and extension tests.
- packages/shared: shared TypeScript contracts and utilities.
- services/litellm: controlled LiteLLM proxy configuration.
- infra/docker: local multi-service deployment.
- docs: product and continuation notes.
- tests: repository-level checks.
- cloudbuild-api.yaml, cloudbuild-web.yaml, and cloudbuild-litellm.yaml.

The worktree also has untracked nested snapshots, generated VSIX files, browser captures, and working artifacts. They are not treated as canonical implementation sources.

## Technology stack

| Area | Technology | Evidence | Status |
|---|---|---|---|
| Router API | Python, FastAPI, Uvicorn | apps/api requirements and app/main.py | Implemented |
| Persistence | SQLAlchemy with PostgreSQL or SQLite | apps/api/app/db.py | Implemented, migration risk |
| Cache and limits | Redis client paths | services.py and environment examples | Partial, live operation unverified |
| Router proxy | LiteLLM service | services/litellm and Docker/Cloud Build files | Partial, deployment unverified |
| Router console | Next.js, React, TypeScript, Tailwind, Lucide | apps/web/package.json | Implemented |
| Marketplace | Next.js, React, Prisma, NextAuth, BullMQ, Resend | marketplace/package.json and source | Implemented, separate surface |
| Extension | VS Code Extension API, React-style webview renderer, TypeScript | compass-code/package.json and src | Implemented, live host path unverified |
| Cloud deployment | Docker and Google Cloud Build | Dockerfiles and cloudbuild files | Partial |
| Payments | Razorpay integration paths | API routes, schemas, environment names | Partial, live provider unverified |

## Primary user journeys

1. Sign up or log in to the Router.
2. Complete email OTP where enabled.
3. Enter an organization workspace.
4. Create a project and team.
5. Create a scoped API key and select model access.
6. Configure providers or BYOK credentials.
7. Send OpenAI-compatible chat, response, embedding, image, audio, or batch requests.
8. Route to a provider, reserve wallet balance, record attempts and usage, settle the final amount, and expose usage records.
9. Connect the VS Code extension through device authorization or API key flow.
10. Tag extension requests with a project identifier and use the agent workspace tools.

Marketplace users can authenticate separately and exchange a short-lived signed handoff token into the Router.

## Architecture findings

The Router is the product center. The API owns authentication, authorization, organization and project access, API key verification, provider routing, cost calculation, wallet accounting, billing, request records, and extension device authorization. The web console is a client of that API. The extension is another client with local workspace execution capabilities. The marketplace is a parallel identity and catalog surface that can hand users into the Router.

The code has a useful separation between route handlers and services, but the API module is large at roughly 1832 lines and is still the primary composition point. Database setup uses create_all plus additive repairs instead of a versioned migration history. This is acceptable for a controlled prototype but is a deployment risk for existing customer data.

## Key risks and recommendations

- Add Alembic or an equivalent reviewed migration process before production data changes.
- Provide a real email transport and worker for EmailOutbox; OTP generation alone is not delivery.
- Make provider capability metadata authoritative so the model catalog cannot advertise unsupported direct execution.
- Decide whether streaming is provider-streaming or buffered pseudo-streaming and document the contract.
- Add live Cloud Run smoke tests for authentication, API key, provider, billing, and extension response paths.
- Add a real VS Code host integration test or manual release checklist in CI.
- Define production secrets in Secret Manager and ensure no fixture credentials are used in deployed environments.
- Add alerting, structured operational dashboards, and rollback documentation to the deployment layer.
- Separate public client-facing billing copy from provider cost and internal margin calculation.

## Audit conclusion

The project is beyond a UI-only prototype, but it is not yet proven as a production SaaS control plane. The best next step is a staged hardening pass: migration and email reliability first, then provider and billing live verification, followed by extension host testing and Cloud Run operational controls.

