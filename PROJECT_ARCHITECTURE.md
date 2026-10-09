# Compass Router Architecture

## System context

~~~mermaid
flowchart LR
  User[Client user] --> Web[Router web console]
  User --> Ext[VS Code extension]
  User --> Market[Marketplace]
  Web --> API[Compass FastAPI API]
  Ext --> API
  Market --> SSO[Signed marketplace handoff]
  SSO --> API
  API --> DB[(PostgreSQL or SQLite)]
  API --> Redis[(Redis)]
  API --> Lite[LiteLLM proxy]
  API --> Direct[Direct provider adapters]
  API --> Pay[Payment provider]
  API --> Mail[Email outbox and transport]
~~~

## Runtime components

| Component | Responsibility | Main boundary |
|---|---|---|
| Router API | Auth, access, project and team management, keys, routing, wallet, usage, billing, extension auth | apps/api/app/main.py |
| API services | Provider selection, model discovery, credentials, limits, wallet, requests, adapters | apps/api/app/services.py |
| Database layer | SQLAlchemy engine, schema initialization, additive repairs | apps/api/app/db.py |
| Router web | User and admin console pages | apps/web |
| Marketplace | Catalog and identity surface, marketplace-to-Router handoff | marketplace |
| VS Code extension | Agent loop, local tools, permissions, transcript, API client | compass-code/src |
| LiteLLM | Controlled proxy route for configured provider models | services/litellm |
| Infrastructure | Local compose and build definitions | infra/docker and cloudbuild files |

## Request lifecycle

~~~mermaid
sequenceDiagram
  participant C as Web or extension
  participant A as FastAPI
  participant S as Auth and access
  participant R as Router services
  participant W as Wallet
  participant P as Provider
  participant D as Database
  C->>A: OpenAI-compatible request
  A->>S: Verify session or API key
  S-->>A: User, project, team context
  A->>R: Select model and route candidates
  R->>W: Reserve estimated balance
  R->>P: Attempt provider request
  P-->>R: Response or provider failure
  R->>D: Record provider attempts and request usage
  R->>W: Release or settle reservation
  R-->>A: Normalized response and Compass metadata
  A-->>C: Response or synthesized stream
~~~

## Identity and access

Router identity is JWT-based. Passwords are bcrypt-hashed. JWTs include a session version so logout or session invalidation can make prior tokens unusable. API keys are generated once, stored as hashes, and can be scoped to projects with expiry and revocation. Marketplace handoff uses a short-lived HMAC-signed token.

The extension has a device authorization path with start, poll, and approve endpoints. The extension also supports stored credentials and a project tag header. Live device flow and host behavior were not verified in this read-only audit.

## Provider routing

The API can use a controlled LiteLLM route or direct adapters depending on configuration. Routing considers model catalog data, model policy, provider availability, team and key limits, provider health, retries, fallback, and wallet reservation. The catalog lists more provider families than the direct adapter code visibly implements. Treat catalog availability as a product claim that requires runtime verification.

## Billing and cost flow

The service estimates token usage and cost before execution, reserves wallet balance, calls the provider, calculates actual provider and Compass cost after usage is known, records the request, and settles the wallet. Ledger idempotency and row locking are present. Model pricing is stored in paise per one thousand input and output tokens.

BYOK credentials are encrypted at rest through a key derived from the application secret. BYOK removes provider credential cost from Compass, but it does not remove platform, routing, request accounting, or any configured service fee. The exact customer-facing fee policy must be kept in one pricing service and shown in the UI.

## Deployment topology

Local Compose defines PostgreSQL, Redis, LiteLLM, API, and web services. Cloud Build definitions build container images. The repository does not contain a complete managed infrastructure definition, alert policy set, or verified deployment pipeline. Cloud Run deployment and DNS are therefore operationally unverified from source alone.

## Boundary risks

- The API is a broad composition module and should eventually be split by domain routers.
- create_all and additive ALTER statements are not a safe substitute for reviewed migrations.
- EmailOutbox has enqueueing behavior but no confirmed consumer.
- Buffered streaming can increase latency and memory use.
- Provider catalog and adapter support can drift.
- Web and extension clients have separate auth and error-handling surfaces that need contract tests.

