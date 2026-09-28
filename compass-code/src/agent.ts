import path from "node:path";

import * as vscode from "vscode";

import { CompassClient } from "./client.js";
import { ToolExecutor, toolDefinitions, toolKind, toolSummary } from "./tools.js";
import type { AgentMode, ChatMessage, PermissionRequest, ToolCall, ToolDefinition, TranscriptItem } from "./types.js";
import { parseJsonObject, randomId, truncate } from "./utils.js";

export type AgentHost = {
  append(item: TranscriptItem): void;
  setBusy(busy: boolean): void;
  requestPermission(request: PermissionRequest): Promise<boolean>;
  refreshAccount(): Promise<void>;
};

const modeInstructions: Record<AgentMode, string> = {
  ask: "Answer questions about the codebase. Read files when needed. Do not edit files or run commands.",
  plan: "Investigate the codebase and produce a concrete implementation plan. Do not edit files or run commands.",
  code: "Implement the requested change completely. Inspect relevant files, make focused edits, run validation, and report the result.",
  debug: "Diagnose the problem from evidence, inspect diagnostics and relevant files, make focused fixes when needed, and run validation."
};

export class CompassAgent {
  private messages: ChatMessage[] = [];
  private running: AbortController | null = null;

  constructor(
    private readonly client: CompassClient,
    private readonly tools: ToolExecutor,
    private readonly host: AgentHost
  ) {}

  newTask(): void {
    this.stop();
    this.messages = [];
  }

  stop(): void {
    this.running?.abort();
    this.running = null;
    this.host.setBusy(false);
  }

  async send(prompt: string, model: string, mode: AgentMode, includeSelection: boolean): Promise<void> {
    if (this.running) throw new Error("A Compass task is already running.");
    if (!prompt.trim()) throw new Error("Enter a task first.");
    if (!model) throw new Error("Choose an available model first.");

    this.running = new AbortController();
    this.host.setBusy(true);
    const userContent = await this.withEditorContext(prompt.trim(), includeSelection);
    this.host.append({ id: randomId("user"), role: "user", content: prompt.trim() });
    if (!this.messages.length) {
      this.messages.push({ role: "system", content: this.systemPrompt(mode) });
    }
    this.messages.push({ role: "user", content: userContent });

    const allowedTools = this.toolsForMode(mode);
    const maxSteps = vscode.workspace.getConfiguration("compassCode").get<number>("maxAgentSteps", 8);
    let aggregateTokens = 0;
    let aggregateCost = 0;
    let aggregateLatency = 0;
    let lastRequestId: string | undefined;

    try {
      for (let step = 0; step < maxSteps; step += 1) {
        const response = await this.client.complete(model, this.messages.slice(-60), {
          tools: allowedTools,
          signal: this.running.signal
        });
        aggregateTokens += response.usage?.total_tokens ?? 0;
        aggregateCost += response.compass?.compass_cost_paise ?? 0;
        aggregateLatency += response.compass?.latency_ms ?? 0;
        lastRequestId = response.compass?.request_id ?? lastRequestId;
        const assistant = response.choices[0]?.message;
        if (!assistant) throw new Error("Compass returned no assistant response.");
        this.messages.push(assistant);

        const calls = assistant.tool_calls ?? [];
        if (!calls.length) {
          const content = this.messageText(assistant.content) || "Task completed without a text response.";
          this.host.append({
            id: randomId("assistant"),
            role: "assistant",
            content,
            meta: { model, requestId: lastRequestId, tokens: aggregateTokens, costPaise: aggregateCost, latencyMs: aggregateLatency }
          });
          await this.host.refreshAccount();
          return;
        }

        for (const call of calls) {
          await this.handleToolCall(call, allowedTools);
        }
      }
      this.host.append({ id: randomId("error"), role: "error", content: `Stopped after ${maxSteps} agent steps. Continue with a more specific instruction.` });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.host.append({ id: randomId("status"), role: "status", content: "Task stopped." });
      } else {
        this.host.append({ id: randomId("error"), role: "error", content: error instanceof Error ? error.message : "Compass task failed." });
      }
    } finally {
      this.running = null;
      this.host.setBusy(false);
    }
  }

  private async handleToolCall(call: ToolCall, allowedTools: ToolDefinition[]): Promise<void> {
    const name = call.function.name;
    if (!allowedTools.some((tool) => tool.function.name === name)) {
      this.messages.push({ role: "tool", tool_call_id: call.id, content: `Tool ${name} is unavailable in this mode.` });
      return;
    }
    const rawArguments = call.function.arguments;
    const args = typeof rawArguments === "string" ? parseJsonObject(rawArguments) : rawArguments as unknown as Record<string, unknown>;
    const kind = toolKind(name);
    const request: PermissionRequest = {
      id: call.id,
      toolName: name,
      kind,
      summary: toolSummary(name, args),
      arguments: args
    };
    const approved = this.isAutoApproved(kind) || await this.host.requestPermission(request);
    if (!approved) {
      this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: `Denied: ${request.summary}` });
      this.messages.push({ role: "tool", tool_call_id: call.id, content: "The user denied this tool call. Do not repeat it without changing the approach." });
      return;
    }

    this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: `Running: ${request.summary}` });
    try {
      const result = await this.tools.execute(name, args);
      this.messages.push({ role: "tool", tool_call_id: call.id, content: truncate(result) });
      this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      this.messages.push({ role: "tool", tool_call_id: call.id, content: `Tool error: ${message}` });
      this.host.append({ id: randomId("error"), role: "error", toolName: name, content: message });
    }
  }

  private isAutoApproved(kind: "read" | "write" | "execute"): boolean {
    const config = vscode.workspace.getConfiguration("compassCode");
    if (kind === "read") return config.get<boolean>("autoApproveReads", true);
    if (kind === "write") return config.get<boolean>("autoApproveWrites", false);
    return config.get<boolean>("autoApproveTerminal", false);
  }

  private toolsForMode(mode: AgentMode): ToolDefinition[] {
    if (mode === "ask" || mode === "plan") {
      return toolDefinitions.filter((tool) => toolKind(tool.function.name) === "read");
    }
    return toolDefinitions;
  }

  private systemPrompt(mode: AgentMode): string {
    return [
      "You are Compass Code, a careful coding agent running inside Visual Studio Code.",
      modeInstructions[mode],
      "Use workspace-relative paths. Inspect existing code before proposing changes.",
      "Never claim a command, edit, test, or result occurred unless its tool output proves it.",
      "Never request, reveal, or write API keys, passwords, .env contents, or provider secrets.",
      "Keep edits narrowly scoped. Preserve existing user changes and established project patterns.",
      "When you finish, summarize changed files and validation results concisely."
    ].join("\n");
  }

  private async withEditorContext(prompt: string, includeSelection: boolean): Promise<string> {
    if (!includeSelection) return prompt;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return prompt;
    const root = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    const file = root ? path.relative(root.uri.fsPath, editor.document.uri.fsPath).replaceAll("\\", "/") : editor.document.fileName;
    const selected = editor.document.getText(editor.selection);
    if (!selected) return `${prompt}\n\nActive file: ${file}`;
    return `${prompt}\n\nSelected code from ${file}:\n\`\`\`${editor.document.languageId}\n${truncate(selected, 20_000)}\n\`\`\``;
  }

  private messageText(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("\n");
    }
    return "";
  }
}
