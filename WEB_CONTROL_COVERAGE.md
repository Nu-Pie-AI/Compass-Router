# Compass Router Web Control Coverage

Date: 2026-10-12

The web source contains 192 link/button/click/API control references across the discovered pages and shared console components. Coverage is classified by evidence level instead of treating visibility as a successful test.

| Control area | Implemented source behavior | Local evidence | Live blocker |
|---|---|---|---|
| Public navigation | Next links to landing, pricing, models, playground, extension, login, signup | Browser route audit PASS | None for public pages |
| Clerk login/signup | Clerk `SignIn`/`SignUp`, ClerkProvider, fallback redirect to `/portal` | Clean browser PASS | Real identity, email verification |
| Portal resolution | Clerk token bootstrap followed by server-derived `/auth/portal` | API/security tests PASS | Real Clerk role claims |
| Logout | Clerk sign-out plus server session cleanup and local session cleanup | Source and local regression coverage | Live session revocation |
| Company projects/members | Organization/project/invitation API mutations in `OrganizationAccessManager` | Backend authorization tests PASS | Clerk Organizations and SMTP |
| Teams | Team/member mutations in `TeamsManager` | Backend regression PASS | Real tenant session/database |
| API keys | Create, model/project/member assignment, revoke, expiry controls | Backend regression PASS | Authenticated browser and key exposure review |
| BYOK | Encrypted provider key create/revoke and summary display | Backend regression PASS | Real provider verification |
| Models/catalog | Discovery, filtering, activation and governance controls | Catalog tests/build PASS | Live provider catalog |
| AI playground/chat | Member endpoint and streaming client paths exist | Source/API tests PASS | Live provider request and Credits settlement |
| Credits/payments | Topups, verify/complete/refund controls and accounting endpoints exist | Local financial regression PASS | Razorpay sandbox and isolated financial DB |
| Super Admin | Provider, model, pricing, FX, companies, usage, security controls | Backend permission tests PASS | Owner Clerk identity, MFA, external provider credentials |

No control is marked end-to-end passed unless its browser action and backend result were actually observed.
