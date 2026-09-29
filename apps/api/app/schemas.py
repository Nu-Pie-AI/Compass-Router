from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    organization_name: str = Field(min_length=2)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRoleUpdate(BaseModel):
    role: Literal["customer", "admin", "super_admin"]


class UserAccessUpdate(BaseModel):
    status: Literal["active", "suspended"]
    reason: str = Field(default="", max_length=240)


class MarketplaceSsoRequest(BaseModel):
    token: str = Field(min_length=32, max_length=4096)


class SessionResponse(BaseModel):
    token: str
    user_id: str
    email: EmailStr
    organization_id: str | None = None
    role: str


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,60}$")
    notes: str = Field(default="", max_length=1000)
    workspace_id: str | None = None


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    notes: str = Field(default="", max_length=1000)


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    role: str = Field(default="tester", max_length=40)


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    team_id: str
    member_id: str | None = None
    allowed_models: list[str] = Field(default_factory=list, max_length=20)
    expires_at: datetime | None = None


class ApiKeyModelsUpdate(BaseModel):
    allowed_models: list[str] = Field(default_factory=list, max_length=20)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    role: Literal["system", "developer", "user", "assistant", "tool"]
    content: Any = None

    @field_validator("content")
    @classmethod
    def validate_openai_content(cls, value: Any) -> Any:
        if value is None:
            return value
        if isinstance(value, str):
            if len(value) > 200_000:
                raise ValueError("Message content is too large.")
            return value
        if isinstance(value, list):
            if len(value) > 256:
                raise ValueError("Message content has too many parts.")
            return value
        raise ValueError("Message content must be a string, a content-part list, or null.")


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    messages: list[ChatMessage] = Field(min_length=1, max_length=256)
    temperature: float | None = Field(default=0.7, ge=0, le=2)
    max_tokens: int | None = Field(default=256, ge=1, le=128_000)
    stream: bool = False


class ResponsesRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    input: Any = Field(min_length=1)
    instructions: str | None = Field(default=None, max_length=200_000)
    max_output_tokens: int | None = Field(default=None, ge=1, le=128_000)
    stream: bool = False


class EmbeddingsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    input: str | list[str] | list[int] | list[list[int]]
    encoding_format: Literal["float", "base64"] = "float"
    dimensions: int | None = Field(default=None, ge=1)
    user: str | None = Field(default=None, max_length=200)


class ImageGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    prompt: str = Field(min_length=1, max_length=20_000)
    n: int = Field(default=1, ge=1, le=10)
    size: str | None = Field(default=None, max_length=40)
    quality: str | None = Field(default=None, max_length=40)
    response_format: str | None = Field(default=None, max_length=40)


class AudioSpeechRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    input: str = Field(min_length=1, max_length=20_000)
    voice: str = Field(min_length=1, max_length=80)
    response_format: str | None = Field(default=None, max_length=40)
    speed: float | None = Field(default=None, ge=0.25, le=4)


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    input_file_id: str = Field(min_length=1, max_length=200)
    endpoint: Literal["/v1/chat/completions", "/v1/embeddings", "/v1/responses"]
    completion_window: str = Field(default="24h", min_length=1, max_length=40)
    model: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)
    metadata: dict[str, str] | None = None


class WalletTopupRequest(BaseModel):
    team_id: str
    amount_paise: int = Field(gt=0)
    idempotency_key: str = Field(min_length=8)


class BillingOrderCreate(BaseModel):
    team_id: str
    amount_paise: int = Field(ge=1000, le=5_000_000)


class BillingOrderComplete(BaseModel):
    confirmation: str = Field(min_length=1, max_length=120)


class BillingOrderVerify(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=120)
    razorpay_payment_id: str = Field(min_length=1, max_length=120)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class BillingRefundCreate(BaseModel):
    amount_paise: int | None = Field(default=None, gt=0, le=5_000_000)
    reason: str = Field(default="Customer requested refund", min_length=3, max_length=240)


class ProviderCredentialUpdate(BaseModel):
    provider: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,79}$")
    api_key: str = Field(min_length=8, max_length=4000)


class ByokCredentialUpdate(ProviderCredentialUpdate):
    team_id: str


class ModelActivationRequest(BaseModel):
    team_id: str
    model_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._:/-]*$", max_length=200)


class ModelStatusUpdate(BaseModel):
    status: Literal["available", "unavailable", "expired", "deprecated"]
    enabled: bool | None = None
    published: bool | None = None


class ModelGovernanceUpdate(ModelStatusUpdate):
    fallback_model_id: str | None = Field(default=None, max_length=200)


class ModelPolicyUpdate(BaseModel):
    enabled: bool = True
    requests_per_minute: int = Field(default=0, ge=0, le=1_000_000)
    daily_spend_limit_paise: int = Field(default=0, ge=0, le=5_000_000_000)
    monthly_spend_limit_paise: int = Field(default=0, ge=0, le=50_000_000_000)


class RoutingPolicyUpdate(BaseModel):
    candidate_models: list[str] = Field(min_length=1, max_length=8)
    enabled: bool = True


class ProviderStatusUpdate(BaseModel):
    status: Literal["healthy", "degraded", "unavailable", "disabled"]
    enabled: bool | None = None


class TeamLimitsUpdate(BaseModel):
    requests_per_minute: int = Field(ge=0, le=1_000_000)
    tokens_per_minute: int = Field(ge=0, le=100_000_000)
    daily_spend_limit_paise: int = Field(ge=0, le=5_000_000_000)
    monthly_spend_limit_paise: int = Field(ge=0, le=50_000_000_000)


class TeamStatusUpdate(BaseModel):
    enabled: bool
