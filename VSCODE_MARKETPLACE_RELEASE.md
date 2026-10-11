# Compass Router VS Code Marketplace Release

Status: **READY FOR OWNER REVIEW, NOT PUBLISHED**
Target version: `0.1.0`
VSIX: `compass-code/compass-router-0.1.0.vsix`

## Identity

- Display name: `Compass Router`
- Package name: `compass-router`
- Current manifest publisher: `nu-pie`
- Provisional extension ID: `nu-pie.compass-router`
- Publisher identity is confirmed by the owner as `nu-pie` / `Compass (Nu-Pie)`.
- Internal `compassCode.*` command, setting, and storage identifiers were preserved for compatibility.

## Package evidence

- `vsce package --no-dependencies`: passed.
- VSIX size: 299,092 bytes.
- VSIX entries: 15.
- Includes the 128x128 Compass Router icon, MIT license, README, changelog, support guide, compiled extension, webview assets, and Codicon font.
- Package secret-pattern scan: zero hits.
- Default Compass API origin is the approved public HTTPS Cloud Run URL already present in the manifest.
- Marketplace lookup reports `nu-pie.compass-router` is not currently published, so version `0.1.0` remains available as the first public target.
- Local Ollama/direct-provider options remain explicit developer choices and are not the default Compass route.
- Local installation: passed as `nu-pie.compass-router@0.1.0`.

## Publication blockers

- Approved Privacy Policy and Terms of Service URLs were not available; none were invented or added.
- Live Clerk login, session revocation, assigned-key inference, streaming, and provider response are not verified.
- Marketplace publication requires explicit owner authorization and supported publisher authentication. No credential was requested, printed, or used.
