"""Official TypeSafe System One adapter for structured Jev decisions."""

from __future__ import annotations

import asyncio
from typing import Any


class TypeSafeAdapterError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 502, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.retryable = retryable


def build_questions(questions: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Build official SDK question primitives without changing user semantics."""
    try:
        from typesafe_sdk import Choice, Noul, Score
    except ImportError as exc:  # pragma: no cover - packaging failure
        raise TypeSafeAdapterError("typesafe_sdk_missing", "The official TypeSafe SDK is not installed.", 503) from exc

    result: dict[str, Any] = {}
    for key, question in questions.items():
        kind = question["type"]
        kwargs = {"instructions": question["instructions"]}
        if kind == "choice":
            result[key] = Choice(criteria=question["criteria"], **kwargs)
        elif kind == "score":
            result[key] = Score(criteria=question["criteria"], **kwargs)
        elif kind == "noul":
            result[key] = Noul(criteria=question.get("criteria"), **kwargs)
        else:  # defensive guard for callers outside Pydantic
            raise TypeSafeAdapterError("invalid_question_type", "Unsupported Jev question type.", 422)
    return result


def response_json(response: Any) -> dict[str, Any]:
    if hasattr(response, "model_dump"):
        value = response.model_dump(mode="json")
    elif isinstance(response, dict):
        value = response
    else:
        raise TypeSafeAdapterError("malformed_typesafe_response", "TypeSafe returned an invalid response.")
    if not isinstance(value, dict) or not isinstance(value.get("answers"), dict):
        raise TypeSafeAdapterError("malformed_typesafe_response", "TypeSafe returned no structured answers.")
    return value


def _is_retryable(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    return status in {408, 409, 429} or (isinstance(status, int) and status >= 500) or isinstance(exc, (TimeoutError, OSError))


async def evaluate(*, api_key: str, base_url: str, model: str, state: Any, questions: dict[str, dict[str, Any]], timeout: float, max_attempts: int, backoff_seconds: float) -> dict[str, Any]:
    try:
        from typesafe_sdk import AsyncTypeSafeClient
    except ImportError as exc:  # pragma: no cover - packaging failure
        raise TypeSafeAdapterError("typesafe_sdk_missing", "The official TypeSafe SDK is not installed.", 503) from exc

    sdk_questions = build_questions(questions)
    attempts = max(1, min(max_attempts, 5))
    for attempt in range(attempts):
        try:
            async with AsyncTypeSafeClient(api_key=api_key, model=model, base_url=base_url, timeout=timeout) as client:
                response = await client.system_one(state=state, questions=sdk_questions, model=model)
            return response_json(response)
        except Exception as exc:
            if attempt + 1 >= attempts or not _is_retryable(exc):
                status = getattr(exc, "status_code", None)
                status_code = status if isinstance(status, int) else 502
                code = "typesafe_auth_failed" if status_code in {401, 403} else "typesafe_provider_error"
                raise TypeSafeAdapterError(code, "TypeSafe rejected or could not complete the decision request.", status_code, _is_retryable(exc)) from None
            await asyncio.sleep(backoff_seconds * (2**attempt))
    raise TypeSafeAdapterError("typesafe_provider_error", "TypeSafe request failed.")
