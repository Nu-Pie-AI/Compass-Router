# Compass Router API Inventory

Source: apps/api/app/main.py and related schemas/services. Exact authentication and scope checks should be confirmed with generated OpenAPI in a running environment.

## Health and authentication

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | /health | Basic health | Public |
| GET | /health/live | Liveness | Public |
| GET | /health/ready | Readiness | Public |
| POST | /auth/signup | Create account | Public, configuration-gated |
| POST | /auth/signup/request-otp | Start signup OTP | Public |
| POST | /auth/signup/verify-otp | Verify signup OTP | Public |
| POST | /auth/login | Login | Public |
| POST | /auth/login/request-otp | Start login OTP | Public |
| POST | /auth/login/verify-otp | Verify login OTP | Public |
| POST | /auth/logout | Invalidate session | Session |
| POST | /auth/extension/device/start | Start extension device flow | Public |
| GET | /auth/extension/device/poll | Poll extension device flow | Public or device-bound |
| POST | /auth/extension/device/approve | Approve extension device | Session |
| POST | /auth/marketplace | Exchange marketplace handoff | Signed handoff |

## Account, organizations, projects, teams, and keys

| Method | Path | Purpose |
|---|---|---|
| GET | /me | Current user |
| GET | /dashboard | Dashboard summary |
| GET/POST | /teams | List or create teams |
| GET/POST | /workspaces | List or create workspaces |
| GET/POST | /projects | List or create projects |
| PATCH | /projects/{project_id} | Update project |
| GET/POST/DELETE | /organizations/{organization_id}/members | Manage organization members |
| POST | /organizations/{organization_id}/invitations | Create invitation |
| GET | /organizations/{organization_id}/invitations | List invitations |
| POST | /organizations/{organization_id}/invitations/request-otp | Verify invitation email |
| POST | /organizations/{organization_id}/invitations/accept | Accept invitation |
| GET/POST/DELETE | /workspaces/{workspace_id}/members | Manage workspace members |
| GET/POST | /teams/{team_id}/members | Manage team membership |
| GET/PATCH | /teams/{team_id}/limits | Team limits |
| GET | /admin/teams | Admin team view |
| POST | /api-keys | Create API key |
| GET | /api-keys | List API keys |
| POST | /api-keys/{key_id}/revoke | Revoke API key |
| PUT | /api-keys/{key_id}/models | Set key model access |

## Wallet and billing

| Method | Path | Purpose |
|---|---|---|
| POST | /wallet/topup | Create top-up request |
| GET | /wallet | Wallet and balance |
| GET | /wallet/ledger | Ledger entries |
| POST | /billing/orders | Create payment order |
| POST | /billing/orders/{order_id}/verify | Verify payment |
| POST | /billing/orders/{order_id}/complete | Complete order |
| POST | /billing/webhook | Receive payment webhook |
| POST | /billing/refunds | Create refund |
| GET | /billing/refunds | List refunds |
| GET | /billing/invoices | List invoices |
| GET | /billing/reconciliation | Reconcile billing data |

## Models, providers, and policies

| Method | Path | Purpose |
|---|---|---|
| GET | /models | Model catalog |
| GET | /models/{model_id} | Model details |
| GET | /policies | Model policies |
| GET | /admin/routing | Routing controls |
| GET/POST/DELETE | /byok | Manage encrypted BYOK credentials |
| GET | /admin/providers | Provider administration |
| GET | /admin/models | Model administration |
| POST | /admin/credentials/sync | Sync provider credentials |
| GET | /admin/catalog | Catalog administration |

## OpenAI-compatible and usage endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /v1/models | OpenAI-compatible model list |
| GET | /v1/account | Account metadata |
| GET | /v1/router/status | Router status |
| POST | /v1/chat/completions | Chat completion |
| POST | /v1/responses | Responses API |
| POST | /v1/embeddings | Embeddings |
| POST | /v1/images/generations | Image generation |
| POST | /v1/audio/speech | Text to speech |
| POST | /v1/audio/transcriptions | Transcription |
| POST | /v1/batches | Create batch |
| GET | /v1/batches/{batch_id} | Batch status |
| POST | /v1/batches/{batch_id}/cancel | Cancel batch |
| GET | /usage/requests | Request usage records |

## Operational and administration endpoints

The API also exposes administrative routes for users, platform settings, readiness, audit events, operations, provider health, local catalog work, and local test support. These routes must be protected by the production admin dependency and must not be exposed through a public ingress without an access policy.

## Contract risks

- The public catalog should match actual provider capabilities.
- Error response shapes should be contract-tested across web and extension clients.
- Streaming should be documented as buffered or changed to upstream incremental streaming.
- Billing metadata should distinguish provider cost, platform fee, taxes, credits, and customer debit.
- OpenAPI should be generated and checked in CI to catch route or schema drift.

