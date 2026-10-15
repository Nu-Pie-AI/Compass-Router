# Compass Router Next Test Results

## Executed

- `npm run check`: PASS.
- `npm test`: PASS, 1 file and 2 tests.
- `npm run build`: PASS.
- `npx vsce package --no-dependencies`: PASS.
- `code --install-extension apps/compass-vscode-next/compass-router-next-0.1.0.vsix --force`: PASS.
- Live `POST http://127.0.0.1:28000/auth/extension/device/start`: PASS, HTTP 200.
- Running FastAPI OpenAPI route check for `/auth/extension/device/start` and `/auth/extension/device/poll`: PASS.
- Local verification page `http://localhost:23000/extension/authorize`: PASS, HTTP 200.
- VS Code `--extensionDevelopmentPath` launch: PASS; `code --status` showed an active Extension Development Host window.
- Source secret scan for known Clerk, Neon, Redis, Razorpay, OpenAI and database credential patterns: PASS.

## Not executed

- Real Extension Development Host screenshot and interaction: UNVERIFIED.
- Live Clerk/device approval: UNVERIFIED; requires the user to approve the displayed code in the browser.
- Live Compass model inference: UNVERIFIED and intentionally not attempted.
- Full repository backend/web regression suite: not rerun because this change is isolated to the new extension and prior repository changes are unrelated.

## Package audit

The generated VSIX contains the compiled host, compiled webview, icon, manifest, README and license. Source maps and source files are excluded from the VSIX. No `.env` file is packaged.

## Authentication mismatch fixed

The extension had defaulted to the deployed API URL while the verified running API was local on port 28000. The extension now uses the registered local route `/auth/extension/device/start` against `http://127.0.0.1:28000` and opens approval at the active web origin on port 23000. Both values remain configurable for approved non-local environments.
