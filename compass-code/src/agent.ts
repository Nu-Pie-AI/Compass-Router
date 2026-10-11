import * as vscode from "vscode";

import { ContextManager } from "./context.js";
import { PermissionManager } from "./permissions.js";
import { ToolExecutor, toolDefinitions, toolKind, toolSummary } from "./tools.js";
import type { ModelProvider } from "./providers.js";
import type { AgentMode, ChatMessage, GoalActivity, GoalFileChange, GoalStatus, GoalStepStatus, PermissionRequest, PermissionDecision, ToolCall, ToolDefinition, ToolKind, TranscriptItem } from "./types.js";
import { parseJsonObject, randomId, truncate } from "./utils.js";

export type AgentHost = {
  append(item: TranscriptItem): void;
  has(id: string): boolean;
  update(id: string, item: Partial<TranscriptItem>): void;
  setBusy(busy: boolean): void;
  requestPermission(request: PermissionRequest): Promise<PermissionDecision>;
  refreshAccount(): Promise<void>;
  setGoalStatus(status: GoalStatus, detail?: string): void;
  setPlanStep(stepId: string, status: GoalStepStatus, detail?: string): void;
  addGoalActivity(activity: Omit<GoalActivity, "id" | "createdAt" | "updatedAt">): string;
  updateGoalActivity(id: string, patch: Partial<GoalActivity>): void;
  recordGoalFileChange(change: GoalFileChange): void;
};

const modeInstructions: Record<AgentMode, string> = {
  ask: "Answer general and code questions conversationally. Do not edit files or run commands; use read tools only when the request clearly needs workspace evidence.",
  edit: "Inspect the requested code and make only the file edits needed for the request. Do not run commands unless explicitly requested.",
  agent: "Autonomously inspect the repository, plan the work, edit files, run validation, and iterate until the task is complete or permission is required.",
  plan: "Investigate the codebase and produce a concrete implementation plan. Do not edit files or run commands.",
  code: "Implement the requested change completely. Inspect relevant files, make focused edits, run validation, and report the result.",
  debug: "Diagnose the problem from evidence, inspect diagnostics and relevant files, make focused fixes when needed, and run validation."
};

export class CompassAgent {
  private messages: ChatMessage[] = [];
  private running: AbortController | null = null;
  private pendingPermissionResolver: ((decision: PermissionDecision) => void) | undefined;

  constructor(
    private readonly client: ModelProvider,
    private readonly tools: ToolExecutor,
    private readonly host: AgentHost,
    private readonly contextManager = new ContextManager(),
    private readonly permissions = new PermissionManager()
  ) {}

  newTask(): void {
    this.stop();
    this.messages = [];
  }

  restoreTranscript(transcript: TranscriptItem[], mode: AgentMode): void {
    this.stop();
    this.messages = [{ role: "system", content: this.systemPrompt(mode) }];
    for (const item of transcript) {
      if (item.role === "user") this.messages.push({ role: "user", content: item.content });
      else if (item.role === "assistant") this.messages.push({ role: "assistant", content: item.content });
      else if (item.role === "tool") this.messages.push({ role: "tool", tool_call_id: randomId("restored-tool"), content: truncate(item.content) });
    }
    if (this.messages.length > 90) this.messages = [this.messages[0], ...this.messages.slice(-89)];
  }

  stop(): void {
    this.running?.abort();
    this.running = null;
    this.pendingPermissionResolver?.("deny");
    this.pendingPermissionResolver = undefined;
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

    const allowedTools = this.toolsForMode(mode, prompt);
    const maxTokens = mode === "ask" ? 1536 : mode === "plan" ? 2048 : 3072;
    const maxSteps = vscode.workspace.getConfiguration("compassCode").get<number>("maxAgentSteps", 8);
    let aggregatePromptTokens = 0;
    let aggregateCompletionTokens = 0;
    let aggregateTokens = 0;
    let aggregateCost = 0;
    let aggregateLatency = 0;
    let lastRequestId: string | undefined;
    let validationFailed = false;
    const pendingAssistantId = randomId("assistant");
    this.host.append({ id: pendingAssistantId, role: "assistant", content: "", streaming: true, meta: { model } });

    try {
      for (let step = 0; step < maxSteps; step += 1) {
        let assistantText = "";
        const toolCalls = new Map<number, ToolCall>();
        let assistantModel = model;
        let roundUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
        let roundCost = 0;
        const seenStreamEvents = new Set<string>();
        for await (const chunk of this.client.stream(model, this.requestMessages(), {
          tools: allowedTools,
          signal: this.running.signal,
          maxTokens
        })) {
          const eventKey = this.streamEventKey(chunk);
          if (seenStreamEvents.has(eventKey)) continue;
          seenStreamEvents.add(eventKey);
          assistantModel = chunk.model ?? assistantModel;
          if (chunk.usage) roundUsage = chunk.usage;
          roundCost = Math.max(roundCost, chunk.compass?.compass_cost_paise ?? 0);
          aggregateLatency = Math.max(aggregateLatency, chunk.compass?.latency_ms ?? 0);
          lastRequestId = chunk.compass?.request_id ?? lastRequestId;
          const delta = chunk.choices?.[0]?.delta;
          const deltaText = this.messageText(delta?.content) || this.messageText((delta as unknown as { reasoning_content?: unknown } | undefined)?.reasoning_content);
          if (deltaText) {
            assistantText += deltaText;
            this.host.update(pendingAssistantId, { content: assistantText, streaming: true });
          }
          for (const part of delta?.tool_calls ?? []) {
            const current = toolCalls.get(part.index) ?? {
              id: part.id ?? randomId("tool-call"),
              type: "function" as const,
              function: { name: "", arguments: "" }
            };
            current.id = part.id ?? current.id;
            current.function.name += part.function?.name ?? "";
            current.function.arguments += part.function?.arguments ?? "";
            toolCalls.set(part.index, current);
          }
        }
        const assistant: ChatMessage = {
          role: "assistant",
          content: assistantText || null,
          ...(toolCalls.size ? { tool_calls: [...toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => call) } : {})
        };
        aggregatePromptTokens += roundUsage?.prompt_tokens ?? 0;
        aggregateCompletionTokens += roundUsage?.completion_tokens ?? 0;
        aggregateTokens += roundUsage?.total_tokens ?? 0;
        aggregateCost += roundCost;
        if (assistantText) {
          this.host.update(pendingAssistantId, {
            content: assistantText,
            streaming: true,
            meta: { model: assistantModel, requestId: lastRequestId, promptTokens: aggregatePromptTokens, completionTokens: aggregateCompletionTokens, tokens: aggregateTokens, costPaise: aggregateCost, latencyMs: aggregateLatency }
          });
        }
        this.messages.push(assistant);

        const calls = assistant.tool_calls ?? [];
        if (!calls.length) {
          if (!assistantText) {
            this.host.update(pendingAssistantId, {
              content: "The selected model returned no text. Check the model route or try again.",
              streaming: false,
              meta: { model: assistantModel, requestId: lastRequestId, promptTokens: aggregatePromptTokens, completionTokens: aggregateCompletionTokens, tokens: aggregateTokens, costPaise: aggregateCost, latencyMs: aggregateLatency }
            });
          } else {
            this.host.update(pendingAssistantId, {
              streaming: false,
              meta: { model: assistantModel, requestId: lastRequestId, promptTokens: aggregatePromptTokens, completionTokens: aggregateCompletionTokens, tokens: aggregateTokens, costPaise: aggregateCost, latencyMs: aggregateLatency }
            });
          }
          this.host.setPlanStep("complete", "completed", "The model completed the current request.");
          this.host.setGoalStatus(validationFailed ? "failed" : "completed", validationFailed ? "Validation reported failures." : "Task completed.");
          await this.host.refreshAccount();
          return;
        }

        for (const call of calls) {
          validationFailed = (await this.handleToolCall(call, allowedTools)) || validationFailed;
        }
        if (this.messages.length > 90) this.messages = [this.messages[0], ...this.messages.slice(-89)];
      }
      this.host.append({ id: randomId("error"), role: "error", content: `Stopped after ${maxSteps} agent steps. Continue with a more specific instruction.` });
      this.host.setPlanStep("complete", "failed", `The agent reached the ${maxSteps}-step limit.`);
      this.host.setGoalStatus("failed", `Stopped after ${maxSteps} agent steps.`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (this.host.has(pendingAssistantId)) {
          this.host.update(pendingAssistantId, { content: "Task stopped before a response was returned.", streaming: false });
        }
        this.host.append({ id: randomId("status"), role: "status", content: "Task stopped." });
      } else {
        const message = error instanceof Error ? error.message : "Compass task failed.";
        this.host.update(pendingAssistantId, { content: "No response was received from the selected model.", streaming: false });
        this.host.append({ id: randomId("error"), role: "error", content: message });
        this.host.setPlanStep("complete", "failed", message);
        this.host.setGoalStatus("failed", message);
      }
    } finally {
      this.running = null;
      this.host.setBusy(false);
    }
  }


  private async handleToolCall(call: ToolCall, allowedTools: ToolDefinition[]): Promise<boolean> {
    const name = call.function.name;
    if (!allowedTools.some((tool) => tool.function.name === name)) {
      this.messages.push({ role: "tool", tool_call_id: call.id, content: `Tool ${name} is unavailable in this mode.` });
      return false;
    }
    const rawArguments = call.function.arguments;
    const args = typeof rawArguments === "string" ? parseJsonObject(rawArguments) : rawArguments as unknown as Record<string, unknown>;
    const kind = toolKind(name);
    const isValidation = name === "run_terminal" || name === "run_tests";
    const isWrite = kind === "write";
    if (isValidation) {
      this.host.setPlanStep("validate", "active", "Running repository validation.");
      this.host.setGoalStatus("testing", "Validation is running.");
    } else if (isWrite) {
      this.host.setPlanStep("plan", "completed", "The implementation plan is ready.");
      this.host.setPlanStep("implement", "active", "Applying the requested changes.");
      this.host.setGoalStatus("working", "Applying changes.");
    } else {
      this.host.setPlanStep("inspect", "active", "Reading repository context.");
      this.host.setGoalStatus("working", "Inspecting the workspace.");
    }
    const activityId = this.host.addGoalActivity({
      kind: "tool",
      title: toolSummary(name, args),
      status: "running",
      toolName: name,
      path: typeof args.path === "string" ? args.path : undefined
    });
    const request: PermissionRequest = {
      id: call.id,
      toolName: name,
      kind,
      summary: toolSummary(name, args),
      arguments: args
    };
    if (this.permissions.isDenied(kind)) {
      this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: `Denied for this session: ${request.summary}` });
      this.host.updateGoalActivity(activityId, { status: "failed", detail: "Denied for this session." });
      this.messages.push({ role: "tool", tool_call_id: call.id, content: "This tool category was rejected for the current session. Do not repeat it." });
      return false;
    }
    const autoApproved = this.isAutoApproved(kind);
    const prepared = kind === "write" && !autoApproved ? await this.tools.preview(name, args) : undefined;
    const decision = autoApproved ? "once" : await this.awaitPermission({ ...request, preview: prepared?.diff, changeId: prepared?.changeId, files: prepared?.files, addedLines: prepared?.addedLines, removedLines: prepared?.removedLines, decisions: ["once", "session", "always", "session-deny", "deny"] });
    if (decision === "session-deny") {
      await this.permissions.remember(kind, decision);
      await this.tools.discardPreview(prepared?.changeId);
      this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: `Denied for this session: ${request.summary}` });
      this.host.updateGoalActivity(activityId, { status: "failed", detail: "Denied for this session." });
      this.messages.push({ role: "tool", tool_call_id: call.id, content: "The user rejected this tool category for the current session." });
      return false;
    }
    if (decision === "deny") {
      await this.tools.discardPreview(prepared?.changeId);
      this.host.append({ id: randomId("tool"), role: "tool", toolName: name, content: `Denied: ${request.summary}` });
      this.host.updateGoalActivity(activityId, { status: "failed", detail: "Rejected by the user." });
      this.messages.push({ role: "tool", tool_call_id: call.id, content: "The user denied this tool call. Do not repeat it without changing the approach." });
      return false;
    }
    await this.permissions.remember(kind, decision);

    const toolTranscriptId = randomId("tool");
    this.host.append({ id: toolTranscriptId, role: "tool", toolName: name, path: typeof args.path === "string" ? args.path : undefined, content: `Running: ${request.summary}` });
    try {
      const result = await this.tools.execute(name, args, this.running?.signal, (output) => {
        this.host.update(toolTranscriptId, { content: output });
        this.host.updateGoalActivity(activityId, { detail: truncate(output, 2000) });
      });
      await this.tools.discardPreview(prepared?.changeId);
      this.host.update(toolTranscriptId, { content: result });
      this.host.updateGoalActivity(activityId, { status: "completed", detail: truncate(result, 3000) });
      if (prepared?.files?.length) {
        prepared.files.forEach((path, index) => this.host.recordGoalFileChange({
          path,
          addedLines: index === 0 ? prepared.addedLines ?? 0 : 0,
          removedLines: index === 0 ? prepared.removedLines ?? 0 : 0
        }));
      }
      if (isValidation) {
        const failed = /exit code:\s*[1-9]|failed|error\b/i.test(result);
        this.host.setPlanStep("validate", failed ? "failed" : "completed", failed ? "Validation reported a failure." : "Validation passed.");
        if (failed) {
          this.host.setPlanStep("fix", "active", "A validation failure needs a fix.");
          this.host.setGoalStatus("failed", "Validation reported a failure.");
        }
        this.messages.push({ role: "tool", tool_call_id: call.id, content: truncate(result) });
        return failed;
      }
      if (isWrite) this.host.setPlanStep("implement", "active", "Change applied; continuing the task.");
      else this.host.setPlanStep("inspect", "completed", "Repository context collected.");
      this.messages.push({ role: "tool", tool_call_id: call.id, content: truncate(result) });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      await this.tools.discardPreview(prepared?.changeId);
      this.host.update(toolTranscriptId, { content: `Tool failed: ${message}` });
      this.host.updateGoalActivity(activityId, { status: "failed", detail: message });
      this.messages.push({ role: "tool", tool_call_id: call.id, content: `Tool error: ${message}` });
      this.host.append({ id: randomId("error"), role: "error", toolName: name, content: message });
      if (isValidation) {
        this.host.setPlanStep("validate", "failed", message);
        this.host.setPlanStep("fix", "active", "A validation failure needs a fix.");
        this.host.setGoalStatus("failed", message);
      }
      return isValidation;
    }
  }

  private isAutoApproved(kind: ToolKind): boolean {
    return this.permissions.isAllowed(kind);
  }

  private async awaitPermission(request: PermissionRequest): Promise<PermissionDecision> {
    return new Promise<PermissionDecision>((resolve) => {
      this.pendingPermissionResolver = resolve;
      void this.host.requestPermission(request).then((decision) => {
        if (this.pendingPermissionResolver !== resolve) return;
        this.pendingPermissionResolver = undefined;
        resolve(decision);
      });
    });
  }

  private toolsForMode(mode: AgentMode, prompt: string): ToolDefinition[] {
    if (mode === "ask" || mode === "plan") {
      if (mode === "ask" && !this.shouldUseReadTools(prompt)) return [];
      return toolDefinitions.filter((tool) => toolKind(tool.function.name) === "read");
    }
    if (mode === "edit") {
      return toolDefinitions.filter((tool) => {
        const kind = toolKind(tool.function.name);
        return kind === "read" || kind === "write";
      });
    }
    return toolDefinitions;
  }

  private systemPrompt(mode: AgentMode): string {
    return [
      "You are Compass Router, a careful coding assistant inside Visual Studio Code.",
      modeInstructions[mode],
      "Use workspace-relative paths and only use tools when they materially help answer the request.",
      "Honor explicit context references such as @file, @folder, @workspace, @selection, @terminal, @git, and @problems.",
      "Never claim a command, edit, test, or result occurred unless its tool output proves it.",
      "Never request, reveal, or write API keys, passwords, .env contents, or provider secrets.",
      "Never create a Git commit unless the user explicitly asks you to commit.",
      "Keep edits narrowly scoped. Preserve existing user changes and established project patterns.",
      "Keep the answer concise and state only work proven by tool output."
    ].join("\n");
  }

  private shouldUseReadTools(prompt: string): boolean {
    const normalized = prompt.trim().toLocaleLowerCase();
    if (/^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening|how are you|what can you do)[!.?,\s]*$/i.test(normalized)) return false;
    return /@(?:file|folder|workspace|selection|terminal|git|problems)\b|\b(workspace|repository|repo|codebase|file|folder|function|class|module|bug|error|stack trace|logs?|current changes|git diff|implement|edit|fix|review|test|diagnos)\b/i.test(normalized);
  }

  private streamEventKey(chunk: { id?: string; choices?: Array<{ index: number; delta?: unknown; finish_reason?: string | null }>; usage?: unknown; compass?: unknown }): string {
    return JSON.stringify({ id: chunk.id ?? "", choices: chunk.choices ?? [], usage: chunk.usage ?? null, compass: chunk.compass ?? null });
  }

  private requestMessages(): ChatMessage[] {
    return this.messages.slice(-32).map((message) => ({
      ...message,
      content: typeof message.content === "string" ? truncate(message.content, 6000) : message.content,
    }));
  }

  private async withEditorContext(prompt: string, includeSelection: boolean): Promise<string> {
    return this.contextManager.build(prompt, includeSelection);
  }

  private messageText(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const item = part as { text?: unknown; content?: unknown };
          return typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
        }
        return "";
      }).join("");
    }
    return "";
  }
}
