"""Idempotent background recovery jobs for Compass financial state."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

def recover_stale_llm_reservations(db: Session, *, max_age_seconds: int = 900, apply: bool = False) -> dict:
    """Preview or release abandoned inference reservations exactly once.

    The default is preview-only. Applying only releases the reserved estimate;
    it never credits a payment or contacts a payment provider.
    """
    from .models import OperationalEvent, WalletAccount, WalletLedger, now
    from .services import settle_wallet_reservation

    cutoff = now() - timedelta(seconds=max(60, max_age_seconds))
    reservations = db.scalars(
        select(WalletLedger)
        .where(
            WalletLedger.reference_type == "llm_reservation",
            WalletLedger.type == "debit",
            WalletLedger.created_at < cutoff,
        )
        .order_by(WalletLedger.created_at.asc())
    ).all()
    candidates: list[dict] = []
    recovered = 0
    skipped = 0
    for reservation in reservations:
        settlement_key = f"llm-settlement:{reservation.reference_id}"
        settled = db.scalar(
            select(WalletLedger.id).where(
                WalletLedger.wallet_id == reservation.wallet_id,
                WalletLedger.idempotency_key.in_([settlement_key, f"{settlement_key}:release"]),
            )
        )
        if settled is not None:
            skipped += 1
            continue
        wallet = db.get(WalletAccount, reservation.wallet_id)
        if wallet is None or wallet.team_id is None:
            skipped += 1
            continue
        row = {
            "reservation_id": reservation.reference_id,
            "wallet_id": wallet.id,
            "team_id": wallet.team_id,
            "reserved_paise": max(0, -reservation.amount_paise),
            "created_at": reservation.created_at.isoformat(),
        }
        candidates.append(row)
        if apply:
            settle_wallet_reservation(db, wallet.team_id, reservation.reference_id, 0, f"recovery:{reservation.reference_id}")
            db.add(
                OperationalEvent(
                    event_type="llm_reservation_recovered",
                    severity="warning",
                    service="compass-recovery",
                    message="Released a stale inference wallet reservation.",
                    metadata_json=json.dumps(row, sort_keys=True),
                )
            )
            db.commit()
            recovered += 1
    return {
        "mode": "apply" if apply else "preview",
        "cutoff": cutoff.isoformat(),
        "candidates": candidates,
        "candidate_count": len(candidates),
        "recovered_count": recovered,
        "skipped_count": skipped,
    }


async def run(task: str, *, apply: bool, max_age_seconds: int) -> dict:
    from .db import SessionLocal

    db = SessionLocal()
    try:
        if task == "recover-reservations":
            return recover_stale_llm_reservations(db, max_age_seconds=max_age_seconds, apply=apply)
        raise ValueError(f"Unsupported recovery task: {task}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run safe Compass Router recovery jobs.")
    parser.add_argument("--task", default="recover-reservations", choices=("recover-reservations",))
    parser.add_argument("--max-age-seconds", type=int, default=900)
    parser.add_argument("--apply", action="store_true", help="Apply idempotent reservation releases; default is preview-only.")
    args = parser.parse_args()
    print(asyncio.run(run(args.task, apply=args.apply, max_age_seconds=args.max_age_seconds)))


if __name__ == "__main__":
    main()
