# Compass Router Web E2E Test Report

Date: 2026-10-12

## Executed

- Production standalone web server on port 23000.
- FastAPI server on port 28000.
- Playwright route sweep covering all discovered Next routes.
- Console and page-error collection during the route sweep.
- Clean-browser Clerk resource and sign-in rendering check.
- API health check at `/health`.

## Results

- Public landing, extension, and pricing pages: PASS.
- Login and signup Clerk UI in a clean browser: PASS.
- Protected route redirects: PASS for dashboard, portal, super-admin, admin, activity, keys, BYOK, chat, authorization, models, playground, profile, teams, usage, wallet, and workspaces.
- Super Admin route: PASS for existence and protection; no 404.
- Browser console/page errors during unauthenticated route sweep: none observed.
- API health: PASS, `200 OK`.
- Backend pytest: PASS, `127 passed`, one existing Pydantic deprecation warning.
- Web lint: PASS.
- Web typecheck: PASS.
- Web production build: PASS.
- `git diff --check`: PASS.

## Not claimed as passed

Live Clerk sign-in, email verification, MFA, role routing, logout/revocation, organization invitations, authenticated company/member controls, provider inference, genuine streaming, Credits reservation/settlement, Razorpay sandbox, PostgreSQL/Redis concurrency, and cross-tenant browser tests require external staging access. These remain blockers, not skipped successes.
