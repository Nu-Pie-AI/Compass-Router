# M25 UI Audit

Date: 2026-10-15
Branch: `staging/safe-deployment-2026-10-09`

## Audited surfaces

Audited the shared console shell and source for dashboard, models, chat, playground, decisions, API keys, BYOK, activity, billing, teams, workspaces, profile, company admin, Super Admin, provider management, pricing, login/signup, onboarding, extension authorization, and the VS Code extension UI.

The authenticated Chrome session directly rendered Dashboard, Super Admin Providers, Super Admin Models & Pricing, Credits & Reconciliation, Payments & Refunds, Customers, Organizations, and Teams. Source inspection covered the remaining routes and permission-aware navigation.

## Findings

- Existing navigation and responsive structure were sound but theme support was inconsistent: the shared console had a light-only visual contract while the product also exposes dark marketing/extension surfaces.
- Dark mode could leave utility-class panels white against a dark shell, creating a contrast failure.
- Theme preference had no visible, keyboard-accessible control.

## Implemented scope

Added a persistent light/dark theme control to the shared console shell and Super Admin shell, with semantic dark surface/text/border overrides for existing utility classes. Auth, routing, financial logic, provider semantics, and business APIs were not changed.
