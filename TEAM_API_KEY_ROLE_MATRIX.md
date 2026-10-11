# M13 Team API Key Role Matrix

| Capability | Product Owner | Company Admin | Assigned Member | Unassigned Member | Machine Client |
|---|---|---|---|---|---|
| Create team key | Platform governance | Own organization/team | No | No | No |
| View raw secret | Platform governance at creation | At creation only | Never | Never | At creation only |
| Assign members/projects | Platform governance | Own organization/team | No | No | No |
| View safe assigned aliases | Yes | Yes | Yes, own assignments | Empty response | N/A |
| Select permitted project/model | Yes | Yes | Yes, server-checked | Denied | Request policy checked |
| Revoke/rotate | Yes | Own organization/team | No | No | No |
| Use machine API key | Explicit key holder | Explicit key holder | Not inherited | Not inherited | Yes |

All rows are subject to active organization/team status, expiry, project/model policy, capability policy, Credits limits, and audit requirements.
