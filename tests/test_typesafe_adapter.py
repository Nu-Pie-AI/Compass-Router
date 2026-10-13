import pytest

from app.typesafe_adapter import TypeSafeAdapterError, build_questions, response_json


def test_build_questions_preserves_choice_score_and_noul_types():
    questions = build_questions({
        "label": {"type": "choice", "instructions": "Choose", "criteria": {"a": "A", "b": "B"}},
        "quality": {"type": "score", "instructions": "Score", "criteria": ["low", "high"]},
        "safe": {"type": "noul", "instructions": "Is it safe?", "criteria": {"true": "safe", "false": "unsafe"}},
    })
    assert questions["label"].type == "choice"
    assert questions["quality"].type == "score"
    assert questions["safe"].type == "noul"


def test_response_json_rejects_unstructured_provider_output():
    with pytest.raises(TypeSafeAdapterError, match="no structured answers"):
        response_json({"model": "jev-latest"})
