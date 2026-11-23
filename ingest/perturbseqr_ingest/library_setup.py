"""One-shot container job for the existing catalog and selected S3-backed releases."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from contextlib import closing
from pathlib import Path

import requests

from .library_manager import connection, index, publish, stage_remote
from .library_manifest import load_manifest
from .library_registration import backfill_existing, existing_manifests


def bundled_release(manifests_dir: Path, slug: str) -> Path:
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        raise ValueError(f"Invalid release slug: {slug!r}")
    path = manifests_dir / slug / "manifest.json"
    if not path.is_file():
        raise ValueError(f"Release {slug!r} is not bundled in this image")
    return path


def selected_releases(paths):
    releases = {}
    for path in paths:
        manifest = load_manifest(path)
        slug = manifest["slug"]
        if manifest.get("registration") == "existing" or not manifest["input"]["gmt"].startswith("s3://"):
            raise ValueError(f"{path}: supply the uploaded release manifest with an S3 GMT")
        if slug in releases:
            raise ValueError(f"Provide only one release per library: {slug}")
        releases[slug] = path
    return releases


def check_enrichment(conn):
    url = os.environ["ENRICH_URL"].rstrip("/")
    response = requests.get(f"{url}/library-setup/status", timeout=15)
    if response.status_code == 404:
        raise ValueError("Deploy the catalog-aware enrichment service before importing releases")
    response.raise_for_status()
    with conn, conn.cursor() as cur:
        cur.execute("SELECT id::text FROM app_public.current_background()")
        (active,) = cur.fetchone()
    status = response.json()
    if not isinstance(status, dict) or status.get("protocol") != 1 or "activeBackground" not in status or status["activeBackground"] != active:
        raise ValueError("Enrichment service is incompatible or has a different active background; check ENRICH_URL and DATABASE_URL")


def run_setup(manifests_dir: Path, migrations_dir: Path, paths):
    releases = selected_releases(paths)
    legacy = existing_manifests(manifests_dir)
    if releases and not os.environ.get("ENRICH_URL"):
        raise ValueError("ENRICH_URL is required for release publication")

    with closing(connection()) as conn:
        # The connection holds the lock for this job, including HTTP/index work.
        with conn, conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(hashtext('perturbseqr-library-setup'))")
            if not cur.fetchone()[0]:
                raise ValueError("Another library-setup job is already running for this database")
        print("Applying database migrations", flush=True)
        subprocess.run(["dbmate", "--migrations-dir", str(migrations_dir), "--no-dump-schema", "migrate"], check=True)
        print("Registering existing library metadata and downloads", flush=True)
        print(json.dumps(backfill_existing(conn, legacy), indent=2), flush=True)
        if not releases:
            print("Catalog setup complete; no release manifests selected", flush=True)
            return

        check_enrichment(conn)
        for slug, path in releases.items():
            print(f"Validating and staging {slug} from {path}", flush=True)
            revision = stage_remote(path)
            with conn, conn.cursor() as cur:
                cur.execute("""SELECT r.status, l.active_revision_id::text FROM app_public.library_revision r
                               JOIN app_public.gene_set_library l ON l.id=r.library_id WHERE r.id=%s""", [revision])
                status, active = cur.fetchone()
            if active == revision:
                print(f"{slug}: revision {revision} is already active", flush=True)
                continue
            if status == "published":
                raise ValueError(f"{slug}: revision {revision} was previously published and is no longer active")
            print(f"Building and verifying the candidate index for {slug} ({revision})", flush=True)
            generation = index(revision)
            print(f"{slug}: published generation {publish(generation)}", flush=True)


def main():
    import psycopg2

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifests", nargs="*", type=Path, help="S3 release manifests to publish")
    parser.add_argument("--release", default=os.environ.get("LIBRARY_RELEASE") or None,
                        help="Publish a bundled manifest by library slug (defaults to LIBRARY_RELEASE)")
    args = parser.parse_args()
    if not os.environ.get("DATABASE_URL"):
        parser.error("DATABASE_URL is required")
    manifests_dir = Path(os.environ.get("INGEST_MANIFEST_DIR", "/app/libraries"))
    try:
        if args.release is not None:
            args.manifests.append(bundled_release(manifests_dir, args.release))
        run_setup(manifests_dir, Path(os.environ.get("DBMATE_MIGRATIONS_DIR", "/app/migrations")), args.manifests)
    except (ValueError, OSError, subprocess.CalledProcessError, requests.RequestException, psycopg2.Error) as error:
        parser.exit(1, f"Library setup failed: {error}\n")


if __name__ == "__main__":
    main()
