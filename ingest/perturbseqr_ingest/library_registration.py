"""Register catalog entries that reference already uploaded public S3 objects."""
from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .library_manifest import load_manifest, public_s3_url, s3_location


def existing_manifests(root: Path):
    manifests = []
    for path in sorted(root.glob("*/manifest.json")):
        manifest = load_manifest(path)
        if manifest.get("registration") == "existing":
            if path.parent.name != manifest["slug"]:
                raise ValueError(f"Manifest directory must match its slug: {path}")
            manifests.append(manifest)
    if not manifests:
        raise ValueError(f"No existing-library manifests under {root}")
    return manifests


def downloadable_artifacts(manifest: dict) -> list[dict]:
    """Resolve declared public locations; omit all private paths and URLs."""
    artifacts = []
    for raw in manifest.get("artifacts", []):
        status = raw.get("status", "available")
        kind = raw["kind"]
        distribution = manifest.get("distribution", {})
        policy = distribution.get("gmt" if kind == "gmt" else "metadata", "public")
        if status == "available" and raw.get("distribution", policy) == "restricted":
            status = "restricted"
        item = {key: raw[key] for key in ("kind", "format", "bytes", "sha256") if key in raw}
        item["label"] = raw.get("label") or kind.replace("_", " ").capitalize()
        if status == "available":
            if raw.get("s3"):
                _, key = s3_location(raw["s3"])
                item.update(status="external", s3=raw["s3"], url=public_s3_url(raw["s3"]), objectKey=key)
            elif raw.get("url"):
                item.update(status="external", url=raw["url"])
            else:
                raise ValueError(f"Register {manifest['slug']} after uploading local artifact: {raw.get('path')}")
        else:
            item["status"] = status
        artifacts.append(item)
    return artifacts


def verify_public_s3(artifacts):
    """Verify existing S3 links using HEAD only, without reading large files."""
    import requests

    def check(item):
        response = requests.head(item["url"], timeout=20)
        if response.status_code != 200:
            raise ValueError(f"Public S3 object unavailable ({response.status_code}): {item['s3']}")
        if "bytes" in item and int(response.headers.get("Content-Length", "-1")) != item["bytes"]:
            raise ValueError(f"S3 size differs from manifest: {item['s3']}")
        digest = response.headers.get("x-amz-meta-sha256")
        if digest and item.get("sha256") and digest != item["sha256"]:
            raise ValueError(f"S3 SHA-256 metadata differs from manifest: {item['s3']}")

    objects = {item["s3"]: item for item in artifacts if item.get("s3")}
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(check, objects.values()))


def register_artifacts(cur, revision: str, artifacts: list[dict]):
    from psycopg2.extras import Json, execute_values

    cur.execute("DELETE FROM app_public.library_artifact WHERE revision_id=%s", (revision,))
    rows = [(str(uuid.uuid5(uuid.UUID(revision), str(i))), revision, item["kind"], Json({**item, "order": i}))
            for i, item in enumerate(artifacts)]
    if rows:
        execute_values(cur, "INSERT INTO app_public.library_artifact(id,revision_id,kind,metadata) VALUES %s", rows)


def backfill_existing(conn, manifests, *, verify=True):
    """Update only catalog metadata of the active legacy revisions, atomically."""
    from psycopg2.extras import Json

    declarations = [(manifest, downloadable_artifacts(manifest)) for manifest in manifests]
    if verify:
        verify_public_s3(item for _, artifacts in declarations for item in artifacts)
    with conn, conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext('library-publication'))")
        registered = []
        skipped = []
        for manifest, artifacts in declarations:
            cur.execute("""SELECT l.id,l.name,l.slug,l.category,l.resource_key,r.id,r.version
                           FROM app_public.gene_set_library l
                           JOIN app_public.library_revision r ON r.id=l.active_revision_id
                           WHERE l.slug=%s OR (l.slug='legacy-' || l.id::text AND l.name=%s)
                           FOR UPDATE OF l,r""", [manifest["slug"], manifest["displayName"]])
            row = cur.fetchone()
            if not row or row[6] != "legacy":
                skipped.append(manifest["slug"])
                continue
            library_id, name, slug, category, resource, revision, _ = row
            expected = (manifest["category"], manifest["resource"]["key"])
            if name != manifest["displayName"] or (slug == manifest["slug"] and (category, resource) != expected):
                raise ValueError(f"Legacy library identity differs from manifest: {manifest['slug']}")
            if slug != manifest["slug"]:
                cur.execute("""UPDATE app_public.gene_set_library SET slug=%s,category=%s,resource_key=%s
                               WHERE id=%s""", [manifest["slug"], *expected, library_id])
            cur.execute("UPDATE app_public.library_revision SET manifest=%s WHERE id=%s",
                        [Json({**manifest, "legacy": True}), revision])
            register_artifacts(cur, str(revision), artifacts)
            registered.append(manifest["slug"])
    return {"registered": registered, "skipped": skipped}
