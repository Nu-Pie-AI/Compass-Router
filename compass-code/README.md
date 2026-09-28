# Compass Code

Compass Code is a local-alpha VS Code extension that gives developers a Kilo-style coding-agent workflow while keeping model access, wallet billing, API-key policy, and provider credentials inside Compass.

The extension is deliberately independent of Kilo's source code. It uses the VS Code webview extension model and a small local agent runtime:

`VS Code sidebar -> Compass Code agent -> Compass /v1/chat/completions -> controlled LiteLLM -> providers`

## Local setup

1. Start the Compass stack from `../controlled-beta-work`:

   ```powershell
   docker compose up -d
   ```

2. Install dependencies and build this extension:

   ```powershell
   npm.cmd install
   npm.cmd run check
   npm.cmd test
   npm.cmd run build
   npm.cmd run package
   ```

3. Install the generated `compass-code-0.1.0.vsix` in VS Code with **Extensions: Install from VSIX...**, then reload VS Code.

4. Open the Compass Code activity-bar view, connect using a Compass API key created in the Compass UI, and choose one of the models granted to that key.

The default API URL is `http://localhost:28000`. The API key is stored through VS Code SecretStorage and is not placed in `.env`, workspace settings, or source files.

## Modes and safety

- Ask and Plan expose read-only workspace tools.
- Code and Debug can request file edits and terminal commands.
- Read tools can be auto-approved by default.
- Writes and terminal commands require an explicit Approve action by default.
- File writes create checkpoints in the extension global storage before changing files.
- The extension never receives provider keys; those remain server-side in Compass.

The local deterministic LiteLLM service may return plain text without tool calls. In that case Compass Code still works as a chat and context assistant, but it cannot execute an agent tool step until the selected model/provider supports tool calling.

This is a local development build, not a production marketplace release. Before publishing, add a real publisher identity, a distributable license, automated extension-host tests, and a security review of terminal execution policy.
