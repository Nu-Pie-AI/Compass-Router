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

## M20.2 Clerk bootstrap CORS - 2026-10-12

Root causes found in the live API:

1. The local environment did not explicitly include `http://127.0.0.1:23000` in `COMPASS_WEB_ORIGIN`.
2. CORS was registered inside the request-context middleware. An unhandled bootstrap database exception could therefore return without CORS headers, causing Chrome to report a misleading CORS failure.
3. The configured Neon schema is missing `organizations.clerk_organization_id`, which is required by the current bootstrap path and belongs to migration `i3j4k5l6m7n8`.

Repair:

- Added the approved `127.0.0.1:23000` origin to local/example configuration.
- Registered `CORSMiddleware` outside the request-context middleware so preflight, auth failures, and error responses receive consistent CORS headers.
- Added deterministic CORS regression tests for approved origins, rejected origins, authorization/content-type headers, and authentication failure responses.
- Restarted the actual FastAPI process on port 28000 from the production copy.

Live evidence:

- Approved `localhost:23000` preflight: HTTP 200 with allow-origin and credentials headers.
- Approved `127.0.0.1:23000` preflight: HTTP 200 with allow-origin and credentials headers.
- Unapproved origin preflight: HTTP 400 with no allow-origin header.
- Bootstrap with invalid token: HTTP 401 with CORS headers.
- Real authenticated bootstrap and `/portal` role redirect remain blocked until the missing Neon migration is reviewed and authorized, and the owner completes Clerk verification.
