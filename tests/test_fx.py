from datetime import date
from decimal import Decimal

import pytest

from apps.api.app.fx import FawazAdapter, FrankfurterAdapter, FxProviderError, _quote_from_payload, quotes_diverge, quote_is_fresh


def test_frankfurter_quote_is_normalized_with_decimal():
    quote = _quote_from_payload([{"date": "2026-10-09", "base": "USD", "quote": "INR", "rate": 83.1257}], provider="frankfurter", source_reference="test")
    assert quote.rate == Decimal("83.1257")
    assert quote.publication_date == date(2026, 10, 9)


@pytest.mark.parametrize("payload", [[], [{"date": "2026-10-09", "base": "EUR", "quote": "INR", "rate": 90}], [{"date": "2026-10-09", "base": "USD", "quote": "INR", "rate": 0}], [{"date": "2026-10-09", "base": "USD", "quote": "INR", "rate": "NaN"}]])
def test_invalid_quotes_are_rejected(payload):
    with pytest.raises(FxProviderError):
        _quote_from_payload(payload, provider="test", source_reference="test")


def test_fawaz_payload_is_normalized(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"date": "2026-10-09", "usd": {"inr": 83.2}}

    class Client:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def get(self, *_args, **_kwargs):
            return Response()

    monkeypatch.setattr("apps.api.app.fx.httpx.Client", Client)
    quote = FawazAdapter("https://example.test").get_usd_inr_rate()
    assert quote.provider == "fawaz"
    assert quote.rate == Decimal("83.2")


def test_freshness_and_divergence_guards():
    quote = _quote_from_payload({"date": "2026-10-09", "base": "USD", "quote": "INR", "rate": 83}, provider="test", source_reference="test")
    assert quote_is_fresh(quote, 345600, today=date(2026, 10, 11))
    assert not quote_is_fresh(quote, 86400, today=date(2026, 10, 11))
    assert quotes_diverge(Decimal("83"), Decimal("90"), 500)
    assert not quotes_diverge(Decimal("83"), Decimal("83.2"), 500)
