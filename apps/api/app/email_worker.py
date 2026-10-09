"""Deliver queued Compass emails through an explicitly configured SMTP transport."""

from __future__ import annotations

import argparse
import json
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings


def _send_smtp(message: EmailOutbox) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is not configured")

    email = EmailMessage()
    email["From"] = settings.email_from
    email["To"] = message.recipient
    email["Subject"] = message.subject
    email.set_content(message.body)

    client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds)
    try:
        if settings.smtp_use_tls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password or "")
        client.send_message(email)
    finally:
        try:
            client.quit()
        except OSError:
            pass


def drain_email_outbox(db: Session, *, limit: int = 25, retry_failed: bool = False) -> dict[str, int]:
    """Claim and deliver a bounded batch; transport failures remain visible."""

    from .models import EmailOutbox

    settings = get_settings()
    statuses = ["queued", "failed"] if retry_failed else ["queued"]
    rows = db.scalars(
        select(EmailOutbox)
        .where(EmailOutbox.status.in_(statuses), EmailOutbox.attempts < settings.email_max_attempts)
        .order_by(EmailOutbox.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(max(1, min(limit, 500)))
    ).all()
    for row in rows:
        row.status = "sending"
        row.attempts += 1
        row.last_error = ""
    if rows:
        db.commit()

    sent = 0
    failed = 0
    for row in rows:
        try:
            _send_smtp(row)
        except Exception as exc:  # transport errors must be recorded, never hidden
            row.status = "failed"
            row.last_error = str(exc)[:1000]
            db.commit()
            failed += 1
            continue
        row.status = "sent"
        row.sent_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        sent += 1
    return {"selected": len(rows), "sent": sent, "failed": failed}


def main() -> None:
    parser = argparse.ArgumentParser(description="Deliver queued Compass Router email messages.")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args()
    from .db import SessionLocal

    db = SessionLocal()
    try:
        print(json.dumps(drain_email_outbox(db, limit=args.limit, retry_failed=args.retry_failed), sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
