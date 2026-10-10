import * as vscode from "vscode";

import type { AccountSummary, ChatCompletion, ChatCompletionStreamDelta, ChatMessage, CompassModel, ProviderKind, ToolDefinition } from "./types.js";
import { OllamaProvider, OpenAICompatibleProvider, providerTools, type ModelProvider } from "./providers.js";
import { normalizeBaseUrl } from "./utils.js";

const secretKey = "compassCode.apiKey";
const ollamaEnabledKey = "compassCode.ollamaEnabled";
const defaultApiBaseUrl = "https://compass-router-api-c4psf2dvua-uc.a.run.app";
const legacyApiBaseUrl = "https://compass-router-api-567790052414.us-central1.run.app";

function contentText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const text = value.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const item = part as { text?: unknown; content?: unknown };
        return typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
      }
      return "";
    }).join("");
    return text || null;
  }
  return null;
}

export class CompassClient implements ModelProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async startDeviceAuthorization(deviceName = "VS Code"): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_at: string; interval: number }> {
    return this.publicRequest("/auth/extension/device/start", { device_name: deviceName });
  }

  async pollDeviceAuthorization(deviceCode: string): Promise<{ status: string; access_token?: string; project_id?: string | null; expires_at: string }> {
    return this.publicRequest("/auth/extension/device/poll", { device_code: deviceCode });
  }

  get baseUrl(): string {
    const configured = normalizeBaseUrl(vscode.workspace.getConfiguration("compassCode").get<string>("apiBaseUrl", defaultApiBaseUrl));
    return configured === legacyApiBaseUrl ? defaultApiBaseUrl : configured;
  }

  async hasCredential(): Promise<boolean> {
    const provider = vscode.workspace.getConfiguration("compassCode").get<string>("provider", "compass");
    if (provider === "ollama") return this.context.globalState.get<boolean>(ollamaEnabledKey, false);
    return Boolean(await this.context.secrets.get(secretKey));
  }

  async saveConnection(baseUrl: string, apiKey: string, provider?: ProviderKind): Promise<void> {
    const normalized = normalizeBaseUrl(baseUrl);
    await vscode.workspace.getConfiguration("compassCode").update("apiBaseUrl", normalized, vscode.ConfigurationTarget.Global);
    if (apiKey.trim()) await this.context.secrets.store(secretKey, apiKey.trim());
    else await this.context.secrets.delete(secretKey);
    const selectedProvider = provider ?? vscode.workspace.getConfiguration("compassCode").get<ProviderKind>("provider", "compass");
    await this.context.globalState.update(ollamaEnabledKey, selectedProvider === "ollama");
  }

  async setBaseUrl(baseUrl: string): Promise<void> {
    await vscode.workspace.getConfiguration("compassCode").update("apiBaseUrl", normalizeBaseUrl(baseUrl), vscode.ConfigurationTarget.Global);
  }

  async disconnect(): Promise<void> {
    const apiKey = await this.context.secrets.get(secretKey);
    if (apiKey?.startsWith("cmp_device_")) {
      try {
        await this.request<{ status: string }>("/auth/extension/session/revoke", { method: "POST" });
      } catch {
        // Local sign-out must still succeed when the server is unreachable.
      }
    }
    await this.context.secrets.delete(secretKey);
    await this.context.globalState.update(ollamaEnabledKey, false);
  }

  async refreshDeviceSession(): Promise<void> {
    const apiKey = await this.context.secrets.get(secretKey);
    if (!apiKey?.startsWith("cmp_device_")) return;
    const response = await this.request<{ access_token: string }>("/auth/extension/session/refresh", { method: "POST" });
    await this.context.secrets.store(secretKey, response.access_token);
  }

  async provider(kind: ProviderKind): Promise<ModelProvider> {
    if (kind === "compass") return this;
    const apiKey = await this.context.secrets.get(secretKey);
    if (kind === "ollama") return new OllamaProvider(this.baseUrl);
    return new OpenAICompatibleProvider({ baseUrl: this.baseUrl, apiKey });
  }

  async models(signal?: AbortSignal): Promise<CompassModel[]> {
    const response = await this.request<{ data: CompassModel[] }>("/v1/models", { signal });
    return response.data;
  }

  async account(signal?: AbortSignal): Promise<AccountSummary> {
    return this.request<AccountSummary>("/v1/account", { signal });
  }

  async projects(signal?: AbortSignal): Promise<Array<{ id: string; name: string; slug: string; is_default: boolean }>> {
    return this.request<Array<{ id: string; name: string; slug: string; is_default: boolean }>>("/projects", { signal });
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
      body.tools = providerTools(options.tools);
      body.tool_choice = "auto";
    }
    return this.request<ChatCompletion>("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      signal: options.signal
    });
  }

  async *stream(
    model: string,
    messages: ChatMessage[],
    options: { tools?: ToolDefinition[]; signal?: AbortSignal; maxTokens?: number } = {}
  ): AsyncGenerator<ChatCompletionStreamDelta> {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.2,
      max_tokens: options.maxTokens ?? 4096
    };
    if (options.tools?.length) {
      // Keep permission/output metadata local to the extension. Compass expects
      // the standard OpenAI tool schema just like the compatible providers.
      body.tools = providerTools(options.tools);
      body.tool_choice = "auto";
    }
    const response = await this.rawRequest("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      signal: options.signal
    });
    if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
      const completion = await response.json() as ChatCompletion;
      const choice = completion.choices?.[0];
      if (!choice) throw new Error("Compass returned no assistant response.");
      const message = choice.message;
      const extendedMessage = message as (ChatCompletion["choices"][number]["message"] & { reasoning_content?: unknown }) | undefined;
      yield {
        id: completion.id,
        model: completion.model,
        choices: [{ index: 0, delta: { role: "assistant", content: contentText(message?.content) ?? contentText(extendedMessage?.reasoning_content), tool_calls: message?.tool_calls?.map((call, index) => ({ index, id: call.id, type: "function" as const, function: call.function })) }, finish_reason: choice.finish_reason }],
        usage: completion.usage,
        compass: completion.compass
      };
      return;
    }

    if (!response.body) throw new Error("Compass returned an empty streaming response.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const next = await reader.read();
        buffer += decoder.decode(next.value ?? new Uint8Array(), { stream: !next.done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") return;
          try {
            yield JSON.parse(payload) as ChatCompletionStreamDelta;
          } catch {
            throw new Error("Compass returned an invalid streaming response.");
          }
        }
        if (next.done) {
          buffer += decoder.decode();
          const payload = buffer.trim();
          if (payload.startsWith("data:")) {
            const data = payload.slice(5).trim();
            if (data && data !== "[DONE]") {
              try {
                yield JSON.parse(data) as ChatCompletionStreamDelta;
              } catch {
                throw new Error("Compass returned an invalid streaming response.");
              }
            }
          }
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
    const response = await this.rawRequest(pathname, init);
    return response.json() as Promise<T>;
  }

  private async publicRequest<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Compass authorization request failed (HTTP ${response.status}).`);
    return response.json() as Promise<T>;
  }

  private async rawRequest(pathname: string, init: RequestInit = {}): Promise<Response> {
    const apiKey = await this.context.secrets.get(secretKey);
    const provider = vscode.workspace.getConfiguration("compassCode").get<string>("provider", "compass");
    const projectId = vscode.workspace.getConfiguration("compassCode").get<string>("projectId", "").trim();
    if (!apiKey && provider !== "ollama") throw new Error("Connect an API key first.");
    const configuredTimeout = vscode.workspace.getConfiguration("compassCode").get<number>("requestTimeoutSeconds", 45);
    const timeoutSeconds = Math.min(120, Math.max(15, Number.isFinite(configuredTimeout) ? configuredTimeout : 45));
    let response: Response;
    try {
      const timeout = AbortSignal.timeout(timeoutSeconds * 1000);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(projectId ? { "X-Compass-Project-Id": projectId } : {}),
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && error.name === "TimeoutError") throw new Error(`Compass did not return a response within ${timeoutSeconds} seconds. Check the provider route or credentials, then retry.`);
      throw new Error(`Could not reach Compass at ${this.baseUrl}.`);
    }
    if (!response.ok) {
      const raw = await response.text();
      let message = `Compass returned HTTP ${response.status}.`;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string; detail?: { error?: { message?: string } } | string };
        const errorMessage = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
        const detailMessage = typeof parsed.detail === "string" ? parsed.detail : parsed.detail?.error?.message;
        message = errorMessage ?? parsed.message ?? detailMessage ?? message;
      } catch {
        // Do not expose arbitrary provider response bodies in the extension UI.
      }
      if (response.status === 401 || response.status === 403) message = provider === "compass" ? "Compass rejected this API key. Reconnect with an active Compass key." : "Provider authentication failed. Check the configured credential.";
      if (response.status === 429) message = "Provider rate limit reached. Wait briefly and retry.";
      if (response.status === 404) message = "The configured provider endpoint or model was not found.";
      throw new Error(message);
    }
    return response;
  }
}
