"""Provider-neutral daily FX quote adapters for managed pricing."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import math
from typing import Any

import httpx


@dataclass(frozen=True)
class FxRateQuote:
    base_currency: str
    quote_currency: str
    rate: Decimal
    provider: str
    publication_date: date
    retrieved_at: datetime
    source_reference: str
    validation_status: str = "validated"


class FxProviderError(RuntimeError):
    pass


def _quote_from_payload(payload: Any, *, provider: str, source_reference: str) -> FxRateQuote:
    rows = payload if isinstance(payload, list) else [payload]
    row = next((item for item in rows if isinstance(item, dict)), None)
    if row is None or not {"base", "quote", "rate", "date"}.issubset(row):
        raise FxProviderError("FX response schema was not recognized")
    base = str(row["base"]).upper()
    quote = str(row["quote"]).upper()
    if base != "USD" or quote != "INR":
        raise FxProviderError("FX response currency pair was unexpected")
    try:
        rate = Decimal(str(row["rate"]))
        publication_date = date.fromisoformat(str(row["date"]))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise FxProviderError("FX response contained an invalid rate or publication date") from exc
    if not rate.is_finite() or rate <= 0:
        raise FxProviderError("FX response rate must be a finite positive number")
    return FxRateQuote(base, quote, rate, provider, publication_date, datetime.now(timezone.utc).replace(tzinfo=None), source_reference)


class FrankfurterAdapter:
    name = "frankfurter"

    def __init__(self, base_url: str, timeout_seconds: float = 10.0, attempts: int = 2):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.attempts = max(1, min(attempts, 4))

    def get_usd_inr_rate(self) -> FxRateQuote:
        url = f"{self.base_url}/v2/rates?base=USD&quotes=INR"
        last_error: Exception | None = None
        for _ in range(self.attempts):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.get(url, headers={"Accept": "application/json", "User-Agent": "Compass-Router-fx-refresh/1.0"})
                response.raise_for_status()
                return _quote_from_payload(response.json(), provider=self.name, source_reference=url)
            except (httpx.HTTPError, ValueError, FxProviderError) as exc:
                last_error = exc
        raise FxProviderError("Frankfurter FX request failed") from last_error


class FawazAdapter:
    name = "fawaz"

    def __init__(self, base_url: str, timeout_seconds: float = 10.0, attempts: int = 2):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.attempts = max(1, min(attempts, 4))

    def get_usd_inr_rate(self) -> FxRateQuote:
        url = f"{self.base_url}/v1/currencies/usd.json"
        last_error: Exception | None = None
        for _ in range(self.attempts):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.get(url, headers={"Accept": "application/json", "User-Agent": "Compass-Router-fx-refresh/1.0"})
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict) or not isinstance(payload.get("usd"), dict):
                    raise FxProviderError("Fawaz FX response schema was not recognized")
                rate = payload["usd"].get("inr")
                if rate is None:
                    raise FxProviderError("Fawaz response did not contain USD/INR")
                today = datetime.now(timezone.utc).date()
                return _quote_from_payload({"base": "USD", "quote": "INR", "rate": rate, "date": today.isoformat()}, provider=self.name, source_reference=url)
            except (httpx.HTTPError, ValueError, FxProviderError) as exc:
                last_error = exc
        raise FxProviderError("Fawaz FX request failed") from last_error


def quote_is_fresh(quote: FxRateQuote, max_age_seconds: int, *, today: date | None = None) -> bool:
    current = today or datetime.now(timezone.utc).date()
    age_days = (current - quote.publication_date).days
    return age_days >= 0 and age_days * 86400 <= max_age_seconds


def quotes_diverge(first: Decimal, second: Decimal, max_deviation_bps: int) -> bool:
    if first <= 0 or second <= 0:
        return True
    deviation_bps = abs(first - second) / first * Decimal(10_000)
    return deviation_bps > Decimal(max_deviation_bps)
