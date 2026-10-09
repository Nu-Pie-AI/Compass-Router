# Super Admin Role Matrix

| Role | Read | Write | Financial adjustment | Role management |
|---|---|---|---|---|
| `PLATFORM_SUPER_ADMIN` | All platform domains | All platform domains | Yes, with confirmation rules | Grant/revoke subordinate roles |
| `PLATFORM_ADMIN` | Customers, AI infrastructure, operations, governance | Customer access, providers, models, routing, safe settings | Compatibility access to existing admin top-up route; M9 large adjustments still require second approval | No |
| `FINANCE_ADMIN` | Finance and operations | Wallet adjustments with idempotency and approval rules | Yes | No |
| `SUPPORT_ADMIN` | Customer and operational diagnostics | Customer suspension/reactivation and session revocation | No | No |
| `READ_ONLY_AUDITOR` | Customer metadata, providers, models, routing, finance, operations, security, settings | None | No | No |

The matrix is enforced by FastAPI permission checks. Legacy `admin` and
`super_admin` values are mapped for M0-M8 compatibility; explicit assignments
remain the source of new platform role state.
