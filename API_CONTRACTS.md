# API Contracts

Updated: 2026-10-09

## Preserved contracts

- `/v1/*` remains API-key authenticated and tenant/project/team scoped.
- Existing wallet, usage, BYOK, Clerk, and customer administration routes remain in place.
- No VS Code extension contract was changed by M4.

## M4 catalog contracts

`GET /catalog/models` returns Compass registry models with provider, protocol, capability types, modalities, context, pricing metadata, availability, and route-readiness information. Optional filters include provider, capability, minimum context, and availability.

`POST /admin/catalog/sync?provider=litellm` performs provider discovery and persistence. `provider=openrouter` remains optional. Unsupported provider values return a client error.

`GET /admin/catalog/status?provider=litellm` reports the latest sync status, source revision, model count, stale state, and error details without exposing secrets.

## Future boundary

The `decision` capability is reserved for a later verified native provider. No Jev request or response schema is part of the current public API.

## M9 platform administration

- `POST /admin/bootstrap` accepts `{"confirmation":"BOOTSTRAP_PLATFORM_OWNER"}` from the configured verified Clerk user only. It is one-time and idempotent while active; a revoked bootstrap state cannot be automatically restored.
- `GET /admin/access` returns server-derived platform roles and permissions. The frontend must not use a client-provided role as authorization.
- `GET /admin/roles`, `POST /admin/roles`, and `POST /admin/roles/{assignment_id}/revoke` manage subordinate platform roles. Super Admin is not grantable through the subordinate-role endpoint.
- `GET /admin/command-center` returns bounded platform aggregates with optional date/provider/model/organization/project filters. Unrecorded financial categories are returned as unavailable rather than estimated.
- `GET /admin/customers`, `/admin/organizations`, `/admin/api-keys`, and `/admin/requests` are paginated metadata-only explorers. Raw API secrets, BYOK credentials, prompts, and completions are never returned.
- `GET /admin/financial/wallets`, `GET /admin/financial/ledger`, and `POST /admin/financial/wallet-adjustments` use the existing wallet ledger. Adjustments require an idempotency key, currency, reason, and elevated confirmation for large values.
- `GET /admin/settings` and `PATCH /admin/settings` expose only a validated non-secret runtime-safe setting allow-list. Deployment secrets remain in environment variables or Secret Manager.
- Production admin sessions must be Clerk-authenticated; Super Admin operations additionally require verified MFA claims when `PLATFORM_SUPER_ADMIN_REQUIRE_MFA=true`.
## M13 team API key contracts - 2026-10-11

- `GET /api-keys/assigned` returns safe assigned aliases for the authenticated member and never a raw secret.
- `GET /api-keys/{id}/members` and `PUT /api-keys/{id}/members` manage active team-member assignments for an authorized team owner/organization admin.
- `GET /api-keys/{id}/projects` and `PUT /api-keys/{id}/projects` manage active project policies for an authorized team owner/organization admin.
- `PUT` operations are idempotent for duplicate IDs and reject members/projects outside the key's team or organization.
- Existing `/v1/*` bearer-key APIs and legacy `api_keys.member_id`/`project_id` fields remain compatible.

## M14 invitation and pricing contracts - 2026-10-11

- `POST /organization/invitations` uses Clerk delivery when `CLERK_ORGANIZATION_INVITATIONS_ENABLED=true` outside local test mode; response contains `delivery_provider=clerk` and a Clerk invitation ID, never an application acceptance token.
- Local test mode retains the legacy `accept_token` response for deterministic tests only.
- `POST /admin/catalog/pricing-policies` accepts versioned FX buffer, platform fee, and FX source fields; pricing policy responses expose the active formula and FX metadata.
