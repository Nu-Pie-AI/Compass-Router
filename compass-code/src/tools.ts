import { spawn } from "node:child_process";
import path from "node:path";

import * as vscode from "vscode";

import { CheckpointManager } from "./checkpoints.js";
import type { ToolDefinition, ToolKind } from "./types.js";
import { isPathInside, truncate } from "./utils.js";

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
  }
];

const readToolNames = new Set(["read_file", "list_files", "search_files", "get_diagnostics"]);
const writeToolNames = new Set(["write_file", "replace_in_file"]);

export function toolKind(name: string): ToolKind {
  if (readToolNames.has(name)) return "read";
  if (writeToolNames.has(name)) return "write";
  return "execute";
}

export function toolSummary(name: string, args: Record<string, unknown>): string {
  if (name === "run_terminal") return String(args.command ?? "Run terminal command");
  if (typeof args.path === "string") return `${name.replaceAll("_", " ")}: ${args.path}`;
  if (name === "search_files") return `Search workspace for ${String(args.query ?? "text")}`;
  if (name === "list_files") return `List ${String(args.pattern ?? "workspace files")}`;
  return name.replaceAll("_", " ");
}

export class ToolExecutor {
  constructor(private readonly checkpoints: CheckpointManager) {}

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case "read_file": return this.readFile(this.requiredString(args, "path"));
      case "list_files": return this.listFiles(this.requiredString(args, "pattern"));
      case "search_files": return this.searchFiles(this.requiredString(args, "query"), this.optionalString(args, "pattern"));
      case "get_diagnostics": return this.getDiagnostics();
      case "write_file": return this.writeFile(this.requiredString(args, "path"), this.requiredString(args, "content"));
      case "replace_in_file": return this.replaceInFile(this.requiredString(args, "path"), this.requiredString(args, "old_text"), this.requiredString(args, "new_text"));
      case "run_terminal": return this.runTerminal(this.requiredString(args, "command"), Number(args.timeout_seconds ?? 120));
      default: throw new Error(`Unsupported tool: ${name}`);
    }
  }

  private workspaceRoot(): vscode.WorkspaceFolder {
    const root = vscode.workspace.workspaceFolders?.[0];
    if (!root) throw new Error("Open a workspace folder before using agent tools.");
    return root;
  }

  private uriFor(relativePath: string): vscode.Uri {
    const root = this.workspaceRoot();
    const absolute = path.resolve(root.uri.fsPath, relativePath);
    if (!isPathInside(root.uri.fsPath, absolute)) throw new Error("Tool path is outside the current workspace.");
    return vscode.Uri.file(absolute);
  }

  private async readFile(relativePath: string): Promise<string> {
    const content = await vscode.workspace.fs.readFile(this.uriFor(relativePath));
    return truncate(new TextDecoder().decode(content));
  }

  private async listFiles(pattern: string): Promise<string> {
    const root = this.workspaceRoot();
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, pattern),
      "**/{.git,node_modules,dist,build,.next,.venv,coverage}/**",
      250
    );
    return files.map((uri) => path.relative(root.uri.fsPath, uri.fsPath).replaceAll("\\", "/")).join("\n") || "No files matched.";
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
      let text: string;
      try {
        text = new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
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
    const uri = this.uriFor(relativePath);
    await this.checkpoints.create(`Before writing ${relativePath}`, [uri]);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    return `Wrote ${relativePath} (${content.length} characters).`;
  }

  private async replaceInFile(relativePath: string, oldText: string, newText: string): Promise<string> {
    const uri = this.uriFor(relativePath);
    const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    const first = content.indexOf(oldText);
    if (first < 0) throw new Error("The requested old_text was not found.");
    if (content.indexOf(oldText, first + oldText.length) >= 0) throw new Error("The requested old_text is not unique; include more surrounding context.");
    await this.checkpoints.create(`Before editing ${relativePath}`, [uri]);
    const updated = `${content.slice(0, first)}${newText}${content.slice(first + oldText.length)}`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
    return `Updated ${relativePath}.`;
  }

  private async runTerminal(command: string, timeoutSeconds: number): Promise<string> {
    const root = this.workspaceRoot();
    const timeout = Math.max(1, Math.min(timeoutSeconds, 180)) * 1000;
    return new Promise((resolve, reject) => {
      const child = spawn(command, { cwd: root.uri.fsPath, shell: true, windowsHide: true, env: process.env });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${Math.round(timeout / 1000)} seconds.`));
      }, timeout);
      child.stdout.on("data", (chunk: Buffer) => { stdout = truncate(stdout + chunk.toString(), 40_000); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = truncate(stderr + chunk.toString(), 20_000); });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(truncate(`Exit code: ${code ?? "unknown"}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`));
      });
    });
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
