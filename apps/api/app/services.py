import asyncio
import json
import math
import re
import socket
import time
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlparse

import httpx
from cryptography.fernet import InvalidToken
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .errors import compass_error
from .models import (
    ApiKey,
    ApiKeyModel,
    AuditLog,
    ByokCredential,
    LlmRequest,
    ModelCatalog,
    ModelPolicy,
    Organization,
    OrganizationMember,
    OperationalEvent,
    Provider,
    ProviderAttempt,
    ProviderCredential,
    ProviderHealthCheck,
    RoutingPolicy,
    Team,
    TeamLimit,
    TeamMember,
    User,
    WalletAccount,
    WalletLedger,
    new_id,
    now,
)
from .security import decrypt_secret, encrypt_secret, generate_api_key, hash_api_key, hash_password
from .secrets import get_secret_manager, secret_reference_value


def _credential_reference(provider_name: str, secret: str, scope: str) -> str:
    settings = get_settings()
    if settings.secret_manager_enabled:
        return get_secret_manager().put(f"{scope}-{provider_name}-{new_id()}", secret)
    return encrypt_secret(secret)


def _credential_value(reference: str) -> str:
    if reference.startswith("gcp-secret:"):
        return secret_reference_value(reference)
    if reference.startswith("encrypted:"):
        try:
            return decrypt_secret(reference)
        except InvalidToken:
            raise compass_error(503, "provider_credential_invalid", "The provider credential cannot be decrypted. Re-save the provider key.") from None
    return ""


def _has_usable_reference(reference: str) -> bool:
    return reference.startswith(("encrypted:", "gcp-secret:")) or (get_settings().local_test_mode and reference.startswith("server-side/"))


def select_user_by_email(email: str):
    return select(User).where(User.email == email.lower())


def record_audit_log(
    db: Session,
    actor: User | None,
    action: str,
    target: str,
    metadata: dict | None = None,
    request_id: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        target=target,
        request_id=request_id,
        metadata_json=json.dumps(metadata or {}, sort_keys=True),
    )
    db.add(entry)
    return entry


def organization_id_for_user(db: Session, user_id: str) -> str | None:
    return db.scalar(
        select(OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user_id)
        .limit(1)
    )


def register_customer(db: Session, email: str, password: str, organization_name: str) -> tuple[User, Organization, Team]:
    normalized_email = email.strip().lower()
    workspace_name = organization_name.strip()
    if db.scalar(select_user_by_email(normalized_email)) is not None:
        raise compass_error(409, "account_exists", "An account already exists for this email.")

    settings = get_settings()
    user = User(email=normalized_email, password_hash=hash_password(password), role="customer")
    organization = Organization(name=workspace_name)
    db.add_all([user, organization])

    try:
        db.flush()
        slug_base = re.sub(r"[^a-z0-9]+", "-", workspace_name.lower()).strip("-") or "workspace"
        team_slug = f"{slug_base[:48]}-{user.id[:8]}"
        team = Team(organization_id=organization.id, name=workspace_name, slug=team_slug, notes="Customer workspace created during signup")
        db.add(team)
        db.flush()
        db.add_all(
            [
                OrganizationMember(user_id=user.id, organization_id=organization.id, role="owner"),
                TeamMember(
                    team_id=team.id,
                    name=normalized_email.split("@", 1)[0][:120],
                    email=normalized_email,
                    role="owner",
                ),
                TeamLimit(
                    team_id=team.id,
                    requests_per_minute=settings.default_team_request_limit_per_minute,
                    tokens_per_minute=settings.default_team_token_limit_per_minute,
                    daily_spend_limit_paise=settings.default_team_daily_spend_limit_paise,
                    monthly_spend_limit_paise=settings.default_team_monthly_spend_limit_paise,
                ),
                WalletAccount(team_id=team.id, balance_paise=0),
            ]
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise compass_error(409, "account_exists", "An account or workspace already exists for these details.") from exc

    return user, organization, team


def upsert_marketplace_user(db: Session, email: str, marketplace_role: str, display_name: str | None = None) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select_user_by_email(normalized_email))
    if user is None:
        workspace = (display_name or normalized_email.split("@", 1)[0]).strip() or "Compass Workspace"
        user, _, _ = register_customer(
            db,
            normalized_email,
            f"marketplace-sso:{get_settings().app_secret}:{normalized_email}",
            f"{workspace} Workspace",
        )
    if marketplace_role in {"admin", "super_admin"}:
        user.role = "admin"
    elif user.role not in {"admin", "super_admin"}:
        user.role = "customer"
    db.commit()
    return user


def bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    user = db.scalar(select_user_by_email(settings.admin_email.lower()))
    if user is None:
        db.add(User(email=settings.admin_email.lower(), password_hash=hash_password(settings.admin_password), role="admin"))
        db.commit()
        return
    # The configured owner account is the highest-privilege product account.
    # Other administrators can still be managed from the owner console.
    user.role = "super_admin"
    db.commit()


def bootstrap_customer_fixture(
    db: Session,
    *,
    email: str,
    password: str,
    name: str,
    team_name: str,
    team_slug: str,
    credit_reference: str,
) -> None:
    settings = get_settings()
    email = email.lower()
    user = db.scalar(select_user_by_email(email))
    if user is None:
        user = User(email=email, password_hash=hash_password(password), role="customer")
        db.add(user)
        db.commit()
    elif user.role != "customer":
        raise RuntimeError("The local customer email is already assigned to a privileged account.")

    organization_id = organization_id_for_user(db, user.id)
    if organization_id is None:
        organization = Organization(name=team_name)
        db.add(organization)
        db.flush()
        organization_id = organization.id
        db.add(OrganizationMember(user_id=user.id, organization_id=organization.id, role="owner"))
        db.commit()

    team = db.scalar(select(Team).where(Team.slug == team_slug))
    if team is None:
        team = create_team(
            db,
            team_name,
            team_slug,
            "Seeded local customer workspace",
            organization_id,
        )

    member = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.email == email))
    if member is None:
        create_team_member(db, team.id, name, email, "owner")

    credit_wallet(
        db,
        team.id,
        settings.local_test_wallet_credit_paise,
        credit_reference,
        credit_reference,
    )


def bootstrap_local_customers(db: Session) -> None:
    settings = get_settings()
    bootstrap_customer_fixture(
        db,
        email=settings.local_test_customer_email,
        password=settings.local_test_customer_password,
        name=settings.local_test_customer_name,
        team_name=settings.local_test_customer_team_name,
        team_slug=settings.local_test_customer_team_slug,
        credit_reference="local-customer-seed-credit-v1",
    )
    bootstrap_customer_fixture(
        db,
        email=settings.local_test_customer_2_email,
        password=settings.local_test_customer_2_password,
        name=settings.local_test_customer_2_name,
        team_name=settings.local_test_customer_2_team_name,
        team_slug=settings.local_test_customer_2_team_slug,
        credit_reference="local-customer-2-seed-credit-v1",
    )


def ensure_provider(db: Session, name: str) -> Provider:
    provider = db.scalar(select(Provider).where(Provider.name == name))
    if provider is None:
        provider = Provider(name=name, enabled=True, status="healthy")
        db.add(provider)
        db.flush()
    return provider


def ensure_platform_credential(db: Session, provider: Provider) -> None:
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None:
        db.add(
            ProviderCredential(
                provider_id=provider.id,
                credential_mode="platform",
                secret_reference=f"server-side/{provider.name}/local-test",
                status="local_test",
                last_four="",
            )
        )


def upsert_model(
    db: Session,
    *,
    model_id: str,
    provider: Provider,
    provider_model_id: str,
    display_name: str,
    capabilities: str,
    context_window: int,
    input_price_paise_per_1k: int,
    output_price_paise_per_1k: int,
    fallback_model_id: str | None = None,
) -> None:
    model = db.get(ModelCatalog, model_id)
    if model is None:
        db.add(
            ModelCatalog(
                id=model_id,
                provider_id=provider.id,
                provider_model_id=provider_model_id,
                display_name=display_name,
                capabilities=capabilities,
                context_window=context_window,
                input_price_paise_per_1k=input_price_paise_per_1k,
                output_price_paise_per_1k=output_price_paise_per_1k,
                fallback_model_id=fallback_model_id,
            )
        )
        return
    model.provider_id = provider.id
    model.provider_model_id = provider_model_id
    model.display_name = display_name
    model.capabilities = capabilities
    model.context_window = context_window
    model.input_price_paise_per_1k = input_price_paise_per_1k
    model.output_price_paise_per_1k = output_price_paise_per_1k
    model.enabled = True
    model.published = True
    model.supports_streaming = True
    model.fallback_model_id = fallback_model_id


def seed_defaults(db: Session) -> None:
    settings = get_settings()
    providers = {name: ensure_provider(db, name) for name in ("openai", "gemini", "ollama_cloud")}
    for provider in providers.values():
        ensure_platform_credential(db, provider)
    provider_model = "local-test-chat" if settings.local_test_mode else "gpt-5"
    gemini_credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == providers["gemini"].id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    )
    gemini_provider_model = "gemini-flash-real" if settings.local_test_mode and gemini_credential and gemini_credential.secret_reference.startswith("encrypted:") else provider_model
    ollama_credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == providers["ollama_cloud"].id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    )
    ollama_provider_model = "ollama-cloud-gpt-oss-20b-real" if settings.local_test_mode and ollama_credential and ollama_credential.secret_reference.startswith("encrypted:") else provider_model
    upsert_model(
        db,
        model_id="openai/gpt-5",
        provider=providers["openai"],
        provider_model_id=provider_model,
        display_name="GPT-5",
        capabilities="chat,reasoning,local-test",
        context_window=128000,
        input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
        output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
        fallback_model_id="gemini/gemini-3.6-flash",
    )
    upsert_model(
        db,
        model_id="gemini/gemini-3.6-flash",
        provider=providers["gemini"],
        provider_model_id=gemini_provider_model,
        display_name="Gemini 3.6 Flash",
        capabilities="chat,fast,local-test",
        context_window=1000000,
        input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
        output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
        fallback_model_id="ollama_cloud/gpt-oss:20b",
    )
    upsert_model(
        db,
        model_id="ollama_cloud/gpt-oss:20b",
        provider=providers["ollama_cloud"],
        provider_model_id=ollama_provider_model,
        display_name="GPT-OSS 20B on Ollama Cloud",
        capabilities="chat,open-weights,local-test",
        context_window=128000,
        input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
        output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
    )
    db.flush()
    legacy_ids = {
        "compass/gpt-5": "openai/gpt-5",
        "compass/gemini-flash": "gemini/gemini-3.6-flash",
        "compass/llama": "ollama_cloud/gpt-oss:20b",
    }
    for legacy_id, native_id in legacy_ids.items():
        legacy = db.get(ModelCatalog, legacy_id)
        if legacy is None:
            continue
        for grant in db.scalars(select(ApiKeyModel).where(ApiKeyModel.model_id == legacy_id)).all():
            exists = db.scalar(select(ApiKeyModel).where(ApiKeyModel.api_key_id == grant.api_key_id, ApiKeyModel.model_id == native_id))
            if exists is None:
                db.add(ApiKeyModel(api_key_id=grant.api_key_id, model_id=native_id))
            db.delete(grant)
        legacy.enabled = False
        legacy.published = False
    if settings.local_test_mode:
        for limit in db.scalars(select(TeamLimit)).all():
            if limit.tokens_per_minute < settings.default_team_token_limit_per_minute:
                limit.tokens_per_minute = settings.default_team_token_limit_per_minute
    bootstrap_admin(db)
    if settings.local_test_mode:
        bootstrap_local_customers(db)
    db.commit()


def upsert_provider_api_key(db: Session, provider_name: str, api_key: str) -> ProviderCredential:
    provider = ensure_provider(db, provider_name)
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None:
        credential = ProviderCredential(provider_id=provider.id, credential_mode="platform", secret_reference="", status="active")
        db.add(credential)
        db.flush()
    credential.secret_reference = _credential_reference(provider_name, api_key, "platform")
    credential.status = "active"
    credential.last_four = api_key[-4:]
    credential.updated_at = now()
    db.commit()
    return credential


def upsert_byok_api_key(db: Session, team_id: str, user_id: str, provider_name: str, api_key: str) -> ByokCredential:
    provider = ensure_provider(db, provider_name)
    credential = db.scalar(
        select(ByokCredential).where(ByokCredential.team_id == team_id, ByokCredential.provider_id == provider.id)
    )
    if credential is None:
        credential = ByokCredential(team_id=team_id, user_id=user_id, provider_id=provider.id, encrypted_secret="")
        db.add(credential)
    credential.user_id = user_id
    credential.encrypted_secret = _credential_reference(provider_name, api_key, f"team-{team_id}")
    credential.status = "active"
    credential.last_four = api_key[-4:]
    credential.updated_at = now()
    db.commit()
    return credential


def byok_credentials_summary(db: Session, team_id: str) -> list[dict]:
    credentials = db.scalars(
        select(ByokCredential).where(ByokCredential.team_id == team_id).order_by(ByokCredential.updated_at.desc())
    ).all()
    return [
        {
            "id": credential.id,
            "team_id": credential.team_id,
            "provider": credential.provider.name,
            "status": credential.status,
            "configured": credential.status == "active" and credential.encrypted_secret.startswith(("encrypted:", "gcp-secret:")),
            "last_four": credential.last_four,
            "created_at": credential.created_at.isoformat(),
            "updated_at": credential.updated_at.isoformat(),
        }
        for credential in credentials
    ]


def revoke_byok_api_key(db: Session, team_id: str, provider_name: str) -> ByokCredential:
    credential = db.scalar(
        select(ByokCredential)
        .join(Provider, Provider.id == ByokCredential.provider_id)
        .where(ByokCredential.team_id == team_id, Provider.name == provider_name)
    )
    if credential is None:
        raise compass_error(404, "byok_credential_not_found", "BYOK credential not found.")
    credential.encrypted_secret = ""
    credential.last_four = ""
    credential.status = "revoked"
    credential.updated_at = now()
    db.commit()
    return credential


def provider_credentials_summary(db: Session) -> list[dict]:
    providers = db.scalars(select(Provider).order_by(Provider.name)).all()
    credentials = db.scalars(select(ProviderCredential)).all()
    credential_by_provider = {credential.provider_id: credential for credential in credentials}
    rows = []
    for provider in providers:
        credential = credential_by_provider.get(provider.id)
        rows.append(
            {
                "id": provider.id,
                "name": provider.name,
                "enabled": provider.enabled,
                "status": provider.status,
                "credential_status": credential.status if credential else "missing",
                "has_configured_key": bool(credential and credential.secret_reference.startswith(("encrypted:", "gcp-secret:"))),
                "last_four": credential.last_four if credential and credential.last_four else "",
                "updated_at": credential.updated_at.isoformat() if credential else None,
            }
        )
    return rows


def configured_provider_secret(db: Session, provider_name: str) -> str | None:
    credential = db.scalar(
        select(ProviderCredential)
        .join(Provider, Provider.id == ProviderCredential.provider_id)
        .where(
            Provider.name == provider_name,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    )
    if credential is None or not _has_usable_reference(credential.secret_reference):
        return None
    return _credential_value(credential.secret_reference)


def infer_openai_capabilities(model_id: str) -> list[str]:
    value = model_id.lower()
    if "embedding" in value:
        return ["embeddings"]
    if "image" in value or value.startswith("dall-e"):
        return ["images"]
    if any(term in value for term in ("audio", "transcribe", "tts", "whisper")):
        return ["audio"]
    return ["chat"]


async def discover_provider_models(db: Session) -> dict:
    sources: list[dict] = []
    timeout = httpx.Timeout(15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        openai_credential_error = False
        try:
            openai_key = configured_provider_secret(db, "openai")
        except HTTPException:
            openai_key = None
            openai_credential_error = True
            sources.append(
                {
                    "provider": "openai",
                    "status": "error",
                    "models": [],
                    "error": "The saved OpenAI credential cannot be decrypted. Re-save the provider key.",
                }
            )
        if openai_key:
            try:
                response = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"})
                response.raise_for_status()
                rows = response.json().get("data", [])
                models = [
                    {
                        "provider": "openai",
                        "provider_model_id": row["id"],
                        "display_name": row["id"],
                        "capabilities": infer_openai_capabilities(row["id"]),
                        "context_window": None,
                        "metadata": {"owned_by": row.get("owned_by")},
                    }
                    for row in rows
                    if isinstance(row, dict) and isinstance(row.get("id"), str)
                ]
                sources.append({"provider": "openai", "status": "available", "models": models, "error": None})
            except (httpx.HTTPError, ValueError, TypeError):
                sources.append({"provider": "openai", "status": "error", "models": [], "error": "OpenAI model discovery failed. Verify the provider credential."})
        elif not openai_credential_error:
            sources.append({"provider": "openai", "status": "unconfigured", "models": [], "error": "Configure an OpenAI provider key to discover models."})

        gemini_credential_error = False
        try:
            gemini_key = configured_provider_secret(db, "gemini")
        except HTTPException:
            gemini_key = None
            gemini_credential_error = True
            sources.append(
                {
                    "provider": "gemini",
                    "status": "error",
                    "models": [],
                    "error": "The saved Gemini credential cannot be decrypted. Re-save the provider key.",
                }
            )
        if gemini_key:
            try:
                models = []
                page_token = None
                for _ in range(10):
                    params = {"pageSize": "1000"}
                    if page_token:
                        params["pageToken"] = page_token
                    response = await client.get(
                        "https://generativelanguage.googleapis.com/v1beta/models",
                        headers={"x-goog-api-key": gemini_key},
                        params=params,
                    )
                    response.raise_for_status()
                    payload = response.json()
                    for row in payload.get("models", []):
                        if not isinstance(row, dict) or not isinstance(row.get("name"), str):
                            continue
                        model_id = row["name"].removeprefix("models/")
                        methods = row.get("supportedGenerationMethods") or []
                        models.append(
                            {
                                "provider": "gemini",
                                "provider_model_id": model_id,
                                "display_name": row.get("displayName") or model_id,
                                "capabilities": sorted(str(method) for method in methods),
                                "context_window": row.get("inputTokenLimit"),
                                "metadata": {"output_token_limit": row.get("outputTokenLimit"), "version": row.get("version")},
                            }
                        )
                    page_token = payload.get("nextPageToken")
                    if not page_token:
                        break
                sources.append({"provider": "gemini", "status": "available", "models": models, "error": None})
            except (httpx.HTTPError, ValueError, TypeError):
                sources.append({"provider": "gemini", "status": "error", "models": [], "error": "Gemini model discovery failed. Verify the provider credential."})
        elif not gemini_credential_error:
            sources.append({"provider": "gemini", "status": "unconfigured", "models": [], "error": "Configure a Gemini provider key to discover models."})

        try:
            response = await client.get("https://ollama.com/api/tags")
            response.raise_for_status()
            rows = response.json().get("models", [])
            models = [
                {
                    "provider": "ollama_cloud",
                    "provider_model_id": row.get("model") or row.get("name"),
                    "display_name": row.get("name") or row.get("model"),
                    "capabilities": ["chat"],
                    "context_window": None,
                    "metadata": {
                        "family": (row.get("details") or {}).get("family"),
                        "parameter_size": (row.get("details") or {}).get("parameter_size"),
                    },
                }
                for row in rows
                if isinstance(row, dict) and isinstance(row.get("model") or row.get("name"), str)
            ]
            sources.append({"provider": "ollama_cloud", "status": "available", "models": models, "error": None})
        except (httpx.HTTPError, ValueError, TypeError):
            sources.append({"provider": "ollama_cloud", "status": "error", "models": [], "error": "Ollama Cloud model discovery failed."})

    published = {(row.provider.name, row.provider_model_id): row.id for row in db.scalars(select(ModelCatalog)).all()}
    all_models = []
    for source in sources:
        for model in source["models"]:
            model["compass_model_id"] = published.get((model["provider"], model["provider_model_id"]))
            all_models.append(model)
        source["count"] = len(source["models"])
    all_models.sort(key=lambda row: (row["provider"], row["provider_model_id"].lower()))
    return {"models": all_models, "sources": sources, "total": len(all_models), "refreshed_at": now().isoformat()}


BYOK_SINGLE_KEY_PROVIDERS = {
    "ai21",
    "anthropic",
    "cohere",
    "deepinfra",
    "deepseek",
    "fireworks_ai",
    "gemini",
    "groq",
    "mistral",
    "novita",
    "openai",
    "openrouter",
    "perplexity",
    "replicate",
    "together_ai",
    "voyage",
    "xai",
}
_litellm_catalog_cache: dict = {"expires_at": 0.0, "models": [], "sources": []}


def _native_model_id(provider: str, raw_model_id: str) -> str:
    prefix = f"{provider}/"
    return raw_model_id if raw_model_id.startswith(prefix) else f"{prefix}{raw_model_id}"


def _catalog_capabilities(row: dict) -> list[str]:
    capabilities = [str(row.get("mode") or "unknown")]
    flags = {
        "supports_audio_input": "audio-input",
        "supports_audio_output": "audio-output",
        "supports_function_calling": "tools",
        "supports_reasoning": "reasoning",
        "supports_response_schema": "structured-output",
        "supports_vision": "vision",
        "supports_web_search": "web-search",
    }
    capabilities.extend(label for field, label in flags.items() if row.get(field) is True)
    return capabilities


def _as_number(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


async def litellm_model_catalog(db: Session, *, force: bool = False) -> dict:
    settings = get_settings()
    current_time = time.monotonic()
    if not force and _litellm_catalog_cache["models"] and current_time < _litellm_catalog_cache["expires_at"]:
        cached_models = _litellm_catalog_cache["models"]
        cached_sources = _litellm_catalog_cache["sources"]
    else:
        base_url = (settings.compass_litellm_url or settings.litellm_url).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=settings.litellm_timeout_seconds) as client:
                response = await client.get(f"{base_url}/public/litellm_model_cost_map")
                response.raise_for_status()
                raw_catalog = response.json()
        except (httpx.HTTPError, ValueError, TypeError):
            raise compass_error(503, "model_catalog_unavailable", "The controlled LiteLLM model registry is unavailable.") from None
        if not isinstance(raw_catalog, dict):
            raise compass_error(503, "model_catalog_unavailable", "The controlled LiteLLM model registry is invalid.")

        normalized: dict[str, dict] = {}
        provider_counts: dict[str, int] = {}
        for raw_model_id, metadata in raw_catalog.items():
            if raw_model_id == "sample_spec" or not isinstance(raw_model_id, str) or not isinstance(metadata, dict):
                continue
            provider = metadata.get("litellm_provider")
            if not isinstance(provider, str) or not provider or provider.startswith("one of "):
                continue
            model_id = _native_model_id(provider, raw_model_id)
            context_window = metadata.get("max_input_tokens") or metadata.get("max_tokens")
            if not isinstance(context_window, int):
                context_window = None
            display_tail = raw_model_id.rsplit("/", 1)[-1]
            normalized[model_id] = {
                "provider": provider,
                "provider_model_id": model_id,
                "litellm_model_id": model_id,
                "display_name": display_tail.replace("-", " ").replace("_", " ").strip().title(),
                "capabilities": _catalog_capabilities(metadata),
                "mode": metadata.get("mode") or "unknown",
                "context_window": context_window,
                "input_cost_per_million_usd": (_as_number(metadata.get("input_cost_per_token")) or 0) * 1_000_000,
                "output_cost_per_million_usd": (_as_number(metadata.get("output_cost_per_token")) or 0) * 1_000_000,
                "byok_supported": provider in BYOK_SINGLE_KEY_PROVIDERS,
                "metadata": {
                    "deprecation_date": metadata.get("deprecation_date"),
                    "max_output_tokens": metadata.get("max_output_tokens"),
                },
            }
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        cached_models = sorted(normalized.values(), key=lambda row: (row["provider"], row["provider_model_id"]))
        cached_sources = [
            {"provider": provider, "status": "available", "count": count, "error": None}
            for provider, count in sorted(provider_counts.items(), key=lambda item: (-item[1], item[0]))
        ]
        _litellm_catalog_cache.update(
            expires_at=current_time + settings.litellm_catalog_cache_seconds,
            models=cached_models,
            sources=cached_sources,
        )

    published_ids = set(db.scalars(select(ModelCatalog.id).where(ModelCatalog.enabled.is_(True), ModelCatalog.published.is_(True))).all())
    models = [row | {"compass_model_id": row["provider_model_id"] if row["provider_model_id"] in published_ids else None} for row in cached_models]
    return {
        "models": models,
        "sources": cached_sources,
        "total": len(models),
        "refreshed_at": now().isoformat(),
        "catalog_source": "controlled-litellm-runtime",
        "scope_note": "LiteLLM-maintained provider registry; not a claim that every model on the internet is callable.",
    }


def credential_provider_names(db: Session, team_id: str) -> set[str]:
    byok = set(
        db.scalars(
            select(Provider.name)
            .join(ByokCredential, ByokCredential.provider_id == Provider.id)
            .where(
                ByokCredential.team_id == team_id,
                ByokCredential.status == "active",
                ByokCredential.encrypted_secret.like("encrypted:%") | ByokCredential.encrypted_secret.like("gcp-secret:%"),
            )
        ).all()
    )
    platform = set(
        db.scalars(
            select(Provider.name)
            .join(ProviderCredential, ProviderCredential.provider_id == Provider.id)
            .where(
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.status.in_(["active", "local_test"]),
                (ProviderCredential.secret_reference.like("encrypted:%") | ProviderCredential.secret_reference.like("gcp-secret:%") | ((ProviderCredential.secret_reference.like("server-side/%")) & (ProviderCredential.status == "local_test"))),
            )
        ).all()
    )
    return byok | platform


async def activate_catalog_model(db: Session, team_id: str, model_id: str) -> dict:
    catalog = await litellm_model_catalog(db)
    row = next((item for item in catalog["models"] if item["provider_model_id"] == model_id), None)
    if row is None:
        raise compass_error(404, "model_not_found", "Model is not present in the controlled LiteLLM registry.")
    if row["provider"] not in credential_provider_names(db, team_id):
        raise compass_error(409, "provider_credential_required", "Configure a platform or team provider credential before enabling the model.")

    provider = ensure_provider(db, row["provider"])
    fx = get_settings().usd_to_inr_paise_per_usd
    input_paise = math.ceil((row["input_cost_per_million_usd"] / 1000) * fx)
    output_paise = math.ceil((row["output_cost_per_million_usd"] / 1000) * fx)
    upsert_model(
        db,
        model_id=model_id,
        provider=provider,
        provider_model_id=model_id,
        display_name=row["display_name"],
        capabilities=",".join(row["capabilities"]),
        context_window=row["context_window"] or 128000,
        input_price_paise_per_1k=input_paise,
        output_price_paise_per_1k=output_paise,
    )
    db.flush()
    model = db.get(ModelCatalog, model_id)
    model.supports_tools = "tools" in row["capabilities"]
    model.supports_reasoning = "reasoning" in row["capabilities"]
    model.supports_vision = "vision" in row["capabilities"]
    db.commit()
    return next(item for item in model_catalog_rows(db) if item["id"] == model_id)


def create_team(db: Session, name: str, slug: str, notes: str = "", organization_id: str | None = None) -> Team:
    if db.scalar(select(Team).where(Team.slug == slug)):
        raise compass_error(409, "team_exists", "A team already exists for this slug.")
    team = Team(organization_id=organization_id, name=name, slug=slug, notes=notes)
    db.add(team)
    db.flush()
    settings = get_settings()
    db.add(
        TeamLimit(
            team_id=team.id,
            requests_per_minute=settings.default_team_request_limit_per_minute,
            tokens_per_minute=settings.default_team_token_limit_per_minute,
            daily_spend_limit_paise=settings.default_team_daily_spend_limit_paise,
            monthly_spend_limit_paise=settings.default_team_monthly_spend_limit_paise,
        )
    )
    db.add(WalletAccount(team_id=team.id, balance_paise=0))
    db.commit()
    return team


def create_team_member(db: Session, team_id: str, name: str, email: str, role: str) -> TeamMember:
    team = db.get(Team, team_id)
    if team is None or not team.is_active:
        raise compass_error(404, "team_not_found", "Team not found.")
    if db.scalar(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.email == email.lower())):
        raise compass_error(409, "member_exists", "A member already exists for this team and email.")
    member = TeamMember(team_id=team_id, name=name, email=email.lower(), role=role)
    db.add(member)
    db.commit()
    return member


def create_api_key(db: Session, user_id: str, team_id: str, member_id: str | None, name: str, allowed_models: list[str], expires_at=None) -> dict:
    team = db.get(Team, team_id)
    if team is None or not team.is_active:
        raise compass_error(404, "team_not_found", "Team not found.")
    if member_id is not None:
        member = db.get(TeamMember, member_id)
        if member is None or member.team_id != team_id or not member.is_active:
            raise compass_error(404, "member_not_found", "Team member not found.")
    unique_models = sorted(set(allowed_models))
    for model_id in unique_models:
        model = db.get(ModelCatalog, model_id)
        if model is None or not model.enabled or not model.published:
            raise compass_error(404, "model_not_found", f"Model is not available: {model_id}")
    secret, key_id, key_prefix, key_hash = generate_api_key()
    key = ApiKey(key_id=key_id, key_prefix=key_prefix, key_hash=key_hash, user_id=user_id, team_id=team_id, member_id=member_id, name=name, expires_at=expires_at)
    db.add(key)
    db.flush()
    for model_id in unique_models:
        db.add(ApiKeyModel(api_key_id=key.id, model_id=model_id))
    db.commit()
    effective_models = allowed_model_ids(db, key.id)
    return {"id": key.id, "key": secret, "key_id": key_id, "key_prefix": key_prefix, "name": name, "allowed_models": sorted(effective_models), "models_restricted": bool(unique_models)}


def revoke_api_key(db: Session, api_key_id: str) -> ApiKey:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    key.status = "revoked"
    key.revoked_at = now()
    db.commit()
    return key


def authenticate_api_key(db: Session, bearer: str | None) -> ApiKey:
    if not bearer or not bearer.startswith("Bearer "):
        raise compass_error(401, "missing_api_key", "Missing Compass API key.")
    secret = bearer.removeprefix("Bearer ").strip()
    key = db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(secret)))
    if key is None:
        raise compass_error(401, "invalid_api_key", "Invalid Compass API key.")
    if key.status != "active":
        raise compass_error(401, "revoked_api_key", "Compass API key has been revoked.")
    if key.expires_at is not None and key.expires_at < now():
        raise compass_error(401, "expired_api_key", "Compass API key has expired.")
    if key.team_id is None:
        raise compass_error(401, "invalid_api_key", "Compass API key is not assigned to a team.")
    team = db.get(Team, key.team_id)
    if team is None or not team.is_active:
        raise compass_error(401, "team_disabled", "Compass team is disabled.")
    key.last_used_at = now()
    db.commit()
    return key


def allowed_model_ids(db: Session, api_key_id: str) -> set[str]:
    explicit = set(db.scalars(select(ApiKeyModel.model_id).where(ApiKeyModel.api_key_id == api_key_id)).all())
    if explicit:
        return explicit
    return set(
        db.scalars(
            select(ModelCatalog.id).where(ModelCatalog.enabled.is_(True), ModelCatalog.published.is_(True))
        ).all()
    )


def api_key_models_restricted(db: Session, api_key_id: str) -> bool:
    return db.scalar(select(ApiKeyModel.id).where(ApiKeyModel.api_key_id == api_key_id).limit(1)) is not None


def update_api_key_models(db: Session, api_key_id: str, allowed_models: list[str]) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    unique_models = sorted(set(allowed_models))
    for model_id in unique_models:
        model = db.get(ModelCatalog, model_id)
        if model is None or not model.enabled or not model.published:
            raise compass_error(404, "model_not_found", f"Model is not available: {model_id}")
    db.query(ApiKeyModel).filter(ApiKeyModel.api_key_id == api_key_id).delete(synchronize_session=False)
    for model_id in unique_models:
        db.add(ApiKeyModel(api_key_id=api_key_id, model_id=model_id))
    db.commit()
    return {
        "id": key.id,
        "allowed_models": sorted(allowed_model_ids(db, key.id)),
        "models_restricted": bool(unique_models),
    }


def credit_wallet(db: Session, team_id: str, amount_paise: int, idempotency_key: str, reference_id: str, reference_type: str = "manual_test_credit", description: str = "Controlled beta test wallet credit") -> WalletLedger:
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    if wallet is None:
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
    existing = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if existing:
        return existing
    before = wallet.balance_paise
    wallet.balance_paise += amount_paise
    wallet.updated_at = now()
    ledger = WalletLedger(wallet_id=wallet.id, type="credit", amount_paise=amount_paise, balance_before=before, balance_after=wallet.balance_paise, reference_type=reference_type, reference_id=reference_id, description=description, idempotency_key=idempotency_key)
    db.add(ledger)
    db.commit()
    return ledger


def debit_wallet(db: Session, team_id: str, amount_paise: int, idempotency_key: str, reference_id: str) -> WalletLedger:
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    existing = None if wallet is None else db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if existing:
        return existing
    if wallet is None or wallet.balance_paise < amount_paise:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    before = wallet.balance_paise
    wallet.balance_paise -= amount_paise
    wallet.updated_at = now()
    ledger = WalletLedger(wallet_id=wallet.id, type="debit", amount_paise=-amount_paise, balance_before=before, balance_after=wallet.balance_paise, reference_type="llm_request", reference_id=reference_id, description="Compass API usage charge", idempotency_key=idempotency_key)
    db.add(ledger)
    db.commit()
    return ledger


@dataclass
class ResolvedRoute:
    model: ModelCatalog
    provider: Provider
    credential_mode: str
    secret_reference: str
    resolved_model_id: str


def _circuit_is_open(db: Session, provider_id: str) -> bool:
    latest = db.scalar(
        select(ProviderHealthCheck)
        .where(ProviderHealthCheck.provider_id == provider_id)
        .order_by(ProviderHealthCheck.last_checked_at.desc())
        .limit(1)
    )
    if latest is None or latest.status != "circuit_open":
        return False
    return latest.last_checked_at >= now() - timedelta(seconds=30)


def record_provider_health(db: Session, provider: Provider, *, success: bool, latency_ms: int, error_code: str | None = None) -> None:
    recent = db.scalars(
        select(ProviderHealthCheck)
        .where(ProviderHealthCheck.provider_id == provider.id)
        .order_by(ProviderHealthCheck.last_checked_at.desc())
        .limit(2)
    ).all()
    consecutive_failures = 0 if success else 1
    if not success:
        consecutive_failures += sum(1 for row in recent if row.status != "healthy")
    status = "healthy" if success else ("circuit_open" if consecutive_failures >= 3 else "degraded")
    db.add(ProviderHealthCheck(provider_id=provider.id, status=status, latency_ms=latency_ms, error_rate=0 if success else 100))
    if status == "circuit_open":
        db.add(OperationalEvent(event_type="provider_circuit_open", severity="critical", service="compass-router", message=f"Provider circuit opened for {provider.name}", metadata_json=json.dumps({"provider": provider.name, "error_code": error_code, "latency_ms": latency_ms})))
    if provider.status not in {"disabled", "unavailable"}:
        provider.status = "healthy" if success else "degraded"


def _model_supports(model: ModelCatalog, capability: str | None) -> bool:
    if capability is None:
        return True
    capabilities = {item.strip().lower() for item in model.capabilities.split(",") if item.strip()}
    aliases = {
        "responses": {"responses", "chat"},
        "chat": {"chat"},
        "embeddings": {"embeddings", "embedding"},
        "images": {"images", "image", "image_generation"},
        "audio": {"audio", "audio-input", "audio-output", "audio_transcription", "audio_speech"},
        "batch": {"batch", "chat", "embeddings"},
    }
    return bool(capabilities & aliases.get(capability, {capability}))


def resolve_route(db: Session, api_key: ApiKey, requested_model: str, capability: str | None = None) -> ResolvedRoute:
    model = db.get(ModelCatalog, requested_model)
    if model is None or not model.enabled or not model.published:
        raise compass_error(404, "model_not_found", "Requested model is not available.")
    if model.status in {"expired", "deprecated"}:
        raise compass_error(410, "model_expired", "Requested model has expired or been deprecated.")
    if model.status != "available":
        raise compass_error(503, "model_unavailable", "Requested model is temporarily unavailable.")
    if not _model_supports(model, capability):
        raise compass_error(400, "model_capability_mismatch", f"Model does not support the {capability} API.")
    if requested_model not in allowed_model_ids(db, api_key.id):
        raise compass_error(403, "model_not_allowed", "This Compass API key is not allowed to use the requested model.")
    policy = db.scalar(select(ModelPolicy).where(ModelPolicy.team_id == api_key.team_id, ModelPolicy.model_id == model.id))
    if policy is not None and not policy.enabled:
        raise compass_error(403, "model_disabled_for_team", "This model is disabled for the team.")
    provider = model.provider
    if not provider.enabled or provider.status in {"disabled", "unavailable"}:
        raise compass_error(503, "provider_unavailable", "Resolved provider is disabled.")
    if _circuit_is_open(db, provider.id):
        raise compass_error(503, "provider_circuit_open", "Provider circuit breaker is open; retry after the cooldown.")
    settings = get_settings()
    if settings.local_test_mode and model.provider_model_id == "local-test-chat":
        return ResolvedRoute(model, provider, "local_test", "local-test", model.provider_model_id)
    byok = db.scalar(
        select(ByokCredential).where(
            ByokCredential.team_id == api_key.team_id,
            ByokCredential.provider_id == provider.id,
            ByokCredential.status == "active",
        )
    )
    if byok is not None and byok.encrypted_secret.startswith(("encrypted:", "gcp-secret:")):
        return ResolvedRoute(model, provider, "byok", byok.encrypted_secret, requested_model)
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.status.in_(["active", "local_test"]),
        )
    )
    if credential is None or not _has_usable_reference(credential.secret_reference):
        raise compass_error(503, "provider_unavailable", "No usable provider credential is configured.")
    return ResolvedRoute(model, provider, credential.credential_mode, credential.secret_reference, model.provider_model_id)


def route_candidates(db: Session, api_key: ApiKey, requested_model: str, capability: str | None = None) -> list[ResolvedRoute]:
    """Resolve the requested model and its configured fallback chain without loops."""
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == requested_model))
    if policy is not None:
        if not policy.enabled:
            raise compass_error(503, "routing_policy_disabled", "The requested routing policy is disabled.")
        candidates: list[ResolvedRoute] = []
        first_error: HTTPException | None = None
        for model_id in [item.strip() for item in policy.candidate_models.split(",") if item.strip()]:
            try:
                candidates.append(resolve_route(db, api_key, model_id, capability))
            except HTTPException as exc:
                first_error = first_error or exc
        if candidates:
            return candidates
        raise first_error or compass_error(503, "routing_policy_unavailable", "No model in the routing policy is currently available.")
    candidates: list[ResolvedRoute] = []
    visited: set[str] = set()
    model_id: str | None = requested_model
    fallback_attempted = False
    first_error: HTTPException | None = None
    while model_id and model_id not in visited and len(candidates) < 8:
        visited.add(model_id)
        try:
            route = resolve_route(db, api_key, model_id, capability)
        except HTTPException as exc:
            if first_error is None:
                first_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            model = db.get(ModelCatalog, model_id)
            fallback = model.fallback_model_id if model else None
            if not candidates and fallback and not fallback_attempted and error_code in {"provider_circuit_open", "provider_unavailable", "model_unavailable", "model_capability_mismatch"}:
                fallback_attempted = True
                model_id = fallback
                continue
            if candidates:
                break
            raise first_error or exc
        candidates.append(route)
        model_id = route.model.fallback_model_id
    return candidates


def check_redis(redis_url: str) -> dict:
    parsed = urlparse(redis_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    with socket.create_connection((host, port), timeout=3) as sock:
        sock.sendall(b"*1\r\n$4\r\nPING\r\n")
        data = sock.recv(64)
    if not data.startswith(b"+PONG"):
        raise RuntimeError("Redis PING did not return PONG")
    return {"status": "ok", "host": host, "port": port}


def _redis_resp(*parts: str) -> bytes:
    encoded = [f"*{len(parts)}\r\n".encode()]
    for part in parts:
        value = str(part).encode()
        encoded.extend([f"${len(value)}\r\n".encode(), value, b"\r\n"])
    return b"".join(encoded)


def redis_team_rate_limit(redis_url: str, team_id: str, estimated_tokens: int, request_limit: int, token_limit: int) -> tuple[bool, str | None]:
    """Atomically reserve a request and token slot in Redis when available."""
    parsed = urlparse(redis_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    key_suffix = str(int(time.time() // 60))
    request_key = f"compass:limit:{team_id}:requests:{key_suffix}"
    token_key = f"compass:limit:{team_id}:tokens:{key_suffix}"
    script = """
local requests = redis.call('INCR', KEYS[1])
if requests == 1 then redis.call('EXPIRE', KEYS[1], 61) end
local tokens = redis.call('INCRBY', KEYS[2], ARGV[3])
if tokens == tonumber(ARGV[3]) then redis.call('EXPIRE', KEYS[2], 61) end
local reason = 0
if requests > tonumber(ARGV[1]) then reason = 1 end
if tokens > tonumber(ARGV[2]) then reason = 2 end
return {reason, requests, tokens}
"""
    with socket.create_connection((host, port), timeout=1.5) as sock:
        sock.sendall(_redis_resp("EVAL", script, "2", request_key, token_key, str(request_limit), str(token_limit), str(max(estimated_tokens, 0))))
        data = sock.recv(512)
    if not data.startswith(b"*"):
        raise RuntimeError("Redis rate limit command failed")
    values = [int(part) for part in re.findall(rb":(-?\d+)", data)]
    if len(values) < 3:
        raise RuntimeError("Redis rate limit response was invalid")
    reason = values[0]
    return reason == 0, {1: "rate_limit_exceeded", 2: "token_limit_exceeded"}.get(reason)


def calculate_cost_paise(model: ModelCatalog, usage: dict) -> tuple[int, int]:
    input_tokens = int(usage.get("prompt_tokens", 0))
    output_tokens = int(usage.get("completion_tokens", 0))
    provider_cost = ((input_tokens * model.input_price_paise_per_1k) + (output_tokens * model.output_price_paise_per_1k) + 999) // 1000
    return provider_cost, max(provider_cost, 1)


def estimate_prompt_tokens(body: dict) -> int:
    return sum(len(str(message.get("content", "")).split()) for message in body.get("messages", []))


def estimate_max_cost_paise(model: ModelCatalog, body: dict) -> int:
    return calculate_cost_paise(model, {"prompt_tokens": estimate_prompt_tokens(body), "completion_tokens": int(body.get("max_tokens") or 256)})[1]


def enforce_team_limits(db: Session, team_id: str, estimated_tokens: int) -> None:
    limits = db.scalar(select(TeamLimit).where(TeamLimit.team_id == team_id))
    if limits is None:
        return
    settings = get_settings()
    redis_enforced = False
    if settings.redis_rate_limit_enabled:
        try:
            allowed, reason = redis_team_rate_limit(settings.redis_url, team_id, estimated_tokens, limits.requests_per_minute, limits.tokens_per_minute)
            if not allowed and reason == "rate_limit_exceeded":
                raise compass_error(429, reason, "Team request rate limit exceeded.")
            if not allowed and reason == "token_limit_exceeded":
                raise compass_error(429, reason, "Team token rate limit exceeded.")
            redis_enforced = True
        except HTTPException:
            raise
        except (OSError, RuntimeError, ValueError):
            # Local development may not have Redis; retain the database fallback.
            pass
    if not redis_enforced:
        since = now() - timedelta(minutes=1)
        minute_requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= since)) or 0
        minute_tokens = db.scalar(select(func.coalesce(func.sum(LlmRequest.total_tokens), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= since)) or 0
        if minute_requests >= limits.requests_per_minute:
            raise compass_error(429, "rate_limit_exceeded", "Team request rate limit exceeded.")
        if minute_tokens + estimated_tokens > limits.tokens_per_minute:
            raise compass_error(429, "token_limit_exceeded", "Team token rate limit exceeded.")
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    daily_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
    if limits.daily_spend_limit_paise > 0 and daily_spend >= limits.daily_spend_limit_paise:
        raise compass_error(429, "team_daily_spend_limit_exceeded", "Team daily spending limit exceeded.")
    monthly_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
    if limits.monthly_spend_limit_paise > 0 and monthly_spend >= limits.monthly_spend_limit_paise:
        raise compass_error(429, "team_monthly_spend_limit_exceeded", "Team monthly spending limit exceeded.")


def enforce_api_key_limits(db: Session, api_key: ApiKey, estimated_cost_paise: int) -> None:
    """Apply the key-level request and spend limits before provider work starts."""
    minute_ago = now() - timedelta(minutes=1)
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    minute_requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= minute_ago)) or 0
    if api_key.rate_limit > 0 and minute_requests >= api_key.rate_limit:
        raise compass_error(429, "api_key_rate_limit_exceeded", "API key request rate limit exceeded.")
    daily_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
    if api_key.daily_limit > 0 and daily_spend + estimated_cost_paise > api_key.daily_limit:
        raise compass_error(429, "api_key_daily_limit_exceeded", "API key daily spending limit exceeded.")
    monthly_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
    if api_key.monthly_limit > 0 and monthly_spend + estimated_cost_paise > api_key.monthly_limit:
        raise compass_error(429, "api_key_monthly_limit_exceeded", "API key monthly spending limit exceeded.")


def validate_openai_response(data: dict) -> None:
    if not isinstance(data, dict):
        raise compass_error(502, "malformed_provider_response", "Provider response was not an object.")
    if not data.get("id") or data.get("object") != "chat.completion":
        raise compass_error(502, "malformed_provider_response", "Provider response was not OpenAI-compatible.")
    choices = data.get("choices")
    usage = data.get("usage")
    if not isinstance(choices, list) or not choices or not isinstance(usage, dict):
        raise compass_error(502, "malformed_provider_response", "Provider response was missing choices or usage.")
    for field in ("prompt_tokens", "completion_tokens", "total_tokens"):
        if field not in usage:
            raise compass_error(502, "malformed_provider_response", f"Provider response usage missing {field}.")


class LiteLLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def base_url(self) -> str:
        return (self.settings.compass_litellm_url or self.settings.litellm_url).rstrip("/")

    async def request_json(self, endpoint: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", json=payload, headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"})
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            data = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(data, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return data

    async def request_bytes(self, endpoint: str, payload: dict) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", json=payload, headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"})
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        return response.content, response.headers.get("content-type", "application/octet-stream")

    async def request_multipart(self, endpoint: str, data: dict, file: tuple[str, bytes, str]) -> dict:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    data=data,
                    files={"file": file},
                    headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"},
                )
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            payload = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(payload, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return payload

    async def chat_completion(self, payload: dict) -> dict:
        data = await self.request_json("/v1/chat/completions", payload)
        validate_openai_response(data)
        return data

    async def health_check(self) -> dict:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{self.base_url}/health/liveliness")
        if response.status_code >= 400:
            raise compass_error(503, "litellm_unavailable", "LiteLLM health check failed.")
        data = response.json()
        if isinstance(data, dict):
            return data
        return {"status": "ok", "detail": data}


def _native_provider_model(provider_name: str, model_id: str) -> str:
    prefix = f"{provider_name}/"
    return model_id.removeprefix(prefix)


def _provider_key(secret_reference: str) -> str:
    if not secret_reference.startswith(("encrypted:", "gcp-secret:")):
        raise compass_error(503, "provider_credential_invalid", "Provider credential is not configured for real execution.")
    return _credential_value(secret_reference)


class DirectProviderClient:
    """Execute through provider APIs when the deployment is not using the proxy runtime."""

    def __init__(self, provider_name: str, secret_reference: str, model_id: str) -> None:
        self.provider_name = provider_name
        self.api_key = _provider_key(secret_reference)
        self.model_id = _native_provider_model(provider_name, model_id)
        self.timeout = get_settings().litellm_timeout_seconds

    @property
    def base_url(self) -> str:
        return {
            "openai": "https://api.openai.com/v1",
            "ollama_cloud": "https://ollama.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
        }.get(self.provider_name, "")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    @staticmethod
    def _text_parts(content: object) -> list[dict]:
        if isinstance(content, str):
            return [{"text": content}]
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append({"text": item})
                elif isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append({"text": item["text"]})
            return parts
        return [{"text": str(content)}]

    def _gemini_payload(self, payload: dict) -> dict:
        contents: list[dict] = []
        system_parts: list[dict] = []
        for message in payload.get("messages", []):
            role = str(message.get("role", "user"))
            parts = self._text_parts(message.get("content"))
            if role in {"system", "developer"}:
                system_parts.extend(parts)
                continue
            contents.append({"role": "model" if role == "assistant" else "user", "parts": parts})
        generation_config = {}
        if payload.get("temperature") is not None:
            generation_config["temperature"] = payload["temperature"]
        if payload.get("max_tokens") is not None:
            generation_config["maxOutputTokens"] = payload["max_tokens"]
        result = {"contents": contents}
        if system_parts:
            result["systemInstruction"] = {"parts": system_parts}
        if generation_config:
            result["generationConfig"] = generation_config
        return result

    def _gemini_response(self, data: dict) -> dict:
        candidates = data.get("candidates") or []
        if not candidates:
            raise compass_error(502, "malformed_provider_response", "Gemini returned no candidates.")
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        content = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))
        usage = data.get("usageMetadata") or {}
        return {
            "id": f"gemini-{time.time_ns()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": self.model_id,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": int(usage.get("promptTokenCount", 0)),
                "completion_tokens": int(usage.get("candidatesTokenCount", 0)),
                "total_tokens": int(usage.get("totalTokenCount", 0)),
            },
        }

    async def request_json(self, endpoint: str, payload: dict) -> dict:
        if self.provider_name == "gemini":
            if endpoint not in {"/v1/chat/completions", "/v1/responses"}:
                raise compass_error(400, "provider_capability_unsupported", "This Gemini adapter does not support that endpoint yet.")
            messages = payload.get("messages")
            if messages is None:
                input_value = payload.get("input", "")
                messages = [{"role": "user", "content": input_value}]
            gemini_payload = self._gemini_payload(payload | {"messages": messages})
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_id}:generateContent"
            headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
            response_model = self._gemini_response
        else:
            url = f"{self.base_url}{endpoint}"
            headers = self._headers()
            gemini_payload = payload | {"model": self.model_id}
            response_model = lambda data: data
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=gemini_payload, headers=headers)
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code in {401, 403}:
            raise compass_error(502, "provider_auth_failed", "Provider rejected the configured credential.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            data = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(data, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return response_model(data)

    async def chat_completion(self, payload: dict) -> dict:
        data = await self.request_json("/v1/chat/completions", payload)
        validate_openai_response(data)
        return data


def provider_client(route: ResolvedRoute):
    settings = get_settings()
    mode = settings.provider_execution_mode.strip().lower()
    if mode == "proxy" or (mode == "auto" and settings.local_test_mode):
        return LiteLLMClient()
    if mode not in {"auto", "direct"}:
        raise compass_error(503, "provider_execution_unavailable", "Provider execution mode is invalid.")
    return DirectProviderClient(route.provider.name, route.secret_reference, route.resolved_model_id)


def create_request_record(db: Session, api_key: ApiKey, route: ResolvedRoute, requested_model: str, status: str, latency_ms: int, error_code: str | None = None, attempts: list[dict] | None = None) -> LlmRequest:
    record = LlmRequest(user_id=api_key.user_id, organization_id=api_key.organization_id, team_id=api_key.team_id, member_id=api_key.member_id, api_key_id=api_key.id, requested_model=requested_model, resolved_model=route.resolved_model_id, provider=route.provider.name, credential_mode=route.credential_mode, status=status, error_code=error_code, latency_ms=latency_ms)
    db.add(record)
    db.flush()
    attempt_rows = attempts or [{"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": status, "error_code": error_code, "latency_ms": latency_ms}]
    for attempt in attempt_rows:
        db.add(ProviderAttempt(request_id=record.id, **attempt))
    db.flush()
    return record


async def complete_chat(db: Session, api_key: ApiKey, body: dict) -> dict:
    routes = route_candidates(db, api_key, body["model"])
    route = routes[0]
    estimated_tokens = estimate_prompt_tokens(body) + int(body.get("max_tokens") or 256)
    enforce_team_limits(db, api_key.team_id, estimated_tokens)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    estimated_cost = max(estimate_max_cost_paise(candidate.model, body) for candidate in routes)
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if wallet is None or wallet.balance_paise < estimated_cost:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    max_attempts = max(1, min(get_settings().provider_max_attempts, 5))
    for route in routes:
        for attempt_number in range(max_attempts):
            attempt_started = time.perf_counter()
            try:
                provider_payload = body | {"model": route.resolved_model_id, "stream": False}
                if route.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                    provider_payload["api_key"] = _credential_value(route.secret_reference)
                candidate_response = await LiteLLMClient().chat_completion(provider_payload)
                validate_openai_response(candidate_response)
                response = candidate_response
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, route.provider, success=True, latency_ms=attempt_latency)
                attempt_rows.append({"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
                break
            except HTTPException as exc:
                last_error = exc
                error_code = "provider_error"
                if isinstance(exc.detail, dict):
                    error_code = exc.detail.get("error", {}).get("code", error_code)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, route.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
                attempt_rows.append({"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
                if error_code not in retryable or attempt_number + 1 >= max_attempts:
                    break
                await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
        if response is not None:
            break
    if response is None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = response.get("usage", {})
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = int(usage.get("prompt_tokens", 0))
    record.output_tokens = int(usage.get("completion_tokens", 0))
    record.total_tokens = int(usage.get("total_tokens", 0))
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    debit_wallet(db, api_key.team_id, compass_cost, f"llm:{record.id}", record.id)
    response["model"] = body["model"]
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


def _generic_usage(response: dict) -> dict:
    usage = response.get("usage") if isinstance(response.get("usage"), dict) else {}
    input_tokens = int(usage.get("prompt_tokens", usage.get("input_tokens", 0)) or 0)
    output_tokens = int(usage.get("completion_tokens", usage.get("output_tokens", 0)) or 0)
    total_tokens = int(usage.get("total_tokens", input_tokens + output_tokens) or 0)
    return {"prompt_tokens": input_tokens, "completion_tokens": output_tokens, "total_tokens": total_tokens}


def _estimate_generic_tokens(body: dict) -> int:
    if isinstance(body.get("messages"), list):
        return estimate_prompt_tokens(body)
    value = body.get("input") or body.get("prompt") or ""
    if isinstance(value, list):
        value = " ".join(str(item) for item in value)
    return max(1, len(str(value).split()))


async def complete_json_api(db: Session, api_key: ApiKey, body: dict, endpoint: str, capability: str) -> dict:
    """Execute non-chat OpenAI-compatible APIs through the same Compass controls."""
    routes = route_candidates(db, api_key, body["model"], capability)
    route = routes[0]
    estimated_tokens = _estimate_generic_tokens(body) + int(body.get("max_tokens") or body.get("max_output_tokens") or 256)
    enforce_team_limits(db, api_key.team_id, estimated_tokens)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    estimated_cost = max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": str(body.get("input") or body.get("prompt") or "")}], "max_tokens": 256}) for candidate in routes)
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if wallet is None or wallet.balance_paise < estimated_cost:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")

    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    max_attempts = max(1, min(get_settings().provider_max_attempts, 5))
    for candidate in routes:
        for attempt_number in range(max_attempts):
            attempt_started = time.perf_counter()
            try:
                provider_payload = body | {"model": candidate.resolved_model_id}
                if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                    provider_payload["api_key"] = _credential_value(candidate.secret_reference)
                response = await LiteLLMClient().request_json(endpoint, provider_payload)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
                attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
                route = candidate
                break
            except HTTPException as exc:
                last_error = exc
                error_code = "provider_error"
                if isinstance(exc.detail, dict):
                    error_code = exc.detail.get("error", {}).get("code", error_code)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
                attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
                if error_code not in retryable or attempt_number + 1 >= max_attempts:
                    break
                await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
        if response is not None:
            break

    latency_ms = int((time.perf_counter() - started) * 1000)
    if response is None:
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    usage = _generic_usage(response)
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = usage["prompt_tokens"]
    record.output_tokens = usage["completion_tokens"]
    record.total_tokens = usage["total_tokens"]
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    if compass_cost:
        debit_wallet(db, api_key.team_id, compass_cost, f"llm:{record.id}", record.id)
    response.setdefault("model", body["model"])
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


async def complete_binary_api(db: Session, api_key: ApiKey, body: dict, endpoint: str, capability: str) -> tuple[bytes, str]:
    routes = route_candidates(db, api_key, body["model"], capability)
    route = routes[0]
    estimated_tokens = _estimate_generic_tokens(body)
    enforce_team_limits(db, api_key.team_id, estimated_tokens)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    estimated_cost = max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": str(body.get("input") or "")}], "max_tokens": 256}) for candidate in routes)
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if wallet is None or wallet.balance_paise < estimated_cost:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")

    started = time.perf_counter()
    last_error: HTTPException | None = None
    audio: bytes | None = None
    content_type = "application/octet-stream"
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    for candidate in routes:
        try:
            provider_payload = body | {"model": candidate.resolved_model_id}
            if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                provider_payload["api_key"] = _credential_value(candidate.secret_reference)
            audio, content_type = await LiteLLMClient().request_bytes(endpoint, provider_payload)
            route = candidate
            attempt_latency = int((time.perf_counter() - started) * 1000)
            record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
            break
        except HTTPException as exc:
            last_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            attempt_latency = int((time.perf_counter() - started) * 1000)
            record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
            if error_code not in retryable:
                break
    if audio is None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    latency_ms = int((time.perf_counter() - started) * 1000)
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.compass_cost_paise = estimated_cost
    db.flush()
    debit_wallet(db, api_key.team_id, estimated_cost, f"llm:{record.id}", record.id)
    return audio, content_type


async def complete_multipart_api(db: Session, api_key: ApiKey, model_id: str, form_data: dict, file: tuple[str, bytes, str], endpoint: str, capability: str) -> dict:
    routes = route_candidates(db, api_key, model_id, capability)
    route = routes[0]
    estimated_tokens = max(1, len(file[1]) // 4_000)
    enforce_team_limits(db, api_key.team_id, estimated_tokens)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    estimated_cost = max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": "audio transcription"}], "max_tokens": 256}) for candidate in routes)
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if wallet is None or wallet.balance_paise < estimated_cost:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")

    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    for candidate in routes:
        attempt_started = time.perf_counter()
        try:
            provider_data = form_data | {"model": candidate.resolved_model_id}
            if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                provider_data["api_key"] = _credential_value(candidate.secret_reference)
            response = await LiteLLMClient().request_multipart(endpoint, provider_data, file)
            route = candidate
            attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
            record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
            break
        except HTTPException as exc:
            last_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
            record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
            if error_code not in retryable:
                break
    latency_ms = int((time.perf_counter() - started) * 1000)
    if response is None:
        create_request_record(db, api_key, route, model_id, "error", latency_ms, "provider_error", attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    usage = _generic_usage(response)
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    record = create_request_record(db, api_key, route, model_id, "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = usage["prompt_tokens"]
    record.output_tokens = usage["completion_tokens"]
    record.total_tokens = usage["total_tokens"]
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    if compass_cost:
        debit_wallet(db, api_key.team_id, compass_cost, f"llm:{record.id}", record.id)
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


def _response_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for part in value:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                text = part.get("text") or part.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


def stream_openai_chunks(full_response: dict):
    choice = (full_response.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    text_parts = []
    for value in (message.get("content"), message.get("reasoning_content"), choice.get("text")):
        text = _response_text(value)
        if text and text not in text_parts:
            text_parts.append(text)
    content = "\n".join(text_parts)
    tool_calls = message.get("tool_calls") or []
    chunk_id = full_response["id"]
    model = full_response["model"]
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}]})}\n\n"
    if content:
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {'content': content}, 'finish_reason': None}]})}\n\n"
    for index, call in enumerate(tool_calls):
        function = call.get("function") or {}
        arguments = function.get("arguments", "")
        if not isinstance(arguments, str):
            arguments = json.dumps(arguments)
        delta = {
            "tool_calls": [{
                "index": index,
                "id": call.get("id") or f"call_{index}",
                "type": call.get("type", "function"),
                "function": {"name": function.get("name", ""), "arguments": arguments},
            }]
        }
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]})}\n\n"
    finish_reason = "tool_calls" if tool_calls else "stop"
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish_reason}], 'usage': full_response.get('usage'), 'compass': full_response.get('compass')})}\n\n"
    yield "data: [DONE]\n\n"


def model_catalog_rows(db: Session, include_unpublished: bool = False) -> list[dict]:
    stmt = select(ModelCatalog).order_by(ModelCatalog.id)
    if not include_unpublished:
        stmt = stmt.where(ModelCatalog.enabled.is_(True), ModelCatalog.published.is_(True))
    rows = db.scalars(stmt).all()
    return [{"id": row.id, "display_name": row.display_name, "provider": row.provider.name, "provider_model_id": row.provider_model_id, "capabilities": row.capabilities.split(","), "context_window": row.context_window, "input_price_paise_per_1k": row.input_price_paise_per_1k, "output_price_paise_per_1k": row.output_price_paise_per_1k, "supports_streaming": row.supports_streaming, "supports_tools": row.supports_tools, "supports_reasoning": row.supports_reasoning, "supports_vision": row.supports_vision, "fallback_model_id": row.fallback_model_id, "enabled": row.enabled, "published": row.published, "status": row.status, "provider_status": row.provider.status, "provider_enabled": row.provider.enabled} for row in rows]


def model_policy_rows(db: Session, team_id: str) -> list[dict]:
    policies = {policy.model_id: policy for policy in db.scalars(select(ModelPolicy).where(ModelPolicy.team_id == team_id)).all()}
    models = db.scalars(select(ModelCatalog).where(ModelCatalog.published.is_(True)).order_by(ModelCatalog.id)).all()
    return [{"id": policies.get(model.id).id if model.id in policies else None, "team_id": team_id, "model_id": model.id, "enabled": policies[model.id].enabled if model.id in policies else True, "requests_per_minute": policies[model.id].requests_per_minute if model.id in policies else 0, "daily_spend_limit_paise": policies[model.id].daily_spend_limit_paise if model.id in policies else 0, "monthly_spend_limit_paise": policies[model.id].monthly_spend_limit_paise if model.id in policies else 0, "updated_at": policies[model.id].updated_at.isoformat() if model.id in policies else None} for model in models]


def enforce_model_policy(db: Session, api_key: ApiKey, model_id: str, estimated_cost_paise: int) -> None:
    policy = db.scalar(select(ModelPolicy).where(ModelPolicy.team_id == api_key.team_id, ModelPolicy.model_id == model_id))
    if policy is None:
        return
    if not policy.enabled:
        raise compass_error(403, "model_disabled_for_team", "This model is disabled for the team.")
    minute_ago = now() - timedelta(minutes=1)
    if policy.requests_per_minute > 0:
        requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= minute_ago)) or 0
        if requests >= policy.requests_per_minute:
            raise compass_error(429, "model_rate_limit_exceeded", "Model request rate limit exceeded for this team.")
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    if policy.daily_spend_limit_paise > 0:
        daily = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
        if daily + estimated_cost_paise > policy.daily_spend_limit_paise:
            raise compass_error(429, "model_daily_spend_limit_exceeded", "Model daily spending limit exceeded for this team.")
    month_start = day_start.replace(day=1)
    if policy.monthly_spend_limit_paise > 0:
        monthly = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
        if monthly + estimated_cost_paise > policy.monthly_spend_limit_paise:
            raise compass_error(429, "model_monthly_spend_limit_exceeded", "Model monthly spending limit exceeded for this team.")


def list_api_keys(db: Session, team_id: str | None = None, team_ids: list[str] | None = None, user_id: str | None = None) -> list[dict]:
    if team_ids is not None and not team_ids:
        return []
    stmt = select(ApiKey).order_by(ApiKey.created_at.desc())
    if team_id:
        stmt = stmt.where(ApiKey.team_id == team_id)
    if team_ids is not None:
        stmt = stmt.where(ApiKey.team_id.in_(team_ids))
    if user_id:
        stmt = stmt.where(ApiKey.user_id == user_id)
    keys = db.scalars(stmt).all()
    if not keys:
        return []
    key_ids = [key.id for key in keys]
    usage_rows = db.execute(
        select(
            LlmRequest.api_key_id,
            func.count(LlmRequest.id),
            func.coalesce(func.sum(LlmRequest.total_tokens), 0),
            func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0),
        )
        .where(LlmRequest.api_key_id.in_(key_ids), LlmRequest.status == "success")
        .group_by(LlmRequest.api_key_id)
    ).all()
    usage = {row[0]: {"requests": row[1], "tokens": row[2], "spend_paise": row[3]} for row in usage_rows}
    return [{"id": key.id, "team_id": key.team_id, "member_id": key.member_id, "name": key.name, "key": f"{key.key_prefix}...", "status": key.status, "created_at": key.created_at.isoformat(), "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None, "expires_at": key.expires_at.isoformat() if key.expires_at else None, "allowed_models": sorted(allowed_model_ids(db, key.id)), "models_restricted": api_key_models_restricted(db, key.id), "rate_limit": key.rate_limit, "daily_limit_paise": key.daily_limit, "monthly_limit_paise": key.monthly_limit, "usage": usage.get(key.id, {"requests": 0, "tokens": 0, "spend_paise": 0})} for key in keys]


def request_rows(rows: list[LlmRequest]) -> list[dict]:
    return [{"id": row.id, "team_id": row.team_id, "member_id": row.member_id, "api_key_id": row.api_key_id, "status": row.status, "error_code": row.error_code, "model": row.requested_model, "provider": row.provider, "tokens": row.total_tokens, "input_tokens": row.input_tokens, "output_tokens": row.output_tokens, "cost_paise": row.compass_cost_paise, "latency_ms": row.latency_ms, "created_at": row.created_at.isoformat()} for row in rows]


def dashboard_summary(db: Session, team_ids: list[str] | None = None, user_id: str | None = None, workspace_ids: list[str] | None = None) -> dict:
    if team_ids is not None and not team_ids:
        teams = []
        requests = []
        wallets = {}
    else:
        team_stmt = select(Team).order_by(Team.created_at.desc())
        request_stmt = select(LlmRequest).order_by(LlmRequest.created_at.desc()).limit(20)
        wallet_stmt = select(WalletAccount).where(WalletAccount.team_id.is_not(None))
        if team_ids is not None:
            team_stmt = team_stmt.where(Team.id.in_(team_ids))
            request_stmt = request_stmt.where(LlmRequest.team_id.in_(team_ids))
            wallet_stmt = wallet_stmt.where(WalletAccount.team_id.in_(team_ids))
        if user_id:
            request_stmt = request_stmt.where(LlmRequest.user_id == user_id)
        teams = db.scalars(team_stmt).all()
        requests = db.scalars(request_stmt).all()
        wallets = {wallet.team_id: wallet for wallet in db.scalars(wallet_stmt).all()}
    total_spend = sum(row.compass_cost_paise for row in requests if row.status == "success")
    total_tokens = sum(row.total_tokens for row in requests)
    if workspace_ids is None:
        workspace_ids = list(db.scalars(select(Organization.id)).all()) if team_ids is None else list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user_id)).all()) if user_id else []
    workspaces = db.scalars(select(Organization).where(Organization.id.in_(workspace_ids)).order_by(Organization.created_at.desc())).all() if workspace_ids else []
    team_counts = dict(db.execute(select(Team.organization_id, func.count(Team.id)).where(Team.organization_id.in_(workspace_ids)).group_by(Team.organization_id)).all()) if workspace_ids else {}
    return {
        "mode": "LOCAL TEST MODE",
        "workspaces": [{"id": workspace.id, "name": workspace.name, "team_count": team_counts.get(workspace.id, 0), "created_at": workspace.created_at.isoformat()} for workspace in workspaces],
        "teams": [{"id": team.id, "name": team.name, "slug": team.slug, "is_active": team.is_active, "wallet": {"currency": wallets.get(team.id).currency if wallets.get(team.id) else "INR", "balance_paise": wallets.get(team.id).balance_paise if wallets.get(team.id) else 0}} for team in teams],
        "api_keys": list_api_keys(db, team_ids=team_ids, user_id=user_id),
        "models": model_catalog_rows(db),
        "usage": {"requests": len(requests), "tokens": total_tokens, "spend_paise": total_spend},
        "recent_requests": request_rows(requests),
    }
