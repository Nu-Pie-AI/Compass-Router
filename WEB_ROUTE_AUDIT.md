# Compass Router Web Route Audit

Date: 2026-10-12
Branch: `staging/safe-deployment-2026-10-09`

## Running application

- Frontend: `apps/web`, production standalone server on `127.0.0.1:23000`.
- API: `apps/api`, Uvicorn on `127.0.0.1:28000`.
- The active frontend process was verified from `C:\Users\tohee\Desktop\Compass-Router-Production`; no original-repository process is serving port 23000.
- The web build uses Clerk and the configured local API URL. No server secret is exposed by the web environment file.

## Route inventory

| Route | Type | Unauthenticated browser result | Authenticated verification |
|---|---|---|---|
| `/` | Public | PASS; renders landing navigation | N/A |
| `/login` | Clerk auth | PASS; Clerk SignIn renders in clean Playwright browser | BLOCKED; requires interactive Clerk identity |
| `/signup` | Clerk auth | PASS; Clerk SignUp renders in clean Playwright browser | BLOCKED; requires email/provider verification |
| `/portal` | Role resolver | PASS; redirects to `/login?callbackUrl=/portal` | BLOCKED; requires Clerk session and API bootstrap |
| `/dashboard` | Member | PASS; protected redirect | BLOCKED; requires member session |
| `/super-admin` | Platform | PASS; protected redirect, no 404 | BLOCKED; requires configured owner identity and MFA |
| `/admin` | Company admin | PASS; protected redirect | BLOCKED; requires company-admin session |
| `/admin-login` | Compatibility route | PASS; protected by Clerk; no legacy form in default mode | BLOCKED; legacy fallback is disabled |
| `/activity` | Workspace | PASS; protected redirect | BLOCKED; requires session |
| `/api-keys` | Workspace | PASS; protected redirect | BLOCKED; requires session |
| `/byok` | Workspace | PASS; protected redirect | BLOCKED; requires session and team |
| `/chat` | Workspace | PASS; protected redirect | BLOCKED; requires member/session and provider |
| `/extension` | Public extension information | PASS; renders public page | N/A |
| `/extension/authorize` | Device authorization | PASS; protected redirect | BLOCKED; requires live extension device flow |
| `/models` | Workspace catalog | PASS; protected redirect | BLOCKED; requires provider/catalog state |
| `/playground` | Workspace inference | PASS; protected redirect | BLOCKED; requires real provider and Credits |
| `/pricing` | Public pricing | PASS; renders public page | N/A |
| `/profile` | Account | PASS; protected redirect | BLOCKED; requires session |
| `/teams` | Company administration | PASS; protected redirect | BLOCKED; requires company-admin session |
| `/usage` | Usage | PASS; protected redirect | BLOCKED; requires session and records |
| `/wallet` | Credits | PASS; protected redirect | BLOCKED; requires session and financial records |
| `/workspaces` | Company/workspace | PASS; protected redirect | BLOCKED; requires session |

## Automated browser evidence

- Every listed route was opened against the live server with Playwright.
- Public routes rendered without page errors.
- Protected routes redirected to Clerk login without page or console errors.
- `/super-admin` no longer returns a 404.
- A clean Clerk browser session loaded Clerk scripts and rendered the sign-in form.

## Remaining live gates

Interactive Clerk login, MFA, organization selection, role bootstrap, logout, provider inference, Credits settlement, invitations, and tenant-isolation browser tests require real staging credentials and an isolated database/provider environment. They are not represented as passed by this audit.
