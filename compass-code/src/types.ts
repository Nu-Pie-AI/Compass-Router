export type AgentMode = "ask" | "plan" | "code" | "debug";
export type WorkStyle = "review" | "autonomous";
export type ToolKind = "read" | "write" | "execute";

export type CompassModel = {
  id: string;
  object: string;
  owned_by: string;
};

export type AccountSummary = {
  team: { id: string; name: string; slug: string } | null;
  wallet: { currency: string; balance_paise: number } | null;
  api_key: { id: string; name: string; status: string; allowed_models: string[] };
  usage: { requests: number; tokens: number; spend_paise: number };
  recent_requests: Array<{
    id: string;
    status: string;
    model: string;
    provider: string;
    tokens: number;
    cost_paise: number;
    latency_ms: number;
    created_at: string;
  }>;
  local_test_mode: boolean;
};

export type ChatMessage = {
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompletion = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  compass?: {
    request_id?: string;
    provider?: string;
    latency_ms?: number;
    compass_cost_paise?: number;
  };
};

export type TranscriptItem = {
  id: string;
  role: "user" | "assistant" | "tool" | "status" | "error";
  content: string;
  toolName?: string;
  meta?: {
    model?: string;
    requestId?: string;
    tokens?: number;
    costPaise?: number;
    latencyMs?: number;
  };
};

export type PermissionRequest = {
  id: string;
  toolName: string;
  kind: ToolKind;
  summary: string;
  arguments: Record<string, unknown>;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
