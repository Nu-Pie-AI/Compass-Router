import * as vscode from "vscode";

import type { AccountSummary, ChatCompletion, ChatMessage, CompassModel, ToolDefinition } from "./types.js";
import { normalizeBaseUrl } from "./utils.js";

const secretKey = "compassCode.apiKey";

export class CompassClient {
  constructor(private readonly context: vscode.ExtensionContext) {}

  get baseUrl(): string {
    return normalizeBaseUrl(vscode.workspace.getConfiguration("compassCode").get<string>("apiBaseUrl", "https://compass-router-api-567790052414.us-central1.run.app"));
  }

  async hasCredential(): Promise<boolean> {
    return Boolean(await this.context.secrets.get(secretKey));
  }

  async saveConnection(baseUrl: string, apiKey: string): Promise<void> {
    const normalized = normalizeBaseUrl(baseUrl);
    await vscode.workspace.getConfiguration("compassCode").update("apiBaseUrl", normalized, vscode.ConfigurationTarget.Global);
    await this.context.secrets.store(secretKey, apiKey.trim());
  }

  async disconnect(): Promise<void> {
    await this.context.secrets.delete(secretKey);
  }

  async models(signal?: AbortSignal): Promise<CompassModel[]> {
    const response = await this.request<{ data: CompassModel[] }>("/v1/models", { signal });
    return response.data;
  }

  async account(signal?: AbortSignal): Promise<AccountSummary> {
    return this.request<AccountSummary>("/v1/account", { signal });
  }

  async complete(
    model: string,
    messages: ChatMessage[],
    options: { tools?: ToolDefinition[]; signal?: AbortSignal; maxTokens?: number } = {}
  ): Promise<ChatCompletion> {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      temperature: 0.2,
      max_tokens: options.maxTokens ?? 4096
    };
    if (options.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = "auto";
    }
    return this.request<ChatCompletion>("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      signal: options.signal
    });
  }

  private async request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
    const apiKey = await this.context.secrets.get(secretKey);
    if (!apiKey) throw new Error("Connect a Compass API key first.");
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error(`Could not reach Compass at ${this.baseUrl}.`);
    }
    if (!response.ok) {
      const raw = await response.text();
      let message = `Compass returned HTTP ${response.status}.`;
      try {
        const parsed = JSON.parse(raw) as { detail?: { error?: { message?: string } } };
        message = parsed.detail?.error?.message ?? message;
      } catch {
        // Do not expose arbitrary provider response bodies in the extension UI.
      }
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  }
}
