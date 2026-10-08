import { spawn } from "node:child_process";
import path from "node:path";

import * as vscode from "vscode";

import { CheckpointManager } from "./checkpoints.js";
import { DiffReviewManager } from "./diffs.js";
import { TerminalManager } from "./terminal.js";
import type { ToolDefinition, ToolKind } from "./types.js";
import { isPathInside, isSensitivePath, looksBinary, shellCommandIsBlocked, truncate } from "./utils.js";

export const toolDefinitions: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file inside the current workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in the workspace using a glob pattern.",
      parameters: { type: "object", properties: { pattern: { type: "string", description: "Glob such as src/**/*.ts" } }, required: ["pattern"], additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "list_directory",
      description: "List files in a workspace directory.",
      parameters: { type: "object", properties: { path: { type: "string" }, pattern: { type: "string" } }, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search text across workspace files.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, pattern: { type: "string", description: "Optional include glob" } },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "grep",
      description: "Search text across workspace files.",
      parameters: { type: "object", properties: { query: { type: "string" }, pattern: { type: "string" } }, required: ["query"], additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "get_file_info",
      description: "Get metadata for a workspace file.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "get_workspace",
      description: "Describe the current VS Code workspace folders.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "get_diagnostics",
      description: "Read current VS Code errors and warnings for the workspace.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace a UTF-8 text file. A checkpoint is created first.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
        additionalProperties: false
      }
    }
  },
  {
    permission: "write",
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace one exact text block in a workspace file after creating a checkpoint.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } },
        required: ["path", "old_text", "new_text"],
        additionalProperties: false
      }
    }
  },
  {
    permission: "write",
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a workspace file after creating a checkpoint.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false }
    }
  },
  {
    permission: "execute",
    type: "function",
    function: {
      name: "replace_in_file",
      description: "Replace one exact text block in a workspace file. A checkpoint is created first.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } },
        required: ["path", "old_text", "new_text"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_terminal",
      description: "Run a shell command in the workspace and return captured output.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" }, timeout_seconds: { type: "number", minimum: 1, maximum: 180 } },
        required: ["command"],
        additionalProperties: false
      }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "git_status",
      description: "Read the current Git branch and working tree status.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "git_diff",
      description: "Read the current Git diff.",
      parameters: { type: "object", properties: { staged: { type: "boolean" } }, additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "git_branch",
      description: "Read the current Git branch.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    permission: "read",
    type: "function",
    function: {
      name: "git_log",
      description: "Read recent Git commits.",
      parameters: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 50 } }, additionalProperties: false }
    }
  },
  {
    permission: "execute",
    type: "function",
    function: {
      name: "run_tests",
      description: "Run the workspace test command and return its output.",
      parameters: { type: "object", properties: { command: { type: "string" }, timeout_seconds: { type: "number", minimum: 1, maximum: 180 } }, additionalProperties: false }
    }
  },
  {
    permission: "execute",
    type: "function",
    function: {
      name: "git_commit",
      description: "Create a Git commit from already staged changes. Only use when the user explicitly requests a commit.",
      parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"], additionalProperties: false }
    }
  }
];

const readToolNames = new Set(["read_file", "list_files", "list_directory", "search_files", "grep", "get_file_info", "get_workspace", "get_diagnostics", "git_status", "git_branch", "git_diff", "git_log"]);
const writeToolNames = new Set(["write_file", "replace_in_file", "edit_file", "delete_file"]);

export function toolKind(name: string): ToolKind {
  if (readToolNames.has(name)) return "read";
  if (writeToolNames.has(name)) return "write";
  return "execute";
}

for (const definition of toolDefinitions) {
  definition.permission = toolKind(definition.function.name);
  definition.output = { type: "string" };
}

export function toolSummary(name: string, args: Record<string, unknown>): string {
  if (name === "run_terminal") return String(args.command ?? "Run terminal command");
  if (name === "run_tests") return String(args.command ?? "Run workspace tests");
  if (typeof args.path === "string") return `${name.replaceAll("_", " ")}: ${args.path}`;
  if (name === "search_files") return `Search workspace for ${String(args.query ?? "text")}`;
  if (name === "list_files") return `List ${String(args.pattern ?? "workspace files")}`;
  if (name === "list_directory") return `List ${String(args.path ?? "workspace")}`;
  return name.replaceAll("_", " ");
}

export class ToolExecutor {
  private readonly expectedContent = new Map<string, string>();
  private readonly terminal = new TerminalManager();
  private recentTerminalOutput = "";

  constructor(private readonly checkpoints: CheckpointManager, private readonly reviews?: DiffReviewManager) {}

  recentTerminalContext(): string {
    return this.recentTerminalOutput;
  }

  async gitContext(): Promise<string> {
    try {
      const status = await this.runGit(["status", "--short", "--branch"]);
      const diff = await this.runGit(["diff", "--stat"]);
      return `Git status:\n${status}\nGit diff summary:\n${diff}`;
    } catch (error) {
      return `Git context unavailable: ${error instanceof Error ? error.message : "Git is unavailable."}`;
    }
  }

  async preview(name: string, args: Record<string, unknown>): Promise<{ diff: string; changeId?: string; files: string[]; addedLines: number; removedLines: number } | undefined> {
    if (!writeToolNames.has(name)) return undefined;
    const relativePath = this.requiredString(args, "path");
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not modify protected secret files.");
    const uri = this.uriFor(relativePath);
    let current = "";
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (looksBinary(bytes)) throw new Error("The target file is binary and cannot be safely edited.");
      if (bytes.length > 2_000_000) throw new Error("The target file is larger than Compass Router's 2 MB edit limit.");
      current = new TextDecoder().decode(bytes);
    } catch (error) {
      if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound") throw error;
      // A missing file is an empty baseline for a create preview.
    }
    this.expectedContent.set(uri.toString(), current);
    let proposed = current;
    if (name === "delete_file") proposed = "";
    if (name === "write_file") proposed = this.requiredString(args, "content");
    if (name === "replace_in_file" || name === "edit_file") {
      const oldText = this.requiredString(args, "old_text");
      const newText = this.requiredString(args, "new_text");
      const index = current.indexOf(oldText);
      if (index < 0) throw new Error("The requested old_text was not found.");
      if (current.indexOf(oldText, index + oldText.length) >= 0) throw new Error("The requested old_text is not unique; include more surrounding context.");
      proposed = `${current.slice(0, index)}${newText}${current.slice(index + oldText.length)}`;
    }
    const diff = truncate(this.diffText(relativePath, current, proposed), 12_000);
    const changeId = this.reviews ? await this.reviews.prepare(uri, proposed, `Compass Router review: ${relativePath}`) : undefined;
    const oldLines = current === "" ? [] : current.split(/\r?\n/);
    const newLines = proposed === "" ? [] : proposed.split(/\r?\n/);
    let addedLines = 0;
    let removedLines = 0;
    const limit = Math.max(oldLines.length, newLines.length);
    for (let index = 0; index < limit; index += 1) {
      if (oldLines[index] !== newLines[index]) {
        if (oldLines[index] !== undefined) removedLines += 1;
        if (newLines[index] !== undefined) addedLines += 1;
      }
    }
    return { diff, changeId, files: [relativePath], addedLines, removedLines };
  }

  async openPreview(changeId: string): Promise<void> {
    await this.reviews?.open(changeId);
  }

  async discardPreview(changeId: string | undefined): Promise<void> {
    await this.reviews?.discard(changeId);
  }

  async openFile(relativePath: string): Promise<void> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not open protected secret files automatically.");
    await vscode.window.showTextDocument(this.uriFor(relativePath), { preview: false });
  }

  async execute(name: string, args: Record<string, unknown>, signal?: AbortSignal, onOutput?: (output: string) => void): Promise<string> {
    switch (name) {
      case "read_file": return this.readFile(this.requiredString(args, "path"));
      case "list_files": return this.listFiles(this.requiredString(args, "pattern"));
      case "list_directory": return this.listDirectory(this.optionalString(args, "path") ?? ".", this.optionalString(args, "pattern"));
      case "search_files": return this.searchFiles(this.requiredString(args, "query"), this.optionalString(args, "pattern"));
      case "grep": return this.searchFiles(this.requiredString(args, "query"), this.optionalString(args, "pattern"));
      case "get_file_info": return this.getFileInfo(this.requiredString(args, "path"));
      case "get_workspace": return this.getWorkspace();
      case "get_diagnostics": return this.getDiagnostics();
      case "write_file": return this.writeFile(this.requiredString(args, "path"), this.requiredString(args, "content"));
      case "replace_in_file": return this.replaceInFile(this.requiredString(args, "path"), this.requiredString(args, "old_text"), this.requiredString(args, "new_text"));
      case "edit_file": return this.replaceInFile(this.requiredString(args, "path"), this.requiredString(args, "old_text"), this.requiredString(args, "new_text"));
      case "delete_file": return this.deleteFile(this.requiredString(args, "path"));
      case "run_terminal": return this.runTerminal(this.requiredString(args, "command"), Number(args.timeout_seconds ?? 120), signal, onOutput);
      case "run_tests": return this.runTerminal(this.optionalString(args, "command") ?? "npm test", Number(args.timeout_seconds ?? 120), signal, onOutput);
      case "git_status": return this.runGit(["status", "--short", "--branch"]);
      case "git_branch": return this.runGit(["branch", "--show-current"]);
      case "git_diff": return this.runGit(args.staged === true ? ["diff", "--cached"] : ["diff"]);
      case "git_log": return this.runGit(["log", "-n", String(Math.max(1, Math.min(Number(args.limit ?? 10), 50))), "--oneline", "--decorate"]);
      case "git_commit": return this.gitCommit(this.requiredString(args, "message"));
      default: throw new Error(`Unsupported tool: ${name}`);
    }
  }

  private workspaceRoot(): vscode.WorkspaceFolder {
    const root = vscode.workspace.workspaceFolders?.[0];
    if (!root) throw new Error("Open a workspace folder before using agent tools.");
    if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before allowing Compass Router to inspect or change it.");
    return root;
  }

  private uriFor(relativePath: string): vscode.Uri {
    const root = this.workspaceRoot();
    const absolute = path.resolve(root.uri.fsPath, relativePath);
    if (!isPathInside(root.uri.fsPath, absolute)) throw new Error("Tool path is outside the current workspace.");
    return vscode.Uri.file(absolute);
  }

  private async readFile(relativePath: string): Promise<string> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not read protected secret files.");
    const uri = this.uriFor(relativePath);
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.size > 1_000_000) throw new Error("The requested file is larger than Compass Router's 1 MB text limit.");
    const content = await vscode.workspace.fs.readFile(uri);
    if (looksBinary(content)) throw new Error("Compass Router will not read binary files as text.");
    return truncate(new TextDecoder().decode(content));
  }

  private async listFiles(pattern: string): Promise<string> {
    const root = this.workspaceRoot();
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, pattern),
      "**/{.git,node_modules,dist,build,.next,.venv,coverage}/**",
      250
    );
    return files.map((uri) => path.relative(root.uri.fsPath, uri.fsPath).replaceAll("\\", "/")).filter((file) => !isSensitivePath(file)).join("\n") || "No files matched.";
  }

  private async listDirectory(relativePath: string, pattern?: string): Promise<string> {
    const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
    return this.listFiles(pattern ?? `${normalized || "**"}/**/*`);
  }

  private async searchFiles(query: string, pattern?: string): Promise<string> {
    const root = this.workspaceRoot();
    const rows: string[] = [];
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, pattern || "**/*"),
      "**/{.git,node_modules,dist,build,.next,.venv,coverage}/**",
      250
    );
    const needle = query.toLocaleLowerCase();
    for (const file of files) {
      if (rows.length >= 100) break;
      const relative = path.relative(root.uri.fsPath, file.fsPath).replaceAll("\\", "/");
      if (isSensitivePath(relative)) continue;
      let text: string;
      try {
        const content = await vscode.workspace.fs.readFile(file);
        if (looksBinary(content)) continue;
        text = new TextDecoder().decode(content);
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (rows.length < 100 && line.toLocaleLowerCase().includes(needle)) {
          rows.push(`${path.relative(root.uri.fsPath, file.fsPath).replaceAll("\\", "/")}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    return truncate(rows.join("\n") || "No matches found.");
  }

  private getDiagnostics(): string {
    const root = this.workspaceRoot();
    const rows: string[] = [];
    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
      if (!isPathInside(root.uri.fsPath, uri.fsPath)) continue;
      for (const item of diagnostics.filter((diagnostic) => diagnostic.severity <= vscode.DiagnosticSeverity.Warning).slice(0, 50)) {
        rows.push(`${path.relative(root.uri.fsPath, uri.fsPath).replaceAll("\\", "/")}:${item.range.start.line + 1}: ${item.message}`);
      }
    }
    return truncate(rows.join("\n") || "No workspace errors or warnings.");
  }

  private async writeFile(relativePath: string, content: string): Promise<string> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not write protected secret files.");
    if (content.length > 2_000_000) throw new Error("Compass Router will not write files larger than 2 MB in one operation.");
    const uri = this.uriFor(relativePath);
    await this.assertUnchanged(uri);
    await this.checkpoints.create(`Before writing ${relativePath}`, [uri]);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    return `Wrote ${relativePath} (${content.length} characters).`;
  }

  private async replaceInFile(relativePath: string, oldText: string, newText: string): Promise<string> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not edit protected secret files.");
    const uri = this.uriFor(relativePath);
    await this.assertUnchanged(uri);
    const bytes = await vscode.workspace.fs.readFile(uri);
    if (looksBinary(bytes)) throw new Error("The target file is binary and cannot be safely edited.");
    if (bytes.length > 2_000_000) throw new Error("The target file is larger than Compass Router's 2 MB edit limit.");
    const content = new TextDecoder().decode(bytes);
    const first = content.indexOf(oldText);
    if (first < 0) throw new Error("The requested old_text was not found.");
    if (content.indexOf(oldText, first + oldText.length) >= 0) throw new Error("The requested old_text is not unique; include more surrounding context.");
    await this.checkpoints.create(`Before editing ${relativePath}`, [uri]);
    const updated = `${content.slice(0, first)}${newText}${content.slice(first + oldText.length)}`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
    return `Updated ${relativePath}.`;
  }

  private async deleteFile(relativePath: string): Promise<string> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not delete protected secret files.");
    const uri = this.uriFor(relativePath);
    await this.assertUnchanged(uri);
    await this.checkpoints.create(`Before deleting ${relativePath}`, [uri]);
    await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: true });
    return `Deleted ${relativePath}.`;
  }

  private async assertUnchanged(uri: vscode.Uri): Promise<void> {
    const expected = this.expectedContent.get(uri.toString());
    this.expectedContent.delete(uri.toString());
    if (expected === undefined) return;
    let current = "";
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (looksBinary(bytes)) throw new Error("The target file is binary and cannot be safely edited.");
      current = new TextDecoder().decode(bytes);
    } catch (error) {
      if (error instanceof Error && error.message.includes("binary")) throw error;
    }
    if (current !== expected) throw new Error("The file changed after Compass Router prepared the edit. Refresh the file and review the new change before applying it.");
  }

  private async getFileInfo(relativePath: string): Promise<string> {
    if (isSensitivePath(relativePath)) throw new Error("Compass Router will not inspect protected secret files.");
    const root = this.workspaceRoot();
    const uri = this.uriFor(relativePath);
    const stat = await vscode.workspace.fs.stat(uri);
    return JSON.stringify({ path: path.relative(root.uri.fsPath, uri.fsPath).replaceAll("\\", "/"), type: stat.type, size: stat.size, modified: new Date(stat.mtime).toISOString() }, null, 2);
  }

  private getWorkspace(): string {
    return JSON.stringify((vscode.workspace.workspaceFolders ?? []).map((folder) => ({ name: folder.name, path: folder.uri.fsPath })), null, 2);
  }

  private async runTerminal(command: string, timeoutSeconds: number, signal?: AbortSignal, onOutput?: (output: string) => void): Promise<string> {
    if (shellCommandIsBlocked(command)) throw new Error("This terminal command is blocked by Compass Router safety rules.");
    const root = this.workspaceRoot();
    const result = await this.terminal.run(command, root.uri.fsPath, timeoutSeconds, signal, (output) => {
      this.recentTerminalOutput = output;
      onOutput?.(output);
    });
    this.recentTerminalOutput = truncate(`$ ${command}\n${result}`, 12_000);
    onOutput?.(this.recentTerminalOutput);
    return result;
  }

  private async runGit(args: string[]): Promise<string> {
    const root = this.workspaceRoot();
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (/(_?API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)$/i.test(key)) delete env[key];
      const child = spawn("git", args, { cwd: root.uri.fsPath, shell: false, windowsHide: true, env });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => { stdout = truncate(stdout + chunk.toString(), 40_000); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = truncate(stderr + chunk.toString(), 20_000); });
      child.on("error", reject);
      child.on("close", (code) => {
        const result = truncate(`Exit code: ${code ?? "unknown"}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`);
        resolve(result);
      });
    });
  }

  private async gitCommit(message: string): Promise<string> {
    if (!message.trim() || message.length > 200) throw new Error("Git commit message must be between 1 and 200 characters.");
    return this.runGit(["commit", "-m", message.trim()]);
  }

  private diffText(relativePath: string, current: string, proposed: string): string {
    if (current === proposed) return `No changes proposed for ${relativePath}.`;
    const oldLines = current.split(/\r?\n/);
    const newLines = proposed.split(/\r?\n/);
    const rows = [`--- ${relativePath}`, `+++ ${relativePath}`];
    const limit = Math.max(oldLines.length, newLines.length);
    for (let index = 0; index < limit && rows.length < 220; index += 1) {
      const oldLine = oldLines[index];
      const newLine = newLines[index];
      if (oldLine === newLine) rows.push(`  ${oldLine ?? ""}`);
      else {
        if (oldLine !== undefined) rows.push(`- ${oldLine}`);
        if (newLine !== undefined) rows.push(`+ ${newLine}`);
      }
    }
    if (limit > 220) rows.push("... diff preview truncated ...");
    return rows.join("\n");
  }

  private requiredString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || !value.length) throw new Error(`Tool argument ${key} must be a non-empty string.`);
    return value;
  }

  private optionalString(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    return typeof value === "string" && value.length ? value : undefined;
  }
}
