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
