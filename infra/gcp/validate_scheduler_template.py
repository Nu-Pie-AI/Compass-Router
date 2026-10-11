"""Validate the unactioned Cloud Scheduler FX refresh preparation artifact."""

from __future__ import annotations

from pathlib import Path
import re


TEMPLATE = Path(__file__).resolve().parent / "cloudscheduler-fx-refresh.yaml.template"
REQUIRED_PLACEHOLDERS = {
    "GCP_PROJECT_ID",
    "REGION",
    "API_STAGING_URL",
    "FX_SCHEDULER_SERVICE_ACCOUNT",
}


def validate_template(path: Path = TEMPLATE) -> None:
    text = path.read_text(encoding="utf-8")
    placeholders = {match[2:-1] for match in re.findall(r"\$\{[A-Z0-9_]+\}", text)}
    missing = sorted(REQUIRED_PLACEHOLDERS - placeholders)
    if missing:
        raise AssertionError(f"scheduler template is missing placeholders: {', '.join(missing)}")
    if 'httpMethod: POST' not in text or 'oidcToken:' not in text:
        raise AssertionError("scheduler template must use an authenticated POST with OIDC")
    if 'uri: "${API_STAGING_URL}/internal/jobs/fx-refresh"' not in text:
        raise AssertionError("scheduler target must be the staging FX refresh endpoint")
    if 'timeZone: "Asia/Kolkata"' not in text:
        raise AssertionError("scheduler template must declare its publication-time timezone")
    if 'retryCount:' not in text or 'maxRetryDuration:' not in text:
        raise AssertionError("scheduler template must define bounded retries")
    if any(token in text for token in ("sk_live_", "rzp_live_", "-----BEGIN", "DATABASE_URL=", "REDIS_URL=")):
        raise AssertionError("scheduler template contains a possible secret or connection value")


def main() -> None:
    validate_template()
    print("validated Cloud Scheduler FX refresh template")


if __name__ == "__main__":
    main()
