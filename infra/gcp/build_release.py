"""Build immutable Cloud Run images with provenance and SBOM attestations.

This script performs an explicit registry push only when an operator invokes it
with a configured Artifact Registry path. It never deploys Cloud Run services
or reads application secrets.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def run(command: list[str], *, dry_run: bool = False) -> str:
    print("+", " ".join(command))
    if dry_run:
        return ""
    completed = subprocess.run(command, cwd=ROOT, check=True, text=True, capture_output=True)
    return completed.stdout.strip()


def find_digest(metadata: object) -> str | None:
    if isinstance(metadata, dict):
        value = metadata.get("containerimage.digest")
        if isinstance(value, str) and value.startswith("sha256:"):
            return value
        for child in metadata.values():
            digest = find_digest(child)
            if digest:
                return digest
    elif isinstance(metadata, list):
        for child in metadata:
            digest = find_digest(child)
            if digest:
                return digest
    return None


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--registry", required=True, help="Artifact Registry repository, without the image name")
    result.add_argument("--output", default=".release/release-manifest.json", help="Manifest path relative to the repository root")
    result.add_argument("--platform", default="linux/amd64")
    result.add_argument("--web-api-url", required=True, help="Public API URL passed to the web build")
    result.add_argument("--marketplace-url", required=True, help="Marketplace URL passed to the web build")
    result.add_argument("--dry-run", action="store_true", help="Print build commands without invoking Docker or writing a manifest")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    commit = run(["git", "rev-parse", "HEAD"], dry_run=args.dry_run) or "DRY_RUN"
    dirty = bool(run(["git", "status", "--porcelain"], dry_run=args.dry_run))
    if dirty and not args.dry_run:
        raise SystemExit("release artifacts require a clean Git worktree")

    tag = commit if commit != "DRY_RUN" else "DRY_RUN"
    images = {
        "api": f"{args.registry.rstrip('/')}/compass-router-api:{tag}",
        "web": f"{args.registry.rstrip('/')}/compass-router-web:{tag}",
    }
    metadata_dir = ROOT / ".release" / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True) if not args.dry_run else None
    metadata_paths = {name: metadata_dir / f"{name}.json" for name in images}
    build_commands = {
        "api": [
            "docker",
            "buildx",
            "build",
            "--push",
            "--platform",
            args.platform,
            "--provenance=true",
            "--sbom=true",
            "--metadata-file",
            str(metadata_paths["api"]),
            "--tag",
            images["api"],
            "--file",
            "apps/api/Dockerfile",
            ".",
        ],
        "web": [
            "docker",
            "buildx",
            "build",
            "--push",
            "--platform",
            args.platform,
            "--provenance=true",
            "--sbom=true",
            "--metadata-file",
            str(metadata_paths["web"]),
            "--build-arg",
            f"NEXT_PUBLIC_COMPASS_API_URL={args.web_api_url}",
            "--build-arg",
            f"NEXT_PUBLIC_MARKETPLACE_URL={args.marketplace_url}",
            "--tag",
            images["web"],
            "--file",
            "apps/web/Dockerfile",
            ".",
        ],
    }
    digests: dict[str, str] = {}
    for name, command in build_commands.items():
        run(command, dry_run=args.dry_run)
        if not args.dry_run:
            metadata = json.loads(metadata_paths[name].read_text(encoding="utf-8"))
            digest = find_digest(metadata)
            if digest is None:
                raise RuntimeError(f"BuildKit did not return an immutable digest for {name}")
            digests[name] = digest

    if args.dry_run:
        return 0
    output = (ROOT / args.output).resolve()
    if ROOT not in output.parents and output != ROOT:
        raise SystemExit("manifest output must remain inside the repository")
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": commit,
        "platform": args.platform,
        "images": {name: {"tag": images[name], "digest": digests[name]} for name in images},
        "attestations": {"provenance": True, "sbom": True},
        "deployment": "not_performed",
    }
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote immutable release manifest: {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
