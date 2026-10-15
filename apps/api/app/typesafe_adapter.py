"""Official TypeSafe System One adapter for structured Jev decisions."""

from __future__ import annotations

import asyncio
import math
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


def _invalid_response() -> TypeSafeAdapterError:
    return TypeSafeAdapterError("malformed_typesafe_response", "TypeSafe returned an invalid structured decision.")


def _finite_number(value: Any, *, minimum: float | None = None, maximum: float | None = None) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        return False
    return (minimum is None or value >= minimum) and (maximum is None or value <= maximum)


def _validate_probability_map(value: Any, expected_keys: set[str]) -> bool:
    if not isinstance(value, dict) or set(value) != expected_keys:
        return False
    if not all(_finite_number(probability, minimum=0, maximum=1) for probability in value.values()):
        return False
    return math.isclose(sum(float(probability) for probability in value.values()), 1.0, abs_tol=1e-3)


def _validate_usage(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, dict):
        return False
    for key in ("input_tokens", "output_tokens"):
        tokens = value.get(key)
        if tokens is not None and (isinstance(tokens, bool) or not isinstance(tokens, int) or tokens < 0):
            return False
    return True


def _validate_answer(answer: Any, question: dict[str, Any]) -> bool:
    if not isinstance(answer, dict) or answer.get("type") != question.get("type"):
        return False
    question_type = question.get("type")
    criteria = question.get("criteria")
    if question_type == "choice":
        if not isinstance(criteria, dict) or not isinstance(answer.get("choice"), str) or answer["choice"] not in criteria:
            return False
        if not _finite_number(answer.get("confidence"), minimum=0, maximum=1):
            return False
        return _validate_probability_map(answer.get("probabilities"), {str(key) for key in criteria})
    if question_type == "score":
        if not isinstance(criteria, list) or not criteria:
            return False
        score_keys = {str(index) for index in range(len(criteria))}
        if not _finite_number(answer.get("score"), minimum=0, maximum=len(criteria) - 1):
            return False
        if not _finite_number(answer.get("confidence"), minimum=0, maximum=1):
            return False
        legend = answer.get("legend")
        if not isinstance(legend, dict) or set(legend) != score_keys:
            return False
        probabilities = answer.get("probabilities")
        if not _validate_probability_map(probabilities, score_keys):
            return False
        weighted_score = sum(float(index) * float(probabilities[str(index)]) for index in range(len(criteria)))
        return math.isclose(float(answer["score"]), weighted_score, abs_tol=1e-3)
    if question_type == "noul":
        return _finite_number(answer.get("noul"), minimum=0, maximum=1)
    return False


def response_json(response: Any, questions: dict[str, dict[str, Any]] | None = None, expected_model: str | None = None) -> dict[str, Any]:
    try:
        if hasattr(response, "model_dump"):
            value = response.model_dump(mode="json")
        elif isinstance(response, dict):
            value = response
        else:
            raise _invalid_response()
    except TypeSafeAdapterError:
        raise
    except Exception:
        raise _invalid_response() from None
    if not isinstance(value, dict) or not isinstance(value.get("answers"), dict):
        raise _invalid_response()
    if expected_model is not None and value.get("model") != expected_model:
        raise _invalid_response()
    if not _validate_usage(value.get("usage")):
        raise _invalid_response()
    if questions is None:
        return value
    answers = value["answers"]
    question_ids = set(questions)
    if len(answers) != len(question_ids) or set(answers) != question_ids:
        raise _invalid_response()
    if not all(_validate_answer(answers[question_id], questions[question_id]) for question_id in question_ids):
        raise _invalid_response()
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
            return response_json(response, questions=questions, expected_model=model)
        except Exception as exc:
            if attempt + 1 >= attempts or not _is_retryable(exc):
                status = getattr(exc, "status_code", None)
                status_code = status if isinstance(status, int) else 502
                code = "typesafe_auth_failed" if status_code in {401, 403} else "typesafe_provider_error"
                raise TypeSafeAdapterError(code, "TypeSafe rejected or could not complete the decision request.", status_code, _is_retryable(exc)) from None
            await asyncio.sleep(backoff_seconds * (2**attempt))
    raise TypeSafeAdapterError("typesafe_provider_error", "TypeSafe request failed.")
