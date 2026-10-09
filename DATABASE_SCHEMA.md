# Compass Router Database Schema

Source: apps/api/app/models.py, db.py, schemas.py, and services.py.

## Persistence approach

SQLAlchemy models target PostgreSQL with a compass schema and can fall back to SQLite for local operation. Startup runs create_all and additive table or column repairs. No Alembic directory or versioned migration chain was found in the canonical root. This is the highest-priority data deployment risk.

## Domain model

~~~mermaid
erDiagram
  USER ||--o{ ORGANIZATION_MEMBER : joins
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
  ORGANIZATION ||--o{ PROJECT : owns
  PROJECT ||--o{ PROJECT_MEMBER : has
  USER ||--o{ PROJECT_MEMBER : joins
  ORGANIZATION ||--o{ TEAM : owns
  TEAM ||--o{ TEAM_MEMBER : has
  USER ||--o{ TEAM_MEMBER : joins
  PROJECT ||--o{ API_KEY : scopes
  API_KEY ||--o{ API_KEY_MODEL : allows
  MODEL_CATALOG ||--o{ API_KEY_MODEL : referenced
  PROVIDER ||--o{ PROVIDER_CREDENTIAL : has
  PROVIDER ||--o{ BYOK_CREDENTIAL : supports
  PROJECT ||--o{ LLM_REQUEST : records
  LLM_REQUEST ||--o{ PROVIDER_ATTEMPT : attempts
  WALLET_ACCOUNT ||--o{ WALLET_LEDGER : records
  USER ||--o{ EXTENSION_SESSION : owns
  EXTENSION_DEVICE ||--o{ EXTENSION_DEVICE_AUTHORIZATION : starts
~~~

## Tables and purpose

| Table | Purpose | Important relationships |
|---|---|---|
| User | Account identity, password and status | Organization, project, team, keys |
| UserAccess | Role and access flags | User |
| LoginAttempt | Login security and throttling evidence | User or identifier |
| Organization | Customer tenant | Members, projects, teams |
| OrganizationMember | Tenant membership and role | User and organization |
| Project | Billing and request grouping | Organization, members, keys, requests |
| ProjectMember | Project membership | User and project |
| Team | Team grouping and limits | Organization, members |
| TeamMember | Team membership | User and team |
| ApiKey | Hashed client credential | User, project, team |
| ApiKeyModel | Key-to-model allowlist | API key and catalog |
| Provider | Provider configuration | Credentials and health |
| ProviderCredential | Platform provider secret reference | Provider |
| ByokCredential | Customer provider credential | Project, provider |
| ModelCatalog | Model identity, capability, and price | Provider and policies |
| ModelPolicy | Access and routing policy | Catalog, project or team |
| TeamLimit | Token, request, spend, or concurrency limit | Team |
| WalletAccount | Customer balance and reservation state | Organization or user |
| WalletLedger | Credit, reservation, release, and debit entries | Wallet |
| PaymentOrder | Payment gateway order | Wallet and customer |
| PaymentEvent | Payment webhook evidence | Payment order |
| PaymentRefund | Refund records | Payment order |
| BillingInvoice | Invoice and reconciliation record | Customer and requests |
| LlmRequest | Normalized request, usage, cost, and status | Project and provider attempts |
| ProviderAttempt | Individual provider try | LlmRequest and provider |
| Invitation | Member invitation and state | Organization and project |
| EmailOtpChallenge | OTP challenge, expiry, attempts, and purpose | User or invitation |
| EmailOutbox | Queued email message | User or challenge |
| ExtensionDevice | Device authorization request | Extension authorization |
| ExtensionDeviceAuthorization | User approval and code state | Device and user |
| ExtensionSession | Extension session and project association | User and project |
| BatchJob | Batch request lifecycle | User, project, request data |
| OperationalEvent | Operational and service events | Request or component |
| RoutingPolicy | Provider selection and fallback policy | Model or tenant |
| ProviderHealthCheck | Provider latency and health evidence | Provider |
| AuditLog | Administrative and security events | User, tenant, object |

## Data integrity and security observations

- API secrets are not stored in plaintext after creation; hashes are used for lookup.
- Provider and BYOK secret values are encrypted using a Fernet key derived from the application secret.
- Wallet ledger idempotency and locked balance updates reduce double-debit risk.
- Unique constraints exist for important identity and ledger paths.
- The database setup path needs explicit rollback and forward migration behavior before schema changes are deployed to existing customers.
- Retention, deletion, export, and tenant isolation policies should be formalized for request content and provider metadata.

