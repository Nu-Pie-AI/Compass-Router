# M14 Clerk Organization Invitations

## Implemented

- The existing Compass invitation/token flow remains available for local test mode and when Clerk Organizations are disabled.
- With `CLERK_ORGANIZATION_INVITATIONS_ENABLED=true` and a server-side `CLERK_SECRET_KEY`, Company Admin invitation creation calls Clerk's Backend API `POST /v1/organizations/{organization_id}/invitations`.
- Clerk sends the invitation email. Compass stores only the Clerk invitation ID, delivery provider, project/team metadata, status, and audit record. It does not create a competing acceptance token for this path.
- If the local organization has no Clerk organization ID, Compass creates one through Clerk's Backend API with the verified inviter identity and stores the mapping idempotently.
- Resend creates a new Clerk invitation and retires the previous Compass record. Cancel/revoke calls Clerk's revoke endpoint.
- Verified Clerk session `org_id`/`org_role` claims are reconciled to the mapped Compass organization; a removed local membership is denied.

## Required configuration

`CLERK_ORGANIZATION_INVITATIONS_ENABLED`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, `CLERK_INVITATION_REDIRECT_URL`, and a verified Clerk Organization setup. Real email delivery and membership acceptance require staging Clerk verification.

## Safety boundary

The existing application-managed invitation endpoint is not deleted because local tests and legacy customers depend on it. Production must enable the Clerk path only after Clerk Organizations, redirect URLs, webhook delivery, and email templates are configured and browser-tested.
