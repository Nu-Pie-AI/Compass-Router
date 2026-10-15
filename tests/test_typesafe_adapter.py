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
    with pytest.raises(TypeSafeAdapterError, match="invalid structured decision"):
        response_json({"model": "jev-latest"})


def _questions():
    return {
        "label": {"type": "choice", "instructions": "Choose", "criteria": {"a": "A", "b": "B"}},
        "quality": {"type": "score", "instructions": "Score", "criteria": ["low", "mid", "high"]},
        "safe": {"type": "noul", "instructions": "Is it safe?", "criteria": {"true": "safe", "false": "unsafe"}},
    }


def _valid_response():
    return {
        "model": "jev-latest",
        "usage": {"input_tokens": 12, "output_tokens": 3},
        "answers": {
            "label": {"type": "choice", "choice": "a", "confidence": 0.8, "probabilities": {"a": 0.8, "b": 0.2}},
            "quality": {"type": "score", "score": 1.7, "confidence": 0.9, "legend": {"0": "low", "1": "mid", "2": "high"}, "probabilities": {"0": 0.1, "1": 0.1, "2": 0.8}},
            "safe": {"type": "noul", "noul": 0.98},
        },
    }


def test_response_json_accepts_valid_choice_score_noul_and_missing_usage():
    response = _valid_response()
    response.pop("usage")
    assert response_json(response, _questions(), "jev-latest")["answers"]["safe"]["noul"] == 0.98


@pytest.mark.parametrize(
    "mutate",
    [
        lambda response: response["answers"].pop("safe"),
        lambda response: response["answers"].update({"unknown": response["answers"]["safe"]}),
        lambda response: response["answers"]["label"].update({"type": "score"}),
        lambda response: response["answers"]["label"].update({"choice": "missing"}),
        lambda response: response["answers"]["label"].update({"probabilities": {"a": 0.5, "b": 0.4}}),
        lambda response: response["answers"]["safe"].update({"noul": float("nan")}),
        lambda response: response["answers"]["safe"].update({"noul": float("inf")}),
        lambda response: response["answers"]["quality"].update({"score": 4}),
        lambda response: response["answers"]["quality"].update({"probabilities": {"0": 0.2, "1": 0.2, "2": 0.2}}),
        lambda response: response["answers"].update({"safe": ["duplicate-id"]}),
        lambda response: response.update({"usage": {"input_tokens": "12", "output_tokens": 3}}),
    ],
)
def test_response_json_rejects_semantically_invalid_provider_payloads(mutate):
    response = _valid_response()
    mutate(response)
    with pytest.raises(TypeSafeAdapterError, match="invalid structured decision"):
        response_json(response, _questions(), "jev-latest")


def test_response_json_rejects_wrong_model_and_malformed_usage():
    response = _valid_response()
    response["model"] = "different-model"
    with pytest.raises(TypeSafeAdapterError):
        response_json(response, _questions(), "jev-latest")
    response = _valid_response()
    response["usage"] = []
    with pytest.raises(TypeSafeAdapterError):
        response_json(response, _questions(), "jev-latest")
