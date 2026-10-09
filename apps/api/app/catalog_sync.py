"""Scheduled catalog synchronization entry point.

Run from the API image as a Cloud Scheduler/Cloud Run Job target. It performs
only provider discovery and registry persistence; it does not activate models.
"""

from __future__ import annotations

import argparse
import asyncio

async def run(provider: str) -> dict:
    from .db import SessionLocal
    from .services import sync_litellm_catalog, sync_openrouter_catalog

    db = SessionLocal()
    try:
        if provider == "litellm":
            return await sync_litellm_catalog(db, force=True)
        if provider == "openrouter":
            return await sync_openrouter_catalog(db, force=True)
        raise ValueError(f"Unsupported catalog provider: {provider}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize a configured Compass Router model catalog.")
    parser.add_argument("--provider", default="litellm", choices=("litellm", "openrouter"))
    args = parser.parse_args()
    print(asyncio.run(run(args.provider)))


if __name__ == "__main__":
    main()
