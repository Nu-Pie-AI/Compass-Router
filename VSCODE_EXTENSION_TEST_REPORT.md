# Compass Router VS Code Extension Test Report

Date: 2026-10-11
Version: `0.1.0`

## Automated results

| Check | Result |
|---|---|
| `npm.cmd run check` | PASS |
| `npm.cmd run test` | PASS; 10 tests |
| `npm.cmd run build` | PASS |
| `npm.cmd run package` | PASS; VSIX generated |
| `npm.cmd run test:ui` | PASS; 11 Playwright tests |
| VSIX contents and secret scan | PASS; zero secret-pattern hits |
| Local VS Code installation | PASS; `nu-pie.compass-router@0.1.0` installed |
| Backend member inference regression | Existing local coverage remains green; live provider path not claimed |

## Covered behavior

- Welcome and connection flows.
- Compass Router branding and settings categories.
- Chat task controls, streaming state, history, transcript actions, and permissions.
- Account usage, Credits display, project scope, sign-out, and reconnect actions.
- Sanitized markdown/file actions and responsive webview layout.
- Secure local storage and browser/device authorization code paths by source review.

## Not verified

- VS Code Extension Development Host activation with a live Clerk account.
- Real company selection, assigned key alias retrieval, project authorization, model selection, and provider inference.
- Live streaming, insufficient Credits, revoked assignment, reauthentication, and server-side session revocation.
- Marketplace publisher validation, privacy/terms links, and public upload.
