# M20 Web Repair Report

Date: 2026-10-12
Branch: `staging/safe-deployment-2026-10-09`

## Root causes repaired

1. The standalone Next build did not contain `.next/static`, so the production server returned HTML while CSS and branding assets returned 404. The build now copies static assets and `public` into the standalone bundle.
2. The development server had produced `socket hang up` errors while handling `/portal`. Verification now uses the production standalone server after a successful build.
3. The Clerk login page could remain visually empty when Clerk failed to mount. A client-side timeout now presents a visible recovery message and reload action instead of an indefinite blank state.

## Files changed

- `apps/web/package.json`: build copies standalone assets after `next build`.
- `apps/web/scripts/copy-standalone-assets.mjs`: deterministic standalone asset copy.
- `apps/web/app/login/page.tsx`: delegates to the client login wrapper.
- `apps/web/app/login/ClerkLoginForm.tsx`: Clerk loading timeout and recovery state.
- `WEB_ROUTE_AUDIT.md`
- `WEB_CONTROL_COVERAGE.md`
- `WEB_E2E_TEST_REPORT.md`

## Verification

- CSS asset response: `200 OK` from the running standalone server.
- Clerk scripts and sign-in UI: loaded/rendered in clean Playwright browser.
- Protected route redirects: verified across the route inventory.
- Backend: `127 passed`, one existing deprecation warning.
- Web lint, typecheck, build, and diff check: passed.

## Release status

The local unauthenticated web shell is repaired and browser-verified. Full production readiness is not claimed because live Clerk role flows, isolated staging data, provider inference, payment, SMTP, and Cloud Run verification remain external gates.

## Real Clerk initialization follow-up - 2026-10-12

Root cause: `/login` was statically prerendered with a one-year cache policy. After a standalone rebuild, an existing Chrome cache could retain the old HTML/chunk set. The server rendered the Compass shell while the stale client bundle prevented the Clerk SignIn component from mounting. Clerk itself was reachable and healthy.

Repair:

- `/login` and `/signup` are now dynamic with `revalidate = 0`, producing `private, no-cache, no-store` responses.
- `ClerkLoading` and `ClerkLoaded` explicitly gate the SignIn component.
- The existing timeout fallback remains available without exposing raw errors or secrets.
- `CLERK_SECRET_KEY` remains server-only; only the publishable key is present in the browser bundle.

Evidence:

- Running process: production standalone server from the production copy on `127.0.0.1:23000`.
- Clerk frontend script, UI modules, client, and environment requests: HTTP 200.
- Fresh Playwright browser: email input 1, password input 1, SignIn heading 1.
- Console errors: none. Failed requests: none. Redirect loop: none.
- Interactive login: not completed; requires the user's Clerk credentials/verification code.
