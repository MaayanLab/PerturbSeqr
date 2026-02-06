#!/usr/bin/env python3
"""
Merge separate up/down GMT files into unified GMT files.

For each dataset, reads {name}-up.gmt.gz and {name}-down.gmt.gz, appends " up"
or " down" to each term (first tab field), and writes a combined {name}.gmt.gz.

Original files are moved to a 'separate/' subdirectory for preservation.

Usage:
  python scripts/merge_gmts.py                    # Process all datasets
  python scripts/merge_gmts.py --dry-run           # Preview without writing
  python scripts/merge_gmts.py --no-move           # Don't move originals
"""

import argparse
import gzip
import shutil
from pathlib import Path

DATA_DIRS = [
    Path(__file__).parent.parent / "db" / "data" / "drug_perturbation",
    Path(__file__).parent.parent / "db" / "data" / "gene_perturbation",
]


def find_pairs(data_dir: Path) -> list[tuple[str, Path, Path]]:
    """Find matching up/down GMT pairs. Returns [(name, up_path, down_path), ...]."""
    up_files = {f.name.replace("-up.gmt.gz", ""): f for f in data_dir.glob("*-up.gmt.gz")}
    down_files = {f.name.replace("-down.gmt.gz", ""): f for f in data_dir.glob("*-down.gmt.gz")}
    pairs = []
    for name in sorted(up_files.keys() & down_files.keys()):
        pairs.append((name, up_files[name], down_files[name]))
    return pairs


def read_and_tag_lines(gmt_path: Path, direction: str) -> list[bytes]:
    """Read a gzipped GMT file and append direction to each term (first tab field).

    Skips appending if the term already ends with a direction suffix (" up", " down", " dn").
    """
    tagged = []
    suffix = f" {direction}".encode()
    existing_suffixes = (b" up", b" down", b" dn")
    with gzip.open(gmt_path, "rb") as f:
        for line in f:
            line = line.rstrip(b"\n").rstrip(b"\r")
            if not line:
                continue
            # Split on first tab only to get the term, keep rest intact
            parts = line.split(b"\t", 1)
            term = parts[0]
            # Don't double-add direction if term already has one
            if not any(term.endswith(s) for s in existing_suffixes):
                term = term + suffix
            if len(parts) == 2:
                tagged.append(term + b"\t" + parts[1])
            else:
                tagged.append(term)
    return tagged


def merge_pair(name: str, up_path: Path, down_path: Path, output_dir: Path) -> int:
    """Merge an up/down pair into a single GMT file. Returns total term count."""
    up_lines = read_and_tag_lines(up_path, "up")
    down_lines = read_and_tag_lines(down_path, "down")

    output_path = output_dir / f"{name}.gmt.gz"
    with gzip.open(output_path, "wb") as f:
        for line in up_lines + down_lines:
            f.write(line + b"\n")

    return len(up_lines) + len(down_lines)


def main():
    parser = argparse.ArgumentParser(description="Merge up/down GMT files into unified files")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--no-move", action="store_true", help="Don't move original files")
    parser.add_argument("--output-dir", type=Path, help="Output directory (default: same as input)")
    args = parser.parse_args()

    total_files = 0
    total_terms = 0

    for data_dir in DATA_DIRS:
        if not data_dir.exists():
            print(f"Skipping {data_dir} (not found)")
            continue

        pairs = find_pairs(data_dir)
        if not pairs:
            print(f"No up/down pairs found in {data_dir}")
            continue

        output_dir = args.output_dir or data_dir
        print(f"\n{'=' * 60}")
        print(f"Directory: {data_dir}")
        print(f"{'=' * 60}")

        for name, up_path, down_path in pairs:
            if args.dry_run:
                up_count = sum(1 for _ in gzip.open(up_path, "rb"))
                down_count = sum(1 for _ in gzip.open(down_path, "rb"))
                print(f"  {name}: {up_count} up + {down_count} down = {up_count + down_count} terms")
                total_terms += up_count + down_count
            else:
                count = merge_pair(name, up_path, down_path, output_dir)
                print(f"  {name}.gmt.gz: {count} terms")
                total_terms += count

                if not args.no_move:
                    separate_dir = data_dir / "separate"
                    separate_dir.mkdir(exist_ok=True)
                    shutil.move(str(up_path), str(separate_dir / up_path.name))
                    shutil.move(str(down_path), str(separate_dir / down_path.name))

            total_files += 1

    action = "Would create" if args.dry_run else "Created"
    print(f"\n{action} {total_files} unified GMT files ({total_terms} total terms)")


if __name__ == "__main__":
    main()
