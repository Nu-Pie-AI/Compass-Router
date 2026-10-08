# Compass Router

Compass Router is the VS Code coding agent for Compass Router. It uses real Compass model calls and a typed, permission-gated workspace tool registry for asking questions, planning changes, reviewing edits, running validation, and iterating on repository tasks.

`VS Code sidebar -> Compass Router agent -> Compass API -> configured provider routes`

## Install

1. Download the latest `.vsix` from the [Compass releases](https://github.com/Nu-Pie-AI/Compass/releases).
2. In VS Code, run **Extensions: Install from VSIX...** and select the downloaded package.
3. Open the Compass Router view from the activity bar.
4. Connect with a Compass API key created in your workspace.

The published extension uses the hosted Compass API by default. For a self-hosted deployment, change `compassCode.apiBaseUrl` in VS Code settings. The API key is stored through VS Code SecretStorage and is never written to workspace files. The selected model is persisted as `compassCode.defaultModel` and refreshed from the provider on reconnect.

The connection screen also supports OpenAI-compatible endpoints and local Ollama endpoints. Ollama can run without an API key; other providers use SecretStorage for the entered key.

## Agent workflow

- **Ask** is read-only.
- **Plan** investigates and produces a plan without modifying files.
- **Edit** can modify files but does not run commands automatically.
- **Agent** can inspect, edit, test, diagnose, and iterate with approval gates.
- **Debug** focuses on diagnostics and validation.
- Read tools are automatic by default; writes and commands require explicit approval.
- Approval supports one-time and session-level decisions, with optional persistent settings.
- Permission reviews expose allow once, accept all for the session, always allow, reject, and reject all for the session.
- Protected files, binary files, path traversal, untrusted workspaces, dangerous commands, oversized files, and file conflicts are blocked.
- File changes show a diff preview before approval and create checkpoints before writes/deletes.
- Reviews open in VS Code's native diff editor and expose an explicit Open diff action before approval.
- Terminal and test cards update while output is being produced. Commands use the workspace-matching VS Code terminal when shell integration is available, with a sanitized child-process fallback; Stop cancels the active command.
- `@file`, `@folder`, `@workspace`, `@selection`, `@terminal`, `@git`, and `@problems` references add bounded context without sending the whole repository.
- Conversation history is persisted locally in VS Code workspace state and can be searched, renamed, restored, or deleted.

## Commands

The extension registers **AI: Open Assistant**, **AI: New Chat**, **AI: Explain Selection**, **AI: Fix Selection**, **AI: Refactor Selection**, **AI: Optimize Selection**, **AI: Generate Tests**, **AI: Generate Documentation**, **AI: Fix Problems**, **AI: Review Changes**, **AI: Generate Commit Message**, and **AI: Stop Agent**.

The agent registry includes workspace reads/search, diagnostics, Git status/diff/log/commit, file edits/deletes, terminal commands, and test execution. The model never receives direct filesystem or terminal access.

## Build locally

```powershell
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run package
```

The generated package is `compass-code-0.3.5.vsix` (or the current package version).

## Source

The extension is published as part of the [Compass repository](https://github.com/Nu-Pie-AI/Compass/tree/main/compass-code).
