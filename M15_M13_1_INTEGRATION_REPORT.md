# M15 + M13.1 Integration Report

Date: 2026-10-11
Branch: `staging/safe-deployment-2026-10-09`

## Completed

- Added Clerk-authenticated member inference at `POST /member/v1/chat/completions`.
- Members submit only `X-Compass-Key-Id` and optional `X-Compass-Project-Id`; raw Compass keys are never returned or reconstructed.
- Server resolves active member assignments, key status/expiry, team status, organization scope, project scope, project membership, and model policy before reusing the existing provider gateway.
- Request records attribute member user/member IDs while preserving the selected key, project, Credits reservation, settlement, and BYOK behavior.
- Streaming uses the same member context through the existing SSE settlement path.
- Added Cloud Scheduler OIDC preparation template and retained constant-time application-secret authentication as a local/alternative path.
- Added Frankfurter User-Agent handling after diagnostics showed bare requests could return 403.

## Validation

- Full backend pytest: passed, 125 tests, with one existing Pydantic deprecation warning.
- Web lint, typecheck, and production build: passed.
- VS Code extension check, tests, and build: passed; 10 tests.
- Cloud Run template validation: passed.
- Neon read-only verifier: blocked because protected customer/financial tables are populated; no migration was run.
- Offline Alembic SQL: single head `j4k5l6m7n8o9`; M15 operations are additive and contain no M15 table/data deletion.
- Frankfurter read-only v2/v1 checks with explicit User-Agent: passed.
- Fawaz read-only check: passed.
- Member assignment/inference authorization regression: passed.

## External blockers

- Staging database identity and emptiness must be reviewed by the owner before applying the migration.
- Cloud Scheduler, Secret Manager, Cloud Run IAM, Clerk live session/invitation, and real provider inference require staging credentials and approval.
- Previously exposed Neon, Clerk, and Upstash credentials must be rotated.
