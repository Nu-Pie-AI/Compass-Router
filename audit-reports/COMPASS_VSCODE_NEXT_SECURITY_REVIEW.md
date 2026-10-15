# Compass Router Next Security Review

## Controls implemented

- Device authorization is initiated through the existing backend; the extension does not create or verify Clerk tokens.
- Device credentials are stored in VS Code SecretStorage, not webview state, source, settings or logs.
- API calls are host-only. The webview cannot call arbitrary URLs.
- Incoming webview messages are allowlisted and validated for type, page, mode, setting key and prompt size.
- Project selection is sent as a server-checked project header; the UI does not grant access.
- CSP restricts the webview to its extension resources and HTTPS images.
- No provider API key, Clerk secret, database URL, Redis token or payment secret is present in source.
- File writes, terminal execution and network tools are deliberately not exposed until their complete host-side approval path is implemented.

## Release risks

- The installed package includes a large bundled React webview; minification and bundle review should be completed before marketplace publication.
- Current backend contracts expose only the device-approved project in `/v1/account`; a multi-project picker requires an API contract that returns authorized projects to device sessions.
- A real browser approval and live model request were not executed in this audit because they require an authorized user session and potentially billable provider access.
- `npm install` reports dependency vulnerabilities. They were not auto-fixed because forced upgrades could change the extension runtime; dependency remediation is a release gate.
