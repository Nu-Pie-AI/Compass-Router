import json
import logging
from pathlib import Path

from app.observability import JsonFormatter
from infra.gcp.validate_templates import main
from infra.gcp.build_release import main as build_release


def test_cloud_run_templates_are_placeholder_only():
    main()


def test_api_template_requires_production_runtime_values():
    from infra.gcp.validate_templates import validate_template

    validate_template(Path("infra/gcp/cloudrun-api-service.yaml.template"))


def test_release_builder_dry_run_does_not_push_or_write():
    assert build_release(
        [
            "--registry",
            "region-docker.pkg.dev/project/repository",
            "--web-api-url",
            "https://api.example.invalid",
            "--marketplace-url",
            "https://marketplace.example.invalid",
            "--dry-run",
        ]
    ) == 0


def test_structured_log_formatter_uses_an_allow_list():
    record = logging.LogRecord("compass.http", logging.INFO, __file__, 1, "http_request", (), None)
    record.request_id = "obs-test"
    record.method = "GET"
    record.path = "/health"
    record.status_code = 200
    record.latency_ms = 3
    record.authorization = "Bearer must-not-appear"
    payload = json.loads(JsonFormatter().format(record))
    assert payload["request_id"] == "obs-test"
    assert payload["path"] == "/health"
    assert "authorization" not in payload
    assert "must-not-appear" not in json.dumps(payload)
