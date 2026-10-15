# Compass Router Next Architecture

## Scope

`apps/compass-vscode-next` is a new extension implementation. The existing `compass-code` extension is not modified and remains a read-only reference.

## Runtime

- VS Code host: `src/extension.ts`
- React webview: `src/webview/main.tsx`
- Theme-aware UI: `src/webview/styles.css`
- Typed bridge: `src/shared/contracts.ts`
- Bundling: esbuild produces `dist/extension.js` and `media/main.js`.

The host owns authentication, API calls, SecretStorage, workspace state and future tool execution. The webview receives sanitized state and sends a discriminated message union. Incoming messages are runtime-validated before dispatch.

## Backend contract reuse

The extension uses the existing `/auth/extension/device/start`, `/auth/extension/device/poll`, `/auth/extension/session/revoke`, `/v1/models`, `/v1/account`, and `/v1/chat/completions` contracts. Device approval produces a project-scoped server credential; raw provider credentials never enter the extension.

## Data policy

Models, account, usage, project and assistant content are populated from API responses. Empty and error states are rendered when data is absent. No customer, provider, billing or model records are embedded as fixtures.
