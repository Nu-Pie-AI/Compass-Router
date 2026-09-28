export type CompassErrorCode =
  | "invalid_api_key"
  | "insufficient_balance"
  | "model_not_found"
  | "provider_unavailable"
  | "rate_limit_exceeded"
  | "spend_limit_exceeded"
  | "billing_error";

export interface CompassRequestMeta {
  request_id: string;
  provider: string;
  credential_mode: "platform" | "byok";
  latency_ms: number;
  provider_cost_paise: number;
  compass_cost_paise: number;
}
