"""Durable FX quote activation and Redis acceleration for managed pricing."""

from datetime import UTC, datetime, timedelta, time
from decimal import Decimal, ROUND_CEILING
import json
import secrets

from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .errors import compass_error
from .fx import FawazAdapter, FrankfurterAdapter, FxProviderError, FxRateQuote, quotes_diverge, quote_is_fresh
from .models import FxRateQuoteRecord, PricingPolicy, now
from .services import _redis_client


FX_CACHE_KEY = "compass:fx:v1:usd-inr:active"
FX_LOCK_KEY = "compass:fx:v1:usd-inr:refresh-lock"


def _settings_quote(quote: FxRateQuote) -> dict:
    return {"base_currency": quote.base_currency, "quote_currency": quote.quote_currency, "rate": str(quote.rate), "provider": quote.provider, "publication_date": quote.publication_date.isoformat(), "retrieved_at": quote.retrieved_at.isoformat(), "source_reference": quote.source_reference, "validation_status": quote.validation_status}


def _record_row(row: FxRateQuoteRecord) -> dict:
    return {"id": row.id, "base_currency": row.base_currency, "quote_currency": row.quote_currency, "rate": str(row.rate), "provider": row.provider, "publication_date": row.publication_date.isoformat(), "retrieved_at": row.retrieved_at.isoformat(), "approved_at": row.approved_at.isoformat() if row.approved_at else None, "validation_status": row.validation_status, "source_reference": row.source_reference, "failure_reason": row.failure_reason}


def active_fx_quote(db: Session, *, require_fresh: bool = True) -> FxRateQuoteRecord | None:
    row = db.scalar(select(FxRateQuoteRecord).where(FxRateQuoteRecord.validation_status == "approved").order_by(FxRateQuoteRecord.approved_at.desc()).limit(1))
    if row and require_fresh:
        age = (datetime.now(UTC).replace(tzinfo=None) - row.publication_date).total_seconds()
        if age > get_settings().fx_max_quote_age_seconds:
            return None
    return row


def _cache_quote(row: FxRateQuoteRecord) -> None:
    client = _redis_client(get_settings().redis_url)
    try:
        client.set(FX_CACHE_KEY, json.dumps(_record_row(row), separators=(",", ":")), ex=max(60, get_settings().fx_cache_ttl_seconds))
    except RedisError:
        return
    finally:
        client.close()


def refresh_fx_quote(db: Session, *, force: bool = False) -> dict:
    settings = get_settings()
    if not force and active_fx_quote(db) is not None:
        return {"status": "unchanged", "quote": _record_row(active_fx_quote(db))}
    lock_token = secrets.token_urlsafe(16)
    client = _redis_client(settings.redis_url)
    try:
        if not client.set(FX_LOCK_KEY, lock_token, nx=True, ex=max(30, settings.fx_refresh_lock_seconds)):
            raise compass_error(409, "fx_refresh_in_progress", "An FX refresh is already in progress.")
    except RedisError:
        if settings.environment.strip().lower() in {"production", "prod"}:
            raise compass_error(503, "fx_lock_unavailable", "FX refresh coordination is unavailable.") from None
    finally:
        client.close()
    try:
        primary = FrankfurterAdapter(settings.fx_frankfurter_url, settings.fx_request_timeout_seconds, settings.fx_request_attempts)
        try:
            quote = primary.get_usd_inr_rate()
        except FxProviderError as primary_error:
            fallback = FawazAdapter(settings.fx_fawaz_url, settings.fx_request_timeout_seconds, settings.fx_request_attempts)
            try:
                quote = fallback.get_usd_inr_rate()
            except FxProviderError as fallback_error:
                raise compass_error(503, "fx_unavailable", "No approved FX provider returned a valid quote.") from fallback_error
            if not quote_is_fresh(quote, settings.fx_max_quote_age_seconds):
                raise compass_error(503, "fx_stale", "The fallback FX quote is stale.")
        if not quote_is_fresh(quote, settings.fx_max_quote_age_seconds):
            raise compass_error(503, "fx_stale", "The FX quote is stale.")
        previous = active_fx_quote(db, require_fresh=False)
        if previous and quotes_diverge(Decimal(str(previous.rate)), quote.rate, settings.fx_max_deviation_bps):
            raise compass_error(503, "fx_deviation_exceeded", "The FX quote diverges beyond the configured safety threshold.")
        row = FxRateQuoteRecord(base_currency=quote.base_currency, quote_currency=quote.quote_currency, rate=quote.rate, provider=quote.provider, publication_date=datetime.combine(quote.publication_date, time.min), retrieved_at=quote.retrieved_at, approved_at=now(), validation_status="approved", source_reference=quote.source_reference)
        db.add(row)
        active_policy = db.scalar(select(PricingPolicy).where(PricingPolicy.status == "active").order_by(PricingPolicy.effective_at.desc()).limit(1))
        if active_policy is not None:
            active_policy.status = "retired"
            rate_paise = int((quote.rate * Decimal(100)).to_integral_value(rounding=ROUND_CEILING))
            db.add(PricingPolicy(version=f"fx-{quote.publication_date.isoformat()}-{row.id[:8]}", markup_bps=active_policy.markup_bps, usd_to_inr_paise_per_usd=rate_paise, fx_buffer_bps=active_policy.fx_buffer_bps, platform_fee_bps=active_policy.platform_fee_bps, fx_source=quote.provider, fx_fetched_at=quote.retrieved_at, status="active", effective_at=now()))
        db.commit()
        _cache_quote(row)
        return {"status": "approved", "quote": _record_row(row)}
    except Exception as exc:
        db.rollback()
        if isinstance(exc, Exception) and getattr(exc, "status_code", None):
            raise
        raise


def fx_status(db: Session) -> dict:
    active = active_fx_quote(db, require_fresh=False)
    history = db.scalars(select(FxRateQuoteRecord).order_by(FxRateQuoteRecord.retrieved_at.desc()).limit(20)).all()
    return {"active": _record_row(active) if active else None, "fresh": active is not None and active_fx_quote(db) is not None, "refresh_seconds": get_settings().fx_refresh_seconds, "next_planned_refresh": (active.retrieved_at + timedelta(seconds=get_settings().fx_refresh_seconds)).isoformat() if active else None, "history": [_record_row(row) for row in history]}
