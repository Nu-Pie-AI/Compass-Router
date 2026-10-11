# M13 Team API Key Test Plan

## Local automated coverage

- Multiple active members per key and multiple keys per member.
- Duplicate assignment PUT is idempotent.
- Removing an assignment revokes member access without revoking the machine secret.
- Cross-team member/project assignment is rejected.
- Inactive, expired, and revoked keys are denied.
- Member-safe listing contains aliases and policy metadata but no raw secret.
- Project policy is enforced while legacy single-project columns remain compatible.
- Assignment changes produce audit events without secret values.
- Concurrent request authorization and wallet reservation remain covered by existing regression tests.

## External staging gates

- Real Clerk session and organization membership.
- Browser managed inference without raw key exposure.
- VS Code device authorization, refresh, logout, and revocation.
- Real provider inference, SSE, BYOK, PostgreSQL, Redis, and Razorpay sandbox.

Mocked/local provider responses do not satisfy the external gates.
