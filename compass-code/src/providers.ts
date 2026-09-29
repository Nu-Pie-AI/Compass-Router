import type { ChatCompletion, ChatCompletionStreamDelta, ChatMessage, CompassModel, ToolDefinition } from "./types.js";
import { normalizeBaseUrl } from "./utils.js";

export type ProviderRequestOptions = {
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  maxTokens?: number;
};

export interface ModelProvider {
  models(signal?: AbortSignal): Promise<CompassModel[]>;
  complete(model: string, messages: ChatMessage[], options?: ProviderRequestOptions): Promise<ChatCompletion>;
  stream(model: string, messages: ChatMessage[], options?: ProviderRequestOptions): AsyncGenerator<ChatCompletionStreamDelta>;
}

export type OpenAICompatibleProviderOptions = {
  baseUrl: string;
  apiKey?: string;
};

export function providerTools(tools?: ToolDefinition[]): Array<Omit<ToolDefinition, "permission" | "output">> | undefined {
  return tools?.map(({ permission: _permission, output: _output, ...definition }) => definition);
}

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

function completionToDelta(completion: ChatCompletion): ChatCompletionStreamDelta {
  const choice = completion.choices?.[0];
  const message = choice?.message as (ChatCompletion["choices"][number]["message"] & { reasoning_content?: unknown }) | undefined;
  return {
    id: completion.id,
    model: completion.model,
    choices: [{
      index: 0,
      delta: {
        role: "assistant",
        content: contentText(message?.content) ?? contentText(message?.reasoning_content),
        tool_calls: message?.tool_calls?.map((call, index) => ({ index, id: call.id, type: "function" as const, function: call.function }))
      },
      finish_reason: choice?.finish_reason
    }],
    usage: completion.usage,
    compass: completion.compass
  };
}

export class OpenAICompatibleProvider implements ModelProvider {
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAICompatibleProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
  }

  async models(signal?: AbortSignal): Promise<CompassModel[]> {
    const response = await this.request("/v1/models", { signal });
    const body = await response.json() as { data?: CompassModel[] };
    return body.data ?? [];
  }

  async complete(model: string, messages: ChatMessage[], options: ProviderRequestOptions = {}): Promise<ChatCompletion> {
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      signal: options.signal,
      body: JSON.stringify({ model, messages, stream: false, temperature: 0.2, max_tokens: options.maxTokens ?? 4096, ...(options.tools?.length ? { tools: providerTools(options.tools), tool_choice: "auto" } : {}) })
    });
    return response.json() as Promise<ChatCompletion>;
  }

  async *stream(model: string, messages: ChatMessage[], options: ProviderRequestOptions = {}): AsyncGenerator<ChatCompletionStreamDelta> {
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      signal: options.signal,
      body: JSON.stringify({ model, messages, stream: true, stream_options: { include_usage: true }, temperature: 0.2, max_tokens: options.maxTokens ?? 4096, ...(options.tools?.length ? { tools: providerTools(options.tools), tool_choice: "auto" } : {}) })
    });
    if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
      yield completionToDelta(await response.json() as ChatCompletion);
      return;
    }
    if (!response.body) throw new Error("Provider returned no response stream.");
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
          yield JSON.parse(payload) as ChatCompletionStreamDelta;
        }
        if (next.done) return;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async request(pathname: string, init: RequestInit): Promise<Response> {
    const timeout = AbortSignal.timeout(60_000);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
        headers: {
          "Content-Type": "application/json",
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error;
      throw new Error(`Could not reach the configured provider at ${this.baseUrl}.`);
    }
    if (!response.ok) {
      const raw = await response.text();
      let message = `Provider returned HTTP ${response.status}.`;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string; detail?: string | { error?: { message?: string } } };
        message = parsed.error?.message ?? parsed.message ?? (typeof parsed.detail === "string" ? parsed.detail : parsed.detail?.error?.message) ?? message;
      } catch {
        // Do not expose arbitrary provider response bodies to the webview.
      }
      if (response.status === 401 || response.status === 403) message = "Provider authentication failed. Check the configured credential.";
      if (response.status === 404) message = "The configured provider endpoint or model was not found.";
      if (response.status === 429) message = "Provider rate limit reached. Wait briefly and retry.";
      throw new Error(message);
    }
    return response;
  }
}

export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(baseUrl = "http://127.0.0.1:11434") {
    super({ baseUrl });
  }
}
