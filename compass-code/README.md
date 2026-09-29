# Compass Code

Compass Code is the official VS Code coding agent for Compass Router. It gives developers a focused editor workflow for asking questions, planning changes, inspecting a workspace, and applying approved edits through their Compass API key.

`VS Code sidebar -> Compass Code agent -> Compass API -> configured provider routes`

## Install

1. Download the latest `.vsix` from the [Compass releases](https://github.com/Nu-Pie-AI/Compass/releases).
2. In VS Code, run **Extensions: Install from VSIX...** and select the downloaded package.
3. Open the Compass Code view from the activity bar.
4. Connect with a Compass API key created in your workspace.

The published extension uses the hosted Compass API by default. For a self-hosted deployment, change `compassCode.apiBaseUrl` in VS Code settings. The API key is stored through VS Code SecretStorage and is never written to workspace files.

## Work styles and safety

- **Review First** shows plans and asks before file edits or terminal commands.
- **High Autonomy** reduces interruptions for trusted workspaces.
- Read, search, and diagnostics tools can be approved automatically.
- File writes create checkpoints before changing files.
- Writes and terminal commands require explicit approval by default.

## Build locally

```powershell
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run package
```

The generated package is `compass-code-0.1.0.vsix`.

## Source

The extension is published as part of the [Compass repository](https://github.com/Nu-Pie-AI/Compass/tree/main/compass-code).
