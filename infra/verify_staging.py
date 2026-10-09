"""Run non-destructive Compass Router staging checks.

The default checks are health endpoints and authenticated model visibility.
The streaming check makes a real provider request only when the operator
passes --run-chat --allow-paid-request and supplies an explicit model.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class CheckResult:
    name: str
    status_code: int
    ok: bool
    detail: str
    request_id: str | None = None


def normalize_base_url(value: str) -> str:
    base = value.strip().rstrip("/")
    if not base.startswith(("https://", "http://")):
        raise ValueError("API URL must start with http:// or https://")
    return base


def _request_id(response: httpx.Response) -> str | None:
    return response.headers.get("x-request-id") or response.headers.get("x-compass-request-id")


def _health_checks(client: httpx.Client, base_url: str) -> list[CheckResult]:
    results: list[CheckResult] = []
    for path in ("/health", "/health/live", "/health/ready"):
        try:
            response = client.get(f"{base_url}{path}")
            results.append(CheckResult(path, response.status_code, response.is_success, "health endpoint checked", _request_id(response)))
        except httpx.HTTPError as exc:
            results.append(CheckResult(path, 0, False, type(exc).__name__))
    return results


def _model_visibility_check(client: httpx.Client, base_url: str, api_key: str) -> tuple[CheckResult, list[str]]:
    try:
        response = client.get(f"{base_url}/v1/models", headers={"Authorization": f"Bearer {api_key}"})
    except httpx.HTTPError as exc:
        return CheckResult("/v1/models", 0, False, type(exc).__name__), []
    model_ids: list[str] = []
    try:
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("data"), list):
            model_ids = [row["id"] for row in payload["data"] if isinstance(row, dict) and isinstance(row.get("id"), str)]
    except ValueError:
        pass
    return CheckResult("/v1/models", response.status_code, response.is_success, f"{len(model_ids)} models visible", _request_id(response)), model_ids


def _stream_check(client: httpx.Client, base_url: str, api_key: str, model: str) -> CheckResult:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "staging smoke check"}],
        "max_tokens": 8,
        "stream": True,
    }
    started = time.perf_counter()
    try:
        with client.stream("POST", f"{base_url}/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload) as response:
            first_byte_ms: float | None = None
            line_count = 0
            for line in response.iter_lines():
                if first_byte_ms is None:
                    first_byte_ms = (time.perf_counter() - started) * 1000
                line_count += 1
            elapsed_ms = (time.perf_counter() - started) * 1000
            if not response.is_success:
                return CheckResult("/v1/chat/completions(stream)", response.status_code, False, "provider stream rejected")
            if first_byte_ms is None:
                return CheckResult("/v1/chat/completions(stream)", response.status_code, False, "stream returned no bytes", _request_id(response))
            return CheckResult("/v1/chat/completions(stream)", response.status_code, True, f"first_byte_ms={first_byte_ms:.1f}; elapsed_ms={elapsed_ms:.1f}; lines={line_count}", _request_id(response))
    except httpx.HTTPError as exc:
        return CheckResult("/v1/chat/completions(stream)", 0, False, type(exc).__name__)


def run(args: argparse.Namespace) -> int:
    try:
        base_url = normalize_base_url(args.api_url or os.environ.get("COMPASS_STAGING_API_URL", ""))
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    api_key = args.api_key or os.environ.get("COMPASS_STAGING_API_KEY", "")
    if not api_key:
        print("ERROR: provide --api-key or COMPASS_STAGING_API_KEY", file=sys.stderr)
        return 2
    if args.run_chat and not args.allow_paid_request:
        print("ERROR: --run-chat requires --allow-paid-request", file=sys.stderr)
        return 2
    if args.run_chat and not args.model:
        print("ERROR: --run-chat requires an explicit --model", file=sys.stderr)
        return 2

    results: list[CheckResult]
    with httpx.Client(timeout=args.timeout, follow_redirects=False) as client:
        results = _health_checks(client, base_url)
        model_check, _ = _model_visibility_check(client, base_url, api_key)
        results.append(model_check)
        if args.run_chat:
            results.append(_stream_check(client, base_url, api_key, args.model))
    for result in results:
        request_suffix = f" request_id={result.request_id}" if result.request_id else ""
        print(f"{'PASS' if result.ok else 'FAIL'} {result.name} status={result.status_code} {result.detail}{request_suffix}")
    return 0 if all(result.ok for result in results) else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Run non-destructive Compass Router staging checks.")
    parser.add_argument("--api-url", help="Staging API base URL; defaults to COMPASS_STAGING_API_URL")
    parser.add_argument("--api-key", help="Compass API key; defaults to COMPASS_STAGING_API_KEY and is never printed")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--run-chat", action="store_true", help="Make one real streaming inference request")
    parser.add_argument("--allow-paid-request", action="store_true", help="Required acknowledgement before --run-chat")
    parser.add_argument("--model", help="Explicit live model ID for --run-chat")
    args = parser.parse_args()
    raise SystemExit(run(args))


if __name__ == "__main__":
    main()
