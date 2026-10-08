import type {
  AccountSummary,
  AgentGoal,
  AgentMode,
  CompassModel,
  ConversationSummary,
  PermissionDecision,
  PermissionRequest,
  ProviderKind,
  TranscriptItem,
  WorkStyle,
} from "./types.js";
export type ViewState = {
  baseUrl: string;
  provider: ProviderKind;
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  models: CompassModel[];
  selectedModel: string;
  mode: AgentMode;
  account: AccountSummary | null;
  transcript: TranscriptItem[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  permission: PermissionRequest | null;
  error: string | null;
  goal: AgentGoal | null;
};
export type ViewMessage =
  | {
      type:
        | "ready"
        | "disconnect"
        | "login"
        | "stop"
        | "pauseGoal"
        | "resumeGoal"
        | "cancelGoal"
        | "reviewGoal"
        | "retryLast"
        | "newTask"
        | "refresh"
        | "openSettings"
        | "openAccount"
        | "openDashboard"
        | "copyTranscript"
        | "exportTranscript"
        | "restoreCheckpoint";
    }
  | {
      type: "connect";
      baseUrl: string;
      apiKey: string;
      provider: ProviderKind;
      workStyle: WorkStyle;
    }
  | {
      type: "send";
      prompt: string;
      model: string;
      mode: AgentMode;
      includeSelection: boolean;
    }
  | { type: "openConversation" | "deleteConversation" | "openDiff"; id: string }
  | { type: "renameConversation"; id: string; title: string }
  | { type: "setMode"; mode: AgentMode }
  | { type: "setModel"; model: string }
  | { type: "permission"; id: string; decision: PermissionDecision }
  | { type: "openFile"; path: string }
  | { type: "openConnect"; provider?: ProviderKind }
  | { type: "applyCode"; path: string; content: string };
export type HostMessage =
  | { type: "state"; state: ViewState }
  | { type: "navigate"; page: "chat" | "history" | "settings" | "account" | "connect"; provider?: ProviderKind };
