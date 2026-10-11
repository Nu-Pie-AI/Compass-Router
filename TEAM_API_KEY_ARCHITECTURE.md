# Compass Router M13: Team API Key Architecture

## Access modes

- **Managed team access:** a signed-in Clerk/Compass member receives only safe key aliases and server-resolved assignments. The browser and VS Code client never receive a team secret. Each request is authorized against the active member, organization, key, project, model, capability, expiry, status, and Credits policy.
- **Machine/API client access:** a raw Compass key is returned once at creation, stored as a hash, and authenticated independently. Machine keys do not inherit a user's browser privileges.
- **BYOK:** provider credentials remain team-scoped and server-side. BYOK requests retain usage attribution but do not charge Compass Credits.

## Data model

`api_keys` remains the compatibility root. M13 adds `api_key_member_assignments` and `api_key_project_policies`, each with stable foreign keys, active/revoked status, timestamps, and uniqueness per key/member or key/project. Legacy `member_id` and `project_id` remain populated for compatibility and are treated as the first/default assignment.

## Enforcement

The API validates team and organization ownership before assignment changes. Raw-key authentication enforces active key/team, expiry, organization, project policy, and existing model policy. Member-safe listing returns aliases and permitted model/project IDs but no raw secret. Assignment removal is effective for subsequent member requests and every change is auditable.

## Remaining implementation boundary

The next slice must route Clerk-authenticated managed inference through the same provider, Credits, usage, and failure-accounting services without reconstructing or exposing a raw key. Live Clerk browser/device, provider inference, PostgreSQL migration, and extension verification remain external gates.
