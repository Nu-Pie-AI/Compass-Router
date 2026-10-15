# Compass Router Next Feature Matrix

| Area | Status | Evidence / limitation |
|---|---|---|
| Browser sign-in | Implemented | Existing device start, poll and SecretStorage flow reused |
| Sign-out | Implemented | Revokes device session when reachable and clears local secret |
| Live model discovery | Implemented | `/v1/models`, no hardcoded model records |
| Project scope | Implemented | Uses device-approved project and `X-Compass-Project-Id` |
| Chat | Implemented | Host calls `/v1/chat/completions`; response is validated before display |
| Ask / Plan / Agent | UI implemented | Plan/Agent task orchestration and host tools require follow-up runtime work |
| History | Partial | Workspace count and empty state; durable server history is not exposed by current API |
| Usage | Implemented | `/v1/account` totals and recent request rows |
| Settings | Implemented | Functional approval toggles; remaining categories expose honest unavailable state |
| Account | Implemented | Live account/project/session state |
| Tools & MCP | Partial | Built-in approval state UI; no MCP server API is currently available |
| File/diff/terminal tools | Not enabled in this release | No unsafe tool execution was added without a complete approval implementation |
| Light/dark themes | Implemented | VS Code CSS variables and responsive rules |
