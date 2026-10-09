"""Structured, redaction-safe request logging for Cloud Logging-compatible output."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import logging
import sys
from typing import Any


_HANDLER_MARKER = "_compass_json_handler"


class JsonFormatter(logging.Formatter):
    """Emit a small allow-listed event shape and never serialize log extras wholesale."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        for field in ("request_id", "method", "path", "status_code", "latency_ms", "error_type"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def configure_logging(level: str = "INFO") -> None:
    logger = logging.getLogger("compass")
    logger.setLevel(getattr(logging, level.strip().upper(), logging.INFO))
    logger.propagate = False
    if any(getattr(handler, _HANDLER_MARKER, False) for handler in logger.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    setattr(handler, _HANDLER_MARKER, True)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)


def log_request(*, request_id: str, method: str, path: str, status_code: int, latency_ms: int, error_type: str | None = None) -> None:
    logging.getLogger("compass.http").info(
        "http_request",
        extra={
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "error_type": error_type,
        },
    )
