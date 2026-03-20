#!/usr/bin/env python3
from __future__ import annotations
"""
Canonicalize all GMT term formats into a single unified format.

Canonical format (:: delimited):
  perturbation::cellLine::cellType::timepoint::concentration[::extra1::extra2::...]  up|down

Positions:
  0: perturbation  - drug name or gene name
  1: cellLine      - cell line (empty if unknown)
  2: cellType      - cell type (empty if unknown; fallback for display when cellLine is empty)
  3: timepoint     - empty if unknown
  4: concentration - empty if unknown (always empty for gene libraries)
  5+: dataset-specific extras

Missing values are empty strings between delimiters.
Direction suffix (' up'/' down'/' dn') stays as-is on the term.

Usage:
  python db/canonicalize_gmts.py [--dry-run]
"""

import argparse
import gzip
import json
import os
import re
import shutil
import sys
from pathlib import Path

# Add db/ to path for gmt_parser
DB_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(DB_DIR))
from gmt_parser import read_gmt

DATA_DIR = DB_DIR / "data"
DRUG_DIR = DATA_DIR / "drug_perturbation"
GENE_DIR = DATA_DIR / "gene_perturbation"
ORIG_DIR = DATA_DIR / "original"
METADATA_DIR = DB_DIR.parent / "public" / "metadata"

D = "::"  # canonical delimiter


def load_metadata(filename: str) -> dict:
    path = METADATA_DIR / filename
    if not path.exists():
        print(f"  WARNING: metadata file not found: {path}")
        return {}
    with open(path) as f:
        return json.load(f)


def clean_na(val: str) -> str:
    """Convert literal 'NA', 'N/A', 'n/a', 'na' to empty string."""
    return "" if val.strip().upper() in ("NA", "N/A") else val


def strip_direction(term: str) -> tuple[str, str]:
    """Strip direction suffix, return (body, suffix_with_space)."""
    for suffix in (" up", " down", " dn"):
        if term.endswith(suffix):
            return term[: -len(suffix)], suffix
    return term, ""


# Descriptor keywords for splitting "CELLLINE descriptor" strings
_RUMMAGEO_DESCRIPTORS = (
    # Cancers/tumors (allow compound words like osteosarcoma)
    r'(?:[\w]*(?:cancer|tumor|tumour|carcinoma|sarcoma|lymphoma|leukemia|leukaemia|melanoma|glioma|glioblastoma|adenoma|mesothelioma|neuroblastoma|adenocarcinoma|hepatoma|myeloma|blastoma))'
    r'|(?:'
    # Cell types
    r'fibroblast|epithelial|endothelial|macrophage|monocyte|astrocyte|neuron|neuronal|hepatocyte|keratinocyte|adipocyte|myoblast|myocyte|chondrocyte|osteoblast|osteocyte|lymphocyte'
    r'|stem\s*cell|progenitor|precursor|endometri\w+'
    # Tissues/organs
    r'|kidney|liver|lung|brain|breast|colon|colorectal|pancrea\w*|prostate|ovary|ovarian|skin|bone|blood|muscle|heart|spleen|thymus|gastric|bladder|cervical|uterine|renal|hepatic|pulmonary|mammary|intestin\w*|thyroid|adrenal|pituitary|placenta\w*'
    # Cell biology terms
    r'|pre-?adipocyte|iPSC|ESC|iPS|mESCs?|hESCs?|organoid|spheroid|primary'
    # Modifications/variants
    r'|WT|wild.?type|KO|knockout|knock-out|KD|knockdown|knock-down|mutant|resistant|sensitive|parental'
    r'|stably|transfect\w*|overexpress\w*|shRNA|siRNA|CRISPR|clone|sub-?clone'
    r'|human|mouse|murine|rat|porcine|bovine|canine|feline'
    r')'
)


def clean_rummageo_cell(val: str) -> tuple[str, str]:
    """Extract (cell_line, cell_type) from descriptive RummaGEO cell_line values.

    Handles patterns like:
      "colorectal cancer cell line SW837"  -> ("SW837", "colorectal cancer")
      "HeLa (Human cervical carcinoma)"    -> ("HeLa", "Human cervical carcinoma")
      "4T1 breast cancer"                  -> ("4T1", "breast cancer")
      "SKOV3"                              -> ("SKOV3", "")
    """
    if not val or " " not in val:
        return val or "", ""

    val = val.strip()

    # Pattern 1: "... cell line(s) NAME"
    m = re.search(r'\bcell\s+lines?\s*\(?([A-Za-z0-9][\w\-\.\/\+]+)\)?\s*$', val, re.I)
    if m:
        name = m.group(1)
        desc = re.sub(r'\s*\bcell\s+lines?\s*$', '', val[:m.start()], flags=re.I).strip()
        return name, desc

    # Pattern 1b: "CELLLINE cell line(s)" with no name after
    m = re.match(r'^([\w][\w\-\.\/\(\)\+\#]*)\s+cell\s+lines?\s*$', val, re.I)
    if m:
        return m.group(1), ""

    # Pattern 2: "NAME (description)" — match last parenthetical group
    m = re.match(r'^(.+?)\s+\(([^)]+)\)\s*$', val)
    if m:
        name = m.group(1).strip()
        desc = re.sub(r'\s*\bcell\s+lines?\s*$', '', m.group(2), flags=re.I).strip()
        return name, desc

    # Pattern 3: "CELLLINE descriptor_word..." — split at first descriptor keyword
    m = re.search(r'\s+(' + _RUMMAGEO_DESCRIPTORS + r')', val, re.I)
    if m and m.start() > 0:
        name = val[:m.start()].strip()
        desc = val[m.start():].strip()
        if len(name) <= 30 and re.match(r'^[\w][\w\-\.\/\(\)\+\#]*$', name):
            return name, desc

    return val, ""


# =============================================================================
# Per-dataset transformers
# Each returns the canonical term (with direction suffix preserved).
# =============================================================================


def transform_lincs_l1000_cp(term: str) -> str:
    """ABY001_A375_XH_A13_afatinib_10uM up -> afatinib::A375::::XH::10uM::ABY001::A13 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 6:
        batch, cell_line, timepoint, batch2, perturbation = parts[0], parts[1], parts[2], parts[3], parts[4]
        concentration = parts[5] if len(parts) > 5 else ""
        canonical = D.join([perturbation, cell_line, "", timepoint, concentration, batch, batch2])
    else:
        canonical = body  # fallback
    return canonical + direction


def transform_tahoe(term: str, organ_map: dict) -> str:
    """(R)-Verapamil (hydrochloride)_0.05uM_A-172 up -> (R)-Verapamil (hydrochloride)::A-172::CNS/Brain::24h::0.05uM up"""
    body, direction = strip_direction(term)
    # Split from end: last part is cellLine, second-to-last is concentration, rest is perturbation
    parts = body.split("_")
    if len(parts) >= 3:
        cell_line = parts[-1]
        concentration = parts[-2]
        perturbation = "_".join(parts[:-2])
        cell_type = organ_map.get(cell_line, "")
        canonical = D.join([perturbation, cell_line, cell_type, "24h", concentration])
    else:
        canonical = body
    return canonical + direction


def transform_nibr(term: str) -> str:
    """Diphenidol_AF-80-QK39_batchid1_0.01uM_24h up -> Diphenidol::U2OS::::24h::0.01uM::AF-80-QK39::batchid1 up
    Oprea1_571617_OC-41-DF58_batchid1_0.01uM_24h up -> Oprea1::U2OS::::24h::0.01uM::571617_OC-41-DF58::batchid1 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    # Standard: perturbation_nsn_batch_concentration_timepoint (5 parts)
    # Extended: perturbation_nsn1_nsn2_batch_concentration_timepoint (6 parts, 2-part NSN)
    if len(parts) == 6:
        perturbation, nsn1, nsn2, batch, concentration, timepoint = parts
        nsn = f"{nsn1}_{nsn2}"
        canonical = D.join([perturbation, "U2OS", "", timepoint, concentration, nsn, batch])
    elif len(parts) >= 5:
        perturbation, nsn, batch, concentration, timepoint = parts[0], parts[1], parts[2], parts[3], parts[4]
        canonical = D.join([perturbation, "U2OS", "", timepoint, concentration, nsn, batch])
    else:
        canonical = body
    return canonical + direction


GINKGO_CELL_LINES = {"A549"}

def transform_ginkgo(term: str) -> str:
    """A549-SC_514-1000-24 up -> SC_514::A549::::24h::1uM up
    human_dermal_fibroblast-(S)-(+)-Camptothecin-3000-24 up -> (S)-(+)-Camptothecin::::human_dermal_fibroblast::24h::3uM up"""
    body, direction = strip_direction(term)
    parts = body.split("-")
    if len(parts) >= 4:
        cell_val = parts[0]
        timepoint = parts[-1] + "h"
        # Raw values are in nM; convert to uM
        conc_nm = float(parts[-2])
        conc_um = conc_nm / 1000
        concentration = f"{conc_um:g}uM"
        perturbation = "-".join(parts[1:-2])
        if cell_val in GINKGO_CELL_LINES:
            cell_line, cell_type = cell_val, ""
        else:
            cell_line, cell_type = "", cell_val
        canonical = D.join([perturbation, cell_line, cell_type, timepoint, concentration])
    else:
        canonical = body
    return canonical + direction


def transform_deepcover(term: str) -> str:
    """(4-Chlorobenzyl)pyridine up -> (4-Chlorobenzyl)pyridine::HCT116::::24h::10uM up"""
    body, direction = strip_direction(term)
    # Entire body is the perturbation; fixed cell line/timepoint/concentration
    canonical = D.join([body, "HCT116", "", "24h", "10uM"])
    return canonical + direction


def transform_sciplex(term: str) -> str:
    """A549_2-Methoxyestradiol_100nM_24h up -> 2-Methoxyestradiol::A549::::24h::100nM up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 4:
        cell_line, perturbation, concentration, timepoint = parts[0], parts[1], parts[2], parts[3]
        canonical = D.join([perturbation, cell_line, "", timepoint, concentration])
    else:
        canonical = body
    return canonical + direction


def transform_microarrays_cmap(term: str) -> str:
    """metformin_10uM_MCF7_6h_batch1 up -> metformin::MCF7::::6h::10uM::batch1 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 5:
        perturbation, concentration, cell_line, timepoint, batch = parts[0], parts[1], parts[2], parts[3], parts[4]
        canonical = D.join([perturbation, cell_line, "", timepoint, concentration, batch])
    else:
        canonical = body
    return canonical + direction


def transform_creeds_chem(term: str) -> str:
    """Fluorouracil_mus musculus_Bone marrow..._GSE1559.3639 up -> Fluorouracil::::Bone marrow...::::::::mus musculus::GSE1559.3639 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 4:
        perturbation, organism, cell_type, geo_id = parts[0], parts[1], "_".join(parts[2:-1]), parts[-1]
        canonical = D.join([perturbation, "", clean_na(cell_type), "", "", organism, geo_id])
    else:
        canonical = body
    return canonical + direction


def transform_rummageo_chem(term: str, metadata: dict) -> str:
    """GSE100217_1_v_0_ethanol_mouse up -> ethanol::{cellLine}::{cellType}::{timepoint}::::mouse::GSE100217::1::0 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 6:
        gse, sample_a, _v, sample_b, perturbation, organism = parts[0], parts[1], parts[2], parts[3], "_".join(parts[4:-1]), parts[-1]
        # Look up metadata
        lookup_key = f"{gse}-{sample_a}"
        meta = metadata.get(lookup_key, {})
        cell_line = meta.get("cell_line") or ""
        cell_type = meta.get("cell_type") or ""
        timepoint = meta.get("timepoint") or ""
        # Clean descriptive cell_line values
        if cell_line and " " in cell_line:
            cell_line, extracted_type = clean_rummageo_cell(cell_line)
            if extracted_type and not cell_type:
                cell_type = extracted_type
        canonical = D.join([perturbation, cell_line, cell_type, timepoint, "", organism, gse, sample_a, sample_b])
    else:
        canonical = body
    return canonical + direction


def transform_lincs_l1000_xpr(term: str) -> str:
    """XPR040_SNU761.311_96H_E03_BRDN0001484943 up -> BRDN0001484943::SNU761.311::::96H::::XPR040::E03 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 5:
        batch, cell_line, timepoint, batch2, perturbation = parts[0], parts[1], parts[2], parts[3], parts[4]
        canonical = D.join([perturbation, cell_line, "", timepoint, "", batch, batch2])
    else:
        canonical = body
    return canonical + direction


def transform_replogle(term: str) -> str:
    """10023_ZC3H18_P1P2_K562_day6_essential up -> ZC3H18::K562::::day6::::P1P2::essential::10023 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 6:
        id_, perturbation, batch, cell_line, timepoint, screen = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
        canonical = D.join([perturbation, cell_line, "", timepoint, "", batch, screen, id_])
    else:
        canonical = body
    return canonical + direction


def clean_perturb_atlas_cell(val: str) -> tuple[str, str]:
    """Extract (cell_line, cell_type) from Perturb Atlas cell_line values.

    Returns a real cell line name in cell_line only when a recognizable name
    (uppercase/alphanumeric code like K562, MDA-MB-231) can be extracted.
    Descriptive values (macrophage, human umbilical vein endothelial cells,
    skin, liver, etc.) go to cell_type.
    """
    if not val:
        return "", ""
    val = val.replace("\\,", ",").strip()

    # No spaces and no parens -> check if it looks like a cell line name
    if " " not in val and "(" not in val:
        if _is_cell_line_name(val):
            return val, ""
        return "", val

    # Pattern: 'NAME (description)' or 'NAME(description)'
    m = re.match(r"^([A-Z0-9][A-Za-z0-9\-\.\/\+\#]*)\s*\(([^)]+)\)\s*$", val)
    if m and _is_cell_line_name(m.group(1)):
        return m.group(1), m.group(2)

    # Pattern: 'description (NAME)' — trailing parenthetical cell line
    m = re.search(r"\(([A-Z0-9][A-Za-z0-9\-\.\/\+\#]*)\)\s*$", val)
    if m and _is_cell_line_name(m.group(1)):
        return m.group(1), val[: m.start()].strip()

    # Pattern: '... cell line(s) NAME'
    m = re.search(
        r"\bcell\s+lines?\s+([A-Z0-9][A-Za-z0-9\-\.\/\+\#]*)\s*$", val, re.I
    )
    if m and _is_cell_line_name(m.group(1)):
        return m.group(1), val[: m.start()].strip()

    # Pattern: '... cell(s) NAME'
    m = re.search(r"\bcells?\s+([A-Z0-9][A-Za-z0-9\-\.\/\+\#]*)\s*$", val)
    if m and _is_cell_line_name(m.group(1)):
        return m.group(1), val[: m.start(1)].strip()

    # Pattern: trailing uppercase cell line name (2+ chars)
    m = re.search(r"\s([A-Z][A-Z0-9\-\.\/]+)\s*$", val)
    if m and _is_cell_line_name(m.group(1)):
        desc = re.sub(r"^\((.+)\)$", r"\1", val[: m.start()].strip()).strip()
        return m.group(1), desc

    # Pattern: first word is cell line code + rest
    m = re.match(r"^([A-Z0-9][A-Za-z0-9\-\.]*)\s+(.+)$", val)
    if m and _is_cell_line_name(m.group(1)):
        name, rest = m.group(1), m.group(2)
        # Short non-biological qualifier → compound cell line name
        if len(rest) <= 15 and not _PERTURB_ATLAS_BIO_RE.search(rest):
            return val, ""
        return name, rest

    return "", val


# Helpers for clean_perturb_atlas_cell
_PERTURB_ATLAS_BIO_RE = re.compile(
    r"\b(?:cells?|cancer|tumor|tumour|carcinoma|kidney|brain|liver|lung|breast"
    r"|colon|blood|tissue|skin|muscle|bone|fibroblast|macrophage|epithelial"
    r"|endothelial|stem|embryo\w*|primary|organoid)\b",
    re.I,
)


def _is_cell_line_name(name: str) -> bool:
    """Check if a string looks like a cell line name (e.g. K562, MDA-MB-231)."""
    return bool(
        re.match(r"^[A-Z0-9][A-Za-z0-9\-\.\/\+\#]*$", name)
        and 2 <= len(name) <= 20
        and re.search(r"[A-Za-z]", name)
        and "cell" not in name.lower()
    )


def transform_perturb_atlas(term: str, metadata: dict) -> str:
    """Perturb_10000_KD_CPSF6_SRP013565 up -> CPSF6::{cellLine}::{cellType}::::::KD::SRP013565::10000 up

    Extracts a recognizable cell line name (e.g. K562, MDA-MB-231) from the
    metadata cell_line field.  Descriptive values that aren't real cell line
    names (e.g. macrophage, liver) go into the cellType position instead.
    """
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 5:
        prefix, id_, pert_type, perturbation, dataset = parts[0], parts[1], parts[2], parts[3], parts[4]
        lookup_key = f"{prefix}-{id_}"
        meta = metadata.get(lookup_key, {})
        cell_val = meta.get("cell_line") or ""
        cell_line, cell_type = clean_perturb_atlas_cell(cell_val)
        canonical = D.join([perturbation, cell_line, cell_type, "", "", pert_type, dataset, id_])
    else:
        canonical = body
    return canonical + direction


def transform_creeds_gene(term: str) -> str | None:
    """Foxo1_KO_mus musculus_T reg_GSE40655.508 up -> Foxo1::::T reg::::::::KO::mus musculus::GSE40655.508 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 5:
        perturbation, pert_type, organism, cell_type, geo_id = parts[0], parts[1], parts[2], "_".join(parts[3:-1]), parts[-1]
        if perturbation == "None":
            return None
        canonical = D.join([perturbation, "", clean_na(cell_type), "", "", pert_type, organism, geo_id])
    else:
        canonical = body
    return canonical + direction


def transform_rummageo_gene(term: str, metadata: dict) -> str:
    """GSE100102_0_v_5_cgas_mouse up -> cgas::{cellLine}::{cellType}::{timepoint}::::mouse::GSE100102::0::5 up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) >= 6:
        gse, sample_a, _v, sample_b, perturbation, organism = parts[0], parts[1], parts[2], parts[3], "_".join(parts[4:-1]), parts[-1]
        lookup_key = f"{gse}-{sample_a}"
        meta = metadata.get(lookup_key, {})
        cell_line = meta.get("cell_line") or ""
        cell_type = meta.get("cell_type") or ""
        timepoint = meta.get("timepoint") or ""
        # Clean descriptive cell_line values
        if cell_line and " " in cell_line:
            cell_line, extracted_type = clean_rummageo_cell(cell_line)
            if extracted_type and not cell_type:
                cell_type = extracted_type
        canonical = D.join([perturbation, cell_line, cell_type, timepoint, "", organism, gse, sample_a, sample_b])
    else:
        canonical = body
    return canonical + direction


def write_gmt_gz(output_path: Path, entries: list[tuple[str, str, list[str]]]):
    """Write a list of (term, description, genes) to a gmt.gz file."""
    with gzip.open(output_path, "wt") as f:
        for term, desc, genes in entries:
            f.write(f"{term}\t{desc}\t" + "\t".join(genes) + "\n")


def process_gmt(
    input_path: Path,
    output_path: Path,
    transform_fn,
    library_name: str,
    dry_run: bool = False,
):
    """Read a GMT, transform all terms, write output."""
    entries = []
    count = 0
    failures = 0

    skipped = 0
    for (term, desc), genes in read_gmt(input_path):
        count += 1
        try:
            new_term = transform_fn(term)
            if new_term is None:
                skipped += 1
                continue
            entries.append((new_term, desc, genes))
        except Exception as e:
            failures += 1
            if failures <= 3:
                print(f"  FAIL: {term} -> {e}")
            entries.append((term, desc, genes))  # keep original on failure

    if not dry_run:
        write_gmt_gz(output_path, entries)

    if skipped:
        print(f"  {library_name}: {count} terms, {failures} failures, {skipped} skipped")
    else:
        print(f"  {library_name}: {count} terms, {failures} failures")
    if entries:
        # Show first example
        print(f"    Example: {entries[0][0]}")
    return count, failures


def main():
    parser = argparse.ArgumentParser(description="Canonicalize GMT term formats")
    parser.add_argument("--dry-run", action="store_true", help="Don't write output files")
    parser.add_argument("--skip-archive", action="store_true", help="Don't copy originals to archive")
    args = parser.parse_args()

    # Load metadata files
    print("Loading metadata files...")
    rummageo_meta = load_metadata("rummageo_metadata.json")
    perturbatlas_meta = load_metadata("perturbatlas_metadata.json")
    tahoe_organ_path = Path(__file__).parent / "tahoe_cell_organ.json"
    tahoe_organ_meta = json.loads(tahoe_organ_path.read_text()) if tahoe_organ_path.exists() else {}
    print(f"  RummaGEO: {len(rummageo_meta)} entries")
    print(f"  PerturbAtlas: {len(perturbatlas_meta)} entries")
    print(f"  Tahoe cell→organ: {len(tahoe_organ_meta)} entries")

    # Archive originals
    if not args.dry_run and not args.skip_archive:
        print("\nArchiving originals...")
        for src_dir, dest_dir in [
            (DRUG_DIR, ORIG_DIR / "drug_perturbation"),
            (GENE_DIR, ORIG_DIR / "gene_perturbation"),
        ]:
            dest_dir.mkdir(parents=True, exist_ok=True)
            for f in src_dir.glob("*.gmt.gz"):
                dest = dest_dir / f.name
                if not dest.exists():
                    shutil.copy2(f, dest)
                    print(f"  Archived: {f.name}")
                else:
                    print(f"  Already archived: {f.name}")

    # Define all transformations
    drug_transforms = [
        ("lincs-l1000-cp", transform_lincs_l1000_cp),
        ("tahoe-100m", lambda term: transform_tahoe(term, tahoe_organ_meta)),
        ("nibr-drug-seq", transform_nibr),
        ("ginkgo-bioworks", transform_ginkgo),
        ("deepcover-moa", transform_deepcover),
        ("sciplex", transform_sciplex),
        ("microarrays-cmap", transform_microarrays_cmap),
        ("creeds-chem", transform_creeds_chem),
        ("rummageo-chem", lambda term: transform_rummageo_chem(term, rummageo_meta)),
    ]

    gene_transforms = [
        ("lincs-l1000-xpr", transform_lincs_l1000_xpr),
        ("replogle-perturb-seq", transform_replogle),
        ("perturb-atlas-human", lambda term: transform_perturb_atlas(term, perturbatlas_meta)),
        ("perturb-atlas-mouse", lambda term: transform_perturb_atlas(term, perturbatlas_meta)),
        ("creeds-gene", transform_creeds_gene),
        ("rummageo-gene", lambda term: transform_rummageo_gene(term, rummageo_meta)),
    ]

    total_terms = 0
    total_failures = 0

    print("\n=== Drug Perturbation Libraries ===")
    for name, transform_fn in drug_transforms:
        input_path = ORIG_DIR / "drug_perturbation" / f"{name}.gmt.gz" if not args.skip_archive else DRUG_DIR / f"{name}.gmt.gz"
        if not args.skip_archive and not input_path.exists():
            # Fallback to current location if archive doesn't exist yet
            input_path = DRUG_DIR / f"{name}.gmt.gz"
        output_path = DRUG_DIR / f"{name}.gmt.gz"
        if not input_path.exists():
            print(f"  SKIP: {name} (file not found: {input_path})")
            continue
        n, f = process_gmt(input_path, output_path, transform_fn, name, args.dry_run)
        total_terms += n
        total_failures += f

    print("\n=== Gene Perturbation Libraries ===")
    for name, transform_fn in gene_transforms:
        input_path = ORIG_DIR / "gene_perturbation" / f"{name}.gmt.gz" if not args.skip_archive else GENE_DIR / f"{name}.gmt.gz"
        if not args.skip_archive and not input_path.exists():
            input_path = GENE_DIR / f"{name}.gmt.gz"
        output_path = GENE_DIR / f"{name}.gmt.gz"
        if not input_path.exists():
            print(f"  SKIP: {name} (file not found: {input_path})")
            continue
        n, f = process_gmt(input_path, output_path, transform_fn, name, args.dry_run)
        total_terms += n
        total_failures += f

    print(f"\n=== Summary ===")
    print(f"Total terms: {total_terms}")
    print(f"Total failures: {total_failures}")
    if args.dry_run:
        print("(DRY RUN - no files written)")


if __name__ == "__main__":
    main()
