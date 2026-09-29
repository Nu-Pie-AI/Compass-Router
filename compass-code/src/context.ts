import path from "node:path";

import * as vscode from "vscode";

import { isPathInside, isSensitivePath, truncate } from "./utils.js";

export type ContextReference = "file" | "folder" | "workspace" | "selection" | "terminal" | "git" | "problems";

export class ContextManager {
  constructor(
    private readonly recentTerminalOutput: () => string = () => "",
    private readonly gitContext: () => Promise<string> = async () => ""
  ) {}

  async build(prompt: string, includeSelection: boolean): Promise<string> {
    if (!vscode.workspace.isTrusted) return `${prompt}\n\nWorkspace context is unavailable until this workspace is trusted in VS Code.`;
    const references = this.references(prompt);
    const sections: string[] = [];
    const editor = vscode.window.activeTextEditor;
    const root = vscode.workspace.workspaceFolders?.[0];

    if (editor && root && isPathInside(root.uri.fsPath, editor.document.uri.fsPath) && !isSensitivePath(this.relative(root, editor.document.uri))) {
      const file = this.relative(root, editor.document.uri);
      sections.push(`Active file: ${file}`);
      if (includeSelection && !editor.selection.isEmpty) {
        sections.push(`Selected code from ${file}:\n\`\`\`${editor.document.languageId}\n${truncate(editor.document.getText(editor.selection), 20_000)}\n\`\`\``);
      }
    }

    if (references.has("workspace")) sections.push(await this.workspaceStructure(root));
    if (root) {
      for (const match of prompt.matchAll(/@(file|folder)(?::|\s+)([^\s]+)/gi)) {
        const kind = match[1].toLocaleLowerCase();
        const requested = match[2].replaceAll("\\", "/");
        if (kind === "file") sections.push(await this.fileReference(root, requested));
        else sections.push(await this.folderReference(root, requested));
      }
    }
    if (references.has("selection") && editor && !editor.selection.isEmpty) sections.push(`Explicit selection:\n${truncate(editor.document.getText(editor.selection), 20_000)}`);
    if (references.has("problems")) sections.push(this.diagnostics(root));
    if (references.has("terminal")) {
      const output = truncate(this.recentTerminalOutput(), 12_000);
      sections.push(`Recent terminal output:\n${output || "No terminal output has been captured in this session."}`);
    }
    if (references.has("git")) sections.push(await this.gitContext());

    return sections.length ? `${prompt}\n\nWorkspace context:\n${sections.join("\n\n")}` : prompt;
  }

  references(prompt: string): Set<ContextReference> {
    const found = new Set<ContextReference>();
    for (const match of prompt.matchAll(/@(file|folder|workspace|selection|terminal|git|problems)\b/gi)) found.add(match[1].toLocaleLowerCase() as ContextReference);
    return found;
  }

  private async workspaceStructure(root: vscode.WorkspaceFolder | undefined): Promise<string> {
    if (!root) return "Workspace: no folder is open.";
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(root, "**/*"), "**/{.git,node_modules,dist,build,.next,.venv,coverage}/**", 120);
    const visible = files.map((uri) => this.relative(root, uri)).filter((file) => !isSensitivePath(file));
    return `Workspace files:\n${visible.join("\n") || "No visible workspace files found."}`;
  }

  private diagnostics(root: vscode.WorkspaceFolder | undefined): string {
    if (!root) return "Problems: no workspace is open.";
    const rows: string[] = [];
    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
      if (!isPathInside(root.uri.fsPath, uri.fsPath)) continue;
      const file = this.relative(root, uri);
      if (isSensitivePath(file)) continue;
      for (const diagnostic of diagnostics.filter((item) => item.severity <= vscode.DiagnosticSeverity.Warning).slice(0, 30)) {
        rows.push(`${file}:${diagnostic.range.start.line + 1}: ${diagnostic.message}`);
      }
    }
    return `Problems:\n${rows.join("\n") || "No workspace errors or warnings."}`;
  }

  private async fileReference(root: vscode.WorkspaceFolder, requested: string): Promise<string> {
    if (isSensitivePath(requested)) return `@file ${requested}: protected file omitted.`;
    const uri = vscode.Uri.joinPath(root.uri, requested);
    if (!isPathInside(root.uri.fsPath, uri.fsPath)) return `@file ${requested}: path is outside the workspace.`;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.length > 1_000_000) return `@file ${requested}: file exceeds the context size limit.`;
      if (bytes.includes(0)) return `@file ${requested}: binary file omitted.`;
      return `@file ${requested}:\n\`\`\`\n${truncate(new TextDecoder().decode(bytes), 20_000)}\n\`\`\``;
    } catch {
      return `@file ${requested}: file not found.`;
    }
  }

  private async folderReference(root: vscode.WorkspaceFolder, requested: string): Promise<string> {
    if (isSensitivePath(requested)) return `@folder ${requested}: protected folder omitted.`;
    const uri = vscode.Uri.joinPath(root.uri, requested);
    if (!isPathInside(root.uri.fsPath, uri.fsPath)) return `@folder ${requested}: path is outside the workspace.`;
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(root, `${requested.replace(/\/$/, "")}/**/*`), "**/{.git,node_modules,dist,build,.next,.venv,coverage}/**", 100);
    const visible = files.map((file) => this.relative(root, file)).filter((file) => !isSensitivePath(file));
    return `@folder ${requested}:\n${visible.join("\n") || "No visible files found."}`;
  }

  private relative(root: vscode.WorkspaceFolder, uri: vscode.Uri): string {
    return path.relative(root.uri.fsPath, uri.fsPath).replaceAll("\\", "/");
  }
}
