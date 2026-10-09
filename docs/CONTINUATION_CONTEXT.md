# Compass Router Continuation Context

Last updated: 2026-10-08

Read this file first when continuing Compass Router development in a new chat.

## Recommended continuation prompt

> Read `docs/CONTINUATION_CONTEXT.md` first. Continue development from the current Compass Router root checkout. Preserve existing changes, run relevant tests before claiming completion, and keep `LOCAL_TEST_MODE=false` for application defaults.

## Canonical repository

- Root checkout: `C:\Users\tohee\Desktop\Compass-Litellm-Router`
- `CompassUnified/` is an untracked nested copy/snapshot. The repository root is the canonical checkout for development and deployment.
- The worktree contains user and generated changes. Do not reset, clean, delete, or overwrite unrelated changes.

## Product structure

- `apps/api/`: FastAPI API, router, authentication, teams, API keys, billing, providers, and admin endpoints.
- `apps/web/`: web console.
- `compass-code/`: VS Code extension.
- The product name shown in the extension is **Compass Router**.
- Marketplace identity is `name: compass-router` and `publisher: nu-pie`; internal `compassCode.*` command/config IDs remain unchanged for compatibility.

## VS Code extension status

Important source files:

- `compass-code/src/extension.ts`
- `compass-code/src/client.ts`
- `compass-code/src/protocol.ts`
- `compass-code/src/ui/index.tsx`
- `compass-code/src/ui/styles.css`
- `compass-code/test-ui/webview.spec.ts`

The current extension includes:

- Kilo-inspired onboarding with Review First and High Autonomy choices.
- One VS Code toolbar navigation surface. The duplicate in-panel Chat/History/Settings/Account strip was removed.
- Chat, history, settings, account, task progress, permissions, file actions, Markdown/code rendering, retry, and streaming UI.
- Settings trimmed to Models, Providers, Agent Behaviour, and About Compass Router. Dummy categories and disabled placeholder rows were removed.
- A visible Back to chat action in Settings.
- Account states for signed-in usage, Open dashboard, Switch account, Log out, and signed-out Log in.
- Login and logout through VS Code SecretStorage-backed flow.

### Provider and account boundary

- The web console has browser sessions through `/auth/login` and `/auth/logout`.
- The extension currently uses a Compass workspace API key for `/v1` model traffic. It is stored in VS Code SecretStorage, not workspace files.
- This API-key connection is intentionally presented as `Connect workspace` and `Sign out on this device`; local sign-out removes the key from this device but does not revoke the server-side key.
- Server-side key creation and revocation belong in the web console's API Keys area.
- Settings > Providers now separates the Compass Router gateway from the supported direct adapters: OpenAI-compatible and Ollama. Direct adapters are not Compass-billed or Compass-routed.
- Do not add a fake email/password login to the extension. A future browser/device authorization flow can add true account SSO, but it must exchange a short-lived handoff for the gateway credential and preserve server-side revocation semantics.

Current packaged extension:

`C:\Users\tohee\Desktop\Compass-Litellm-Router\compass-code\compass-router-0.3.6.vsix`

Install locally from the repository root:

```powershell
code --install-extension .\compass-code\compass-router-0.3.6.vsix
```

Then run `Developer: Reload Window` in VS Code.

## Live provider mode

Application defaults must remain live/proxy mode:

```dotenv
PROVIDER_EXECUTION_MODE=proxy
LOCAL_TEST_MODE=false
```

Relevant files:

- `.env.example`
- `apps/api/app/config.py`
- `docker-compose.yml`

Tests may explicitly enable local test mode for deterministic fake responses, but production/default configuration must not be changed back to local test mode.

Current proxy aliases include:

- `openai-gpt-4o-mini-smoke`
- `gemini-flash-real`
- `ollama-cloud-gpt-oss-20b-real`

Do not map live routes back to `gpt-5` unless LiteLLM exposes that model group.

## Last verified GCP deployment

- GCP project: `compass-510017`
- Region: `us-central1`
- Cloud Run services: `compass-router-api`, `compass-litellm`, `compass-router-web`
- API revision: `compass-router-api-00033-5kg`
- API URL: `https://compass-router-api-c4psf2dvua-uc.a.run.app`
- LiteLLM URL: `https://compass-litellm-c4psf2dvua-uc.a.run.app`

Last live verification established:

- `/health/ready` returned ready with PostgreSQL, Redis, and LiteLLM healthy.
- `/admin/local-test` reported `LIVE PROVIDER MODE`.
- A real authenticated streamed chat request returned HTTP 200 SSE with usage and billing metadata.
- The response reported `local_test_mode:false`.
- The temporary smoke-test key was revoked.

Do not store passwords, API keys, JWTs, PATs, or other secrets in this document.

## Verification commands

From the repository root:

```powershell
python -m pytest -q
```

The last recorded result was `48 passed`.

From `compass-code/` use `npm.cmd` on Windows:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:ui
npm.cmd run package
```

Last recorded extension results:

- TypeScript check passed.
- Unit tests: 10 passed.
- UI tests: 11 passed.
- VSIX packaging passed.

## Deployment commands

Build and submit the router images:

```powershell
gcloud builds submit --project compass-510017 --config cloudbuild-router-images.yaml .
```

Update the API service when required:

```powershell
gcloud run services update compass-router-api `
  --project compass-510017 `
  --region us-central1 `
  --image us-central1-docker.pkg.dev/compass-510017/compass/router-api:latest
```

After deployment, verify readiness and run a real authenticated streamed request. A successful health check alone is not sufficient to prove the extension response path works.

## Known testing boundaries

- Playwright UI tests use a mocked VS Code bridge.
- The live HTTP/provider path must be smoke-tested separately.
- After major extension-host changes, test the installed VSIX in a real VS Code window as well as running automated UI tests.
- Several old `.vsix` artifacts may be untracked. Use the current highest version, currently `0.3.6`.
- The readiness audit identified billing and Secret Manager production blockers that are separate from the verified live provider chat path. Review those before production launch.

## Working rules for the next chat

1. Inspect the current worktree before editing; preserve existing user changes.
2. Read this file and the relevant source before assuming a feature is missing.
3. Trace extension response issues through UI, host, client, HTTP/stream, transcript, and postback layers.
4. Keep application defaults in live mode and use explicit test flags only inside tests.
5. Run focused tests during development and the relevant full checks before claiming completion.
6. For deployment work, verify the GCP project, billing, Artifact Registry image, Cloud Run revision, readiness, and a real authenticated response.

## Organized customer workflow implemented on 2026-10-08

The current branch keeps the saved baseline and adds the first customer-access slice additively:

- `projects` and `project_members` tables. Existing organizations receive a default `Others` project and existing teams/keys are attached to it without destructive migration.
- `POST /auth/signup/request-otp` and `POST /auth/signup/verify-otp` provide self-service OTP signup while the existing password signup/login endpoints remain supported.
- `POST /auth/login/request-otp` and `POST /auth/login/verify-otp` provide OTP login for verified accounts.
- `/projects`, `/organization/members`, `/organization/invitations`, and `/invitations/{token}` provide customer project/member/invitation administration. Invitation acceptance verifies the email by OTP and revokes access by incrementing the user session version.
- API keys now carry nullable `project_id`, `purpose`, and `scopes_json` fields. Existing unscoped keys remain valid. New usage records inherit the key project.
- `/v1/account` exposes the key project. The VS Code extension displays the active project, warns when it is the default `Others` project, and sends `X-Compass-Project-Id`; the API validates that header against a scoped key.
- Browser/device authorization is now live in the codebase: `/auth/extension/device/start`, `/auth/extension/device/approve`, and `/auth/extension/device/poll` create a project/team-scoped device session. VS Code opens `/extension/authorize`, polls the session, stores the device token in SecretStorage, and sends it through the same OpenAI-compatible `/v1` contract. Admin/member session revocation also revokes device sessions.
- The web console now includes `/signup`, `/login`, `/extension/authorize`, and a Projects, Teams, and Members manager under `/workspaces`.
- Local tests expose `debug_otp` only when `LOCAL_TEST_MODE=true`; production responses never return the OTP. Email delivery is represented by the configured delivery mode and still needs a production email provider/outbox worker before launch.

Focused verification after this slice:

- API OTP/invitation/device tests: 3 passed.
- Full API suite: 49 passed.
- Extension TypeScript check: passed.
- Extension unit tests: 10 passed.
- Extension Playwright UI tests: 11 passed.

Next planned slice: replace the extension's manual API-key connection with a browser/device authorization flow backed by `extension_devices` and `extension_sessions`, then add customer-console screens for project/member/key management. Do not remove the current API-key flow until the device flow has a live end-to-end smoke test.

## Production milestone handoff - M3 complete (2026-10-09)

The active production implementation is the isolated repository at `C:/Users/tohee/Desktop/Compass-Router-Production`. M0, M1, M2, and M3 are complete for isolated verification. M3 added centralized organization/project/team authorization, scoped organization removal, API-key project and model-policy enforcement, team-owner key administration, BYOK ownership checks, estimated team spend enforcement, and production Redis fail-closed behavior.

Verification: `python -m pytest -q tests/test_api.py` passed with 57 tests; `python -m compileall -q apps/api/app` passed; `git diff --check` passed. Do not start M4 until the user approves the next milestone. Remaining M3 release blockers are PostgreSQL/Redis staging verification and live Clerk credentials.

