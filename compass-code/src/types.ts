export type AgentMode = "ask" | "edit" | "agent" | "plan" | "debug" | "code";
export type ProviderKind = "compass" | "openai-compatible" | "ollama";
export type WorkStyle = "review" | "autonomous";
export type ToolKind = "read" | "write" | "execute" | "network";
export type PermissionDecision = "once" | "session" | "always" | "session-deny" | "deny";
export type GoalStatus = "planning" | "working" | "waiting" | "testing" | "paused" | "completed" | "failed" | "cancelled";
export type GoalStepStatus = "pending" | "active" | "completed" | "failed";
export type GoalActivityStatus = "running" | "completed" | "failed" | "waiting";

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

export type ChatCompletionStreamDelta = {
  id?: string;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: {
      role?: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  compass?: ChatCompletion["compass"];
};

export type TranscriptItem = {
  id: string;
  role: "user" | "assistant" | "tool" | "status" | "error";
  content: string;
  toolName?: string;
  path?: string;
  streaming?: boolean;
  meta?: {
    model?: string;
    requestId?: string;
    tokens?: number;
    costPaise?: number;
    latencyMs?: number;
  };
};

export type GoalPlanStep = {
  id: string;
  title: string;
  status: GoalStepStatus;
  detail?: string;
  updatedAt: number;
};

export type GoalActivity = {
  id: string;
  kind: "tool" | "status" | "error" | "plan";
  title: string;
  detail?: string;
  status: GoalActivityStatus;
  toolName?: string;
  path?: string;
  createdAt: number;
  updatedAt: number;
};

export type GoalFileChange = {
  path: string;
  addedLines: number;
  removedLines: number;
};

export type AgentGoal = {
  id: string;
  title: string;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
  startedAt: number;
  finishedAt?: number;
  elapsedMs: number;
  model?: string;
  mode?: AgentMode;
  contextReferences?: string[];
  plan: GoalPlanStep[];
  activity: GoalActivity[];
  changedFiles: GoalFileChange[];
  followUpCount: number;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: number;
  model?: string;
  mode?: AgentMode;
  contextReferences?: string[];
  goal?: AgentGoal;
};

export type PermissionRequest = {
  id: string;
  toolName: string;
  kind: ToolKind;
  summary: string;
  arguments: Record<string, unknown>;
  decisions?: PermissionDecision[];
  preview?: string;
  changeId?: string;
  files?: string[];
  addedLines?: number;
  removedLines?: number;
};

export type ToolDefinition = {
  permission?: ToolKind;
  output?: Record<string, unknown>;
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
