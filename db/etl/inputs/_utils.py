# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
Shared helpers for input downloaders in db/etl/inputs/.

I/O
    - download_to()                  — download a URL to a local path, with cache-skip
    - merge_up_down()                — concat up + dn GMTs into one file, applying an optional per-term transform
    - harmonizome_paired_download()  — download + merge a Harmonizome slug in one call
    - load_metadata()                — JSON metadata file loader (raises FileNotFoundError if missing)
    - load_gmt_dict()                — parse a (gzipped) GMT into {term[ direction]\\tdesc: [genes]}

Canonical-format helpers
    - strip_direction()              — split a term into (body, ' up'/' down'/' dn'/'')
    - filter_to_human_pc()           — DEG filter (mouse/rat → human ortholog, drop non-protein-coding)
                                       used cross-dataset; keeps every signature whose post-filter DEG set is non-empty

Outputs: GMT in canonical perturbation::cellLine::cellType::timepoint::concentration[::extras] up|down
format at db/data/{drug,gene}_perturbation/<dataset>.gmt.gz.

Pipeline: shared helpers, not directly runnable. Imported by per-dataset downloaders
that run as ETL stage 0 (input acquisition); their outputs are validated by
format_verification.py (now a test) and consumed by ingest + standardize_names.
"""
import gzip
import json
from collections import Counter
from functools import lru_cache
import urllib.request
from pathlib import Path


INPUTS_DIR = Path(__file__).parent
CACHE_DIR = INPUTS_DIR / "_cache"
# Per-dataset 3-stage output convention:
#   Stage A: raw upstream → CACHE_DIR (db/etl/inputs/_cache/)
#   Stage B: canonical ::-format, NOT yet PC-filtered/renamed → INTERMEDIATE_DIR (db/etl/intermediate/)
#   Stage C: standardized (PC filter + alias-resolved + ortholog-mapped) → _DATA_DIR (db/data/)
# Stage C output is what ingest reads and what gets rcloned to MinIO.
INTERMEDIATE_DIR = INPUTS_DIR.parent / "intermediate"
DRUG_INTERMEDIATE = INTERMEDIATE_DIR / "drug_perturbation"
GENE_INTERMEDIATE = INTERMEDIATE_DIR / "gene_perturbation"
_DATA_DIR = INPUTS_DIR.parent.parent / "data"
DRUG_OUTPUT = _DATA_DIR / "drug_perturbation"
GENE_OUTPUT = _DATA_DIR / "gene_perturbation"
METADATA_DIR = _DATA_DIR / "metadata"

HARMONIZOME_BASE = "https://maayanlab.cloud/static/hdfs/harmonizome/data"
CREEDS_BASE = "https://maayanlab.cloud/CREEDS/download"

# Canonical term format constants
D = "::"           # field delimiter


def strip_direction(term: str) -> tuple[str, str]:
    """Split a term into (body, direction_suffix). direction_suffix is ' up'/' down'/' dn' or ''."""
    for suffix in (" up", " down", " dn"):
        if term.endswith(suffix):
            return term[: -len(suffix)], suffix
    return term, ""




def append_to_description(upstream: str, addition: str) -> str:
    """Comma-append `addition` to GMT description `upstream`. Skip only when the two are
    exactly equal (avoids the redundant `"BRD-K, BRD-K"` case)."""
    upstream = upstream.strip()
    addition = addition.strip()
    if not addition:
        return upstream
    if not upstream or upstream == addition:
        return addition
    return f"{upstream}, {addition}"


def load_metadata(filename: str) -> dict:
    """Load a JSON metadata file from db/data/metadata/. Raises if missing."""
    path = METADATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Required metadata file not found: {path}\n"
            f"Place the file or pass an explicit empty dict to opt out of enrichment."
        )
    return json.loads(path.read_text())


def load_gmt_dict(path: Path, *, direction: str | None = None) -> dict[str, list[str]]:
    """Read a GMT (gzipped or plain) into {key: [genes]}, where key = 'term[ direction]\\tdesc'.

    Both columns are preserved because some sources (e.g. CREEDS) encode a canonical id in
    the description column while leaving the symbolic name in the term.

    If `direction` is given, append ' up' / ' down' to the term portion of every key —
    Harmonizome's up/dn GMTs carry direction in the filename, not the term.
    """
    opener = gzip.open if str(path).endswith(".gz") else open
    out: dict[str, list[str]] = {}
    with opener(path, "rt") as f:
        for line in f:
            parts = line.rstrip("\r\n").split("\t")
            if len(parts) < 3: # term, desc, and at least one gene are required for a valid line
                continue
            term, desc, *genes = parts
            if direction:
                term = f"{term} {direction}"
            out[f"{term}\t{desc}"] = [g for g in genes if g]
    return out


def download_to(url: str, dest: Path, *, no_cache: bool = False) -> Path:
    """Download `url` to `dest`. Skip if cached unless no_cache=True. Raises on HTTP errors."""
    if dest.exists() and not no_cache:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    return dest


def merge_up_down(up_path: Path, down_path: Path, output_path: Path,
                  *, transform_fn=None) -> int:
    """Merge up + down GMTs into one file, pairing siblings on adjacent lines.

    Assumes input terms are NOT already direction-suffixed (Harmonizome encodes
    direction in the filename). 
    
    transform_fn (optional) rewrites each direction-tagged term into our canonical ::-delimited 
    format since each dataset has its own raw term shape (underscore-packed strings, dataset-specific field ordering, etc.).
    
    Returns lines written.
    """
    up = load_gmt_dict(up_path, direction="up")
    dn = load_gmt_dict(down_path, direction="down")

    # up keys look like "term up\tdesc"; paired dn key is "term down\tdesc".
    # Fill `ordered` by walking up keys first (each followed by its dn sibling if present),
    # then appending any dn keys that have no up counterpart. 
    ordered: list[str] = []
    paired_dn: set[str] = set()
    for up_key in up:
        ordered.append(up_key)
        dn_sibling = up_key.replace(" up\t", " down\t", 1)
        if dn_sibling in dn:
            ordered.append(dn_sibling)
            paired_dn.add(dn_sibling)
    ordered.extend(dn_key for dn_key in dn if dn_key not in paired_dn)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(output_path, "wt") as out:
        for k in ordered:
            genes = up.get(k) or dn[k]
            term, _, desc = k.partition("\t")
            if transform_fn is not None:
                result = transform_fn(term)
                if result is None:
                    continue
                # transform may return a string OR (term, description_addition) — append the
                # addition to the existing desc so e.g. NIBR can stash the NSN code in both
                # the term's last extra slot AND the desc column without conflicting.
                if isinstance(result, tuple):
                    term, desc = result[0], append_to_description(desc, result[1])
                else:
                    term = result
            out.write(f"{term}\t{desc}\t" + "\t".join(genes) + "\n")
            n += 1
    return n


def harmonizome_paired_download(slug: str, output_path: Path,
                                *, transform_fn=None, no_cache: bool = False) -> Path:
    """Download the Harmonizome up + dn GMTs for `slug`, merge, and write to output_path.

    `transform_fn` is applied per term during merge — pass it to convert source terms to
    the canonical ::-delimited format. Without it, terms keep their raw underscore form.

    URL pattern: https://maayanlab.cloud/static/hdfs/harmonizome/data/<slug>/gene_set_library_{up,dn}_crisp.gmt.gz
    """
    up = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_up_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_up_crisp.gmt.gz", no_cache=no_cache)
    dn = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_dn_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_dn_crisp.gmt.gz", no_cache=no_cache)
    n = merge_up_down(up, dn, output_path, transform_fn=transform_fn)
    print(f"  {output_path.name}: {n} terms")
    return output_path


def standardize_gmt(intermediate_path: Path, final_path: Path,
                    parse_organism=lambda _k: "human") -> int:
    """Stage C: read a canonical intermediate GMT, apply filter_to_human_pc, write the
    standardized result to final_path. Returns terms written (post-drop).

    `parse_organism(gmt_key) -> str` returns the organism for each term so multi-organism
    datasets (CREEDS) can route mouse DEGs through the ortholog map. Single-organism
    datasets default to human."""
    gmt = load_gmt_dict(intermediate_path)
    filtered = filter_to_human_pc(gmt, parse_organism, CACHE_DIR)
    final_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(final_path, "wt") as f:
        for key, genes in filtered.items():
            if not genes:
                continue
            term, _, desc = key.partition("\t")
            f.write(f"{term}\t{desc}\t" + "\t".join(genes) + "\n")
            n += 1
    print(f"  {final_path.name}: {n} terms (post-standardization)")
    return n


# ============================================================================
# Protein-coding DEG filter (cross-dataset concern)
# ============================================================================
# Every ETL dataset should route DEGs through this filter.
#
# Output gene-name contract: uppercase, current HGNC Official Symbol, protein-coding only.
#
# Species handling: human + mouse only. 
# Mouse DEGs go through MGI homology to land on current human PC Symbols. 
# Everything else (rat, zebrafish, unknown) is dropped.

_HUMAN_ALIASES = {"homo sapiens", "human"}
_MOUSE_ALIASES = {"mus musculus", "mouse"}


@lru_cache(maxsize=4)
def _pc_alias_map(organism: str, cache_dir: Path) -> dict[str, str]:
    """{alias → current Symbol} (UPPERCASE) for PC genes. Ambiguous aliases (NCBI
    synonyms pointing to multiple Symbols) are dropped unless the alias IS itself
    one of those Symbols (rummageo convention). See scratch/HGNC_PREV_SYMBOL_RESCUE.md
    for an HGNC-based ambiguity-rescue we evaluated and could re-enable later."""
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    df = ncbi_genes_fetch(organism=organism, cache_dir=str(cache_dir))
    pairs = [(s.upper(), row["Symbol"].upper())
             for _, row in df.iterrows()
             for s in row["All_synonyms"]]
    counts = Counter(alias for alias, _ in pairs)
    return {alias: sym for alias, sym in pairs if counts[alias] == 1 or alias == sym}


def filter_to_human_pc(
    gmt: dict[str, list[str]], parse_organism, cache_dir: Path,
) -> dict[str, list[str]]:
    """Filter every term's DEG list to human protein-coding symbols.

      - Human DEGs: alias → current human PC Symbol (resolves annotation drift).
      - Mouse DEGs: mouse alias → current mouse Symbol → human (MGI) → current human PC Symbol.
      - Any other organism (rat, zebrafish, unknown, …): signature dropped.
        Only ~10 CREEDS rat sigs hit this in practice; uniform drop avoids species-specific
        special cases while preventing e.g. rat `Actb` from silently surviving as human ACTB.
      - Non-PC DEGs drop implicitly (maps only contain PC entries).
      - Per-term DEGs are deduped; terms left empty after mapping are dropped.

    `parse_organism(gmt_key) -> str` returns the organism for that term.
    """
    from maayanlab_bioinformatics.harmonization import mouse_human_homologs

    print("  Loading NCBI gene_info + MGI homologs (cached after first run)...")
    human_pc = _pc_alias_map("Mammalia/Homo_sapiens", cache_dir)
    mouse_pc = _pc_alias_map("Mammalia/Mus_musculus", cache_dir)
    mgi = mouse_human_homologs(uppercase=True)  # columns: mouse, human (both UPPER)
    mouse_sym_to_human = dict(zip(mgi["mouse"], mgi["human"]))

    # Compose: mouse alias → current mouse Symbol → human Symbol → current human PC Symbol.
    # Drop alias if any link is missing.
    mouse_to_human_pc = {
        alias: h for alias, mouse_sym in mouse_pc.items()
        if (h := human_pc.get(mouse_sym_to_human.get(mouse_sym)))
    }
    print(f"    Human PC aliases: {len(human_pc):,} | Mouse→human: {len(mouse_to_human_pc):,}")

    out: dict[str, list[str]] = {}
    n_unsupported = n_empty = 0
    for key, genes in gmt.items():
        org = parse_organism(key).strip().lower()
        if org in _HUMAN_ALIASES:
            lookup = human_pc
        elif org in _MOUSE_ALIASES:
            lookup = mouse_to_human_pc
        else:
            n_unsupported += 1
            continue
        mapped = list(dict.fromkeys(s for g in genes if (s := lookup.get(g.upper()))))
        if mapped:
            out[key] = mapped
        else:
            n_empty += 1
    print(f"  Dropped {n_unsupported} unsupported-organism + {n_empty} empty-after-filter signatures")
    return out