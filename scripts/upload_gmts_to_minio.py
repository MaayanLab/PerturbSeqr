#!/usr/bin/env python3
"""
Upload GMT files to MinIO for PerturbSeek downloads.

This script reads GMT files from db/data/ directories and uploads them
to a MinIO bucket with standardized names matching frontend expectations.

Usage:
    uv run scripts/upload_gmts_to_minio.py

Environment variables:
    MINIO_ENDPOINT: MinIO server endpoint (default: localhost:9000)
    MINIO_ROOT_USER: MinIO access key (default: minio)
    MINIO_ROOT_PASSWORD: MinIO secret key (required)
"""

import gzip
import os
import sys
from pathlib import Path

from minio import Minio
from minio.error import S3Error

# MinIO configuration
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ROOT_USER", "minio")
MINIO_SECRET_KEY = os.environ.get("MINIO_ROOT_PASSWORD")
MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() == "true"

BUCKET_NAME = "gmts"

# Base paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DRUG_DATA_DIR = PROJECT_ROOT / "db" / "data" / "drug_perturbation"
GENE_DATA_DIR = PROJECT_ROOT / "db" / "data" / "gene_perturbation"

# File mapping: source filename -> target object key (without bucket prefix)
# Files will be uploaded to gmts/{target_name}
FILE_MAPPING = {
    # Drug Perturbation - up
    "l1000-cp_up.gmt.gz": "l1000-cp-up.gmt.gz",
    "tahoe-100m_up.gmt": "tahoe-100m-up.gmt.gz",
    "drugseqr_up.gmt.gz": "drugseqr-up.gmt.gz",
    "cmap-build02-meta_up.gmt": "cmap-build02-up.gmt.gz",
    "sciplex_up.gmt.gz": "sciplex-up.gmt.gz",
    "deepcovermoa_up.gmt.gz": "deepcovermoa-up.gmt.gz",
    "geo-chem_up.gmt.gz": "geo-chem-up.gmt.gz",
    # Drug Perturbation - down
    "l1000-cp_dn.gmt.gz": "l1000-cp-down.gmt.gz",
    "tahoe-100m_dn.gmt": "tahoe-100m-down.gmt.gz",
    "drugseqr_dn.gmt.gz": "drugseqr-down.gmt.gz",
    "cmap-build02-meta_dn.gmt": "cmap-build02-down.gmt.gz",
    "sciplex_dn.gmt.gz": "sciplex-down.gmt.gz",
    "deepcovermoa_dn.gmt.gz": "deepcovermoa-down.gmt.gz",
    "geo-chem_dn.gmt.gz": "geo-chem-down.gmt.gz",
    # Gene Perturbation - up
    "l1000-xpr_up.gmt.gz": "l1000-xpr-up.gmt.gz",
    "perturbatlas_up.gmt.gz": "perturbatlas-up.gmt.gz",
    "perturbatlasmouse_up.gmt.gz": "perturbatlas-mouse-up.gmt.gz",
    "reploglek562genomewide_up.gmt.gz": "replogle-k562-genomewide-up.gmt.gz",
    "reploglerpe1essential_up.gmt.gz": "replogle-rpe1-essential-up.gmt.gz",
    "reploglek562essential_up.gmt.gz": "replogle-k562-essential-up.gmt.gz",
    "geogene_up.gmt.gz": "geo-gene-up.gmt.gz",
    # Gene Perturbation - down
    "l1000-xpr_dn.gmt.gz": "l1000-xpr-down.gmt.gz",
    "perturbatlas_dn.gmt.gz": "perturbatlas-down.gmt.gz",
    "perturbatlasmouse_dn.gmt.gz": "perturbatlas-mouse-down.gmt.gz",
    "reploglek562genomewide_dn.gmt.gz": "replogle-k562-genomewide-down.gmt.gz",
    "reploglerpe1essential_dn.gmt.gz": "replogle-rpe1-essential-down.gmt.gz",
    "reploglek562essential_dn.gmt.gz": "replogle-k562-essential-down.gmt.gz",
    "geogene_dn.gmt.gz": "geo-gene-down.gmt.gz",
}


def find_source_file(filename: str) -> Path | None:
    """Find source file in drug or gene data directories."""
    for data_dir in [DRUG_DATA_DIR, GENE_DATA_DIR]:
        path = data_dir / filename
        if path.exists():
            return path
    return None


def create_bucket_with_public_policy(client: Minio, bucket_name: str) -> None:
    """Create bucket and set public read policy."""
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)
        print(f"Created bucket: {bucket_name}")
    else:
        print(f"Bucket already exists: {bucket_name}")

    # Set public read policy
    policy = f"""{{
        "Version": "2012-10-17",
        "Statement": [
            {{
                "Effect": "Allow",
                "Principal": {{"AWS": ["*"]}},
                "Action": ["s3:GetObject"],
                "Resource": ["arn:aws:s3:::{bucket_name}/*"]
            }}
        ]
    }}"""
    client.set_bucket_policy(bucket_name, policy)
    print(f"Set public read policy on bucket: {bucket_name}")


def upload_file(client: Minio, source_path: Path, object_name: str) -> bool:
    """Upload a file to MinIO, compressing if needed."""
    try:
        # Check if source needs gzip compression
        needs_compression = not source_path.suffix == ".gz"

        if needs_compression:
            # Read, compress, and upload
            with open(source_path, "rb") as f:
                data = f.read()
            compressed_data = gzip.compress(data)

            from io import BytesIO

            data_stream = BytesIO(compressed_data)
            client.put_object(
                BUCKET_NAME,
                object_name,
                data_stream,
                length=len(compressed_data),
                content_type="application/gzip",
            )
            print(
                f"Uploaded (compressed): {source_path.name} -> {object_name} ({len(compressed_data)} bytes)"
            )
        else:
            # Upload as-is
            client.fput_object(
                BUCKET_NAME,
                object_name,
                str(source_path),
                content_type="application/gzip",
            )
            print(
                f"Uploaded: {source_path.name} -> {object_name} ({source_path.stat().st_size} bytes)"
            )

        return True
    except S3Error as e:
        print(f"Error uploading {source_path.name}: {e}")
        return False


def main() -> int:
    if not MINIO_SECRET_KEY:
        print("Error: MINIO_ROOT_PASSWORD environment variable is required")
        return 1

    print(f"Connecting to MinIO at {MINIO_ENDPOINT}...")
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    )

    # Create bucket with public policy
    try:
        create_bucket_with_public_policy(client, BUCKET_NAME)
    except S3Error as e:
        print(f"Error creating bucket: {e}")
        return 1

    # Upload files
    success_count = 0
    error_count = 0
    missing_count = 0

    for source_filename, target_name in FILE_MAPPING.items():
        source_path = find_source_file(source_filename)

        if source_path is None:
            print(f"Warning: Source file not found: {source_filename}")
            missing_count += 1
            continue

        if upload_file(client, source_path, target_name):
            success_count += 1
        else:
            error_count += 1

    print(f"\nUpload complete:")
    print(f"  Successful: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Missing: {missing_count}")

    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
