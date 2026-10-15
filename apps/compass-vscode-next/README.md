# Compass Router Next

This is the new Compass Router VS Code extension under active development. It is intentionally separate from `compass-code` and uses the existing Compass browser device-authorization flow.

For local development the extension targets `http://127.0.0.1:28000` and opens device approval at `http://localhost:23000/extension/authorize`. Both are configurable through VS Code settings for an approved environment. The extension stores the short-lived device session only in VS Code SecretStorage. Models, project scope, usage, and chat responses come from the Compass API; no sample customer or provider records are embedded in the UI.
