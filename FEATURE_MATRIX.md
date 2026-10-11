# Compass Router Feature Matrix

Legend: Implemented, Partial, Mocked, Unverified, Risk.

| Capability | Surface | Evidence | Status | Notes |
|---|---|---|---|---|
| Password signup | Router API and web | main.py auth routes, security.py | Implemented | Public signup is configuration-gated |
| Password login | Router API and web | main.py login routes | Implemented | Session version participates in JWT validation |
| Email OTP | Router API | OTP challenge and outbox services | Partial | Delivery worker/provider not confirmed |
| Logout | Router API | auth logout route | Implemented | Relies on session invalidation semantics |
| Marketplace SSO | Marketplace and Router | compass-sso.ts and auth marketplace route | Implemented | Handoff token is short-lived |
| Organization access | Router API and web | organization and member routes | Implemented | Invitation acceptance path exists |
| Projects | Router API and web | project routes and models | Implemented | Project tags are available to request clients |
| Teams | Router API and web | team routes and models | Implemented | Member and limit management exists |
| API key creation | Router API and web | key routes and security.py | Implemented | Secret is one-time display and hash-backed |
| API key revocation and rotation | Router API and web | revoke and atomic rotate routes | Implemented | Replacement secret is returned only at rotation time; old secret is revoked |
| Project model allowlist | Router API | ApiKeyModel and policy routes | Implemented | Runtime coverage needs provider verification |
| Provider catalog | Router API and web | provider-neutral sync, catalog routes, model governance | Partial | Local registry and route-readiness gates implemented; live provider discovery remains unverified |
| Provider credentials | Router API and admin | ProviderCredential services, BYOK, Secret Manager templates | Partial | Server-side credential paths exist; Secret Manager and live provider paths unverified |
| BYOK credentials | Router API and web | BYOK routes and encryption helpers | Implemented | Customer fee policy must remain separate from provider cost |
| Model discovery | Router API | discovery services and catalog routes | Partial | Depends on configured provider connectivity |
| Chat completions | Router API and extension | v1 chat route and complete_chat | Implemented | Provider execution unverified in deployment |
| Responses API | Router API | v1 responses route | Implemented | Contract coverage should be expanded |
| Embeddings | Router API | v1 embeddings route | Implemented | Live provider path unverified |
| Images and audio | Router API | v1 image and audio routes | Partial | Provider capability and live path need verification |
| Batch jobs | Router API | batch models and routes | Partial | Durable worker execution not established |
| Streaming | Router API and extension | incremental chat/Responses SSE services | Partial | Production path forwards upstream events; live timing, cancellation, and provider failure behavior unverified |
| Wallet | Router API and web | wallet, ledger, reserve, settle services | Implemented | Payment gateway completion remains unverified |
| Payments | Router API and web | order, verify, webhook, refund routes | Partial | Requires production credentials and webhook testing |
| Invoices | Router API and web | invoice and reconciliation routes | Partial | Accounting workflow needs live validation |
| Usage and activity | Router API and web | usage and request rows, provider analytics period/finality presentation | Implemented | Accuracy depends on provider response metadata; live provider verification remains open |
| Admin controls | Router API and web | admin routes and pages | Partial | Production role and operational audit need verification |
| Extension device auth | API and extension | device start, poll, approve, token refresh, server-side session revoke, SecretStorage logout | Partial | Live browser/device loop and revocation unverified |
| Extension chat UI | VS Code extension | src/ui and styles | Implemented | Current UI has a custom agent surface |
| Extension agent loop | VS Code extension | agent.ts | Implemented | Bounded loop and local tools present |
| Extension workspace tools | VS Code extension | tools, terminal, checkpoints, diffs | Implemented | Permission and host behavior need release testing |
| Extension MCP or subagents | VS Code extension | source inspection | Not found | Not part of current implementation |
| Durable server conversation | API and extension | source inspection | Not found | Transcript persistence is mainly client-side |
| Marketplace catalog | Marketplace | Next.js pages and API routes | Implemented | Separate deployment and database |
| Marketplace email auth | Marketplace | NextAuth and email/TOTP code | Partial | External email setup unverified |
| Search indexing | Web and marketplace | page components and routes | Partial | No production indexing evidence |
| Cloud Run deployment | Infrastructure | Docker and Cloud Build files | Partial | Complete deploy, DNS, secrets, and alerts unverified |
| Automated tests | CI | GitHub workflow | Partial | API, web, and Docker checked; marketplace and host extension gaps |

