"""
Shared helpers for input downloaders in db/etl/inputs/.

Canonical output format: perturbation::cellLine::cellType::timepoint::concentration[::extras] up|down
at db/data/{drug,gene}_perturbation/<dataset>.gmt.gz.
"""
import gzip
import json
from collections import Counter
from functools import lru_cache
import urllib.request
from pathlib import Path

# Canonical output dir (services/db/data) — single source of truth, resolved by the ingest runtime.
from perturbseqr_ingest.db_utils import DATA_DIR as _DATA_DIR

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
DRUG_OUTPUT = _DATA_DIR / "drug_perturbation"
GENE_OUTPUT = _DATA_DIR / "gene_perturbation"
METADATA_DIR = _DATA_DIR / "metadata"

HARMONIZOME_BASE = "https://maayanlab.cloud/static/hdfs/harmonizome/data"
CREEDS_BASE = "https://maayanlab.cloud/CREEDS/download"

# Canonical term format constants
TERM_DELIMITER = "::"      # field delimiter

# Gene perturbation terms carry two canonical fields after concentration:
#   [5] perturbation_type   — what was done to the gene (KO/KD/KI/OE/Mut); BLANK when unknown
#   [6] perturbation_method — how it was done (CRISPRi/Cas9/shRNA/...);    BLANK when unknown
# Unknown is represented as an empty field.

CANONICAL_GENE_PERTURBATION_TYPES = frozenset({"KO", "KD", "KI", "OE", "Mut"})
CANONICAL_GENE_PERTURBATION_METHODS = frozenset({
    "CRISPRi", "CRISPRa", "Cas9", "shRNA", "siRNA", "RNAi", "transgenic",
})

PERTURBATION_TYPE_SYNONYMS = {
    "ko": "KO", "knockout": "KO", "deficiency": "KO", "deletion": "KO",
    "null mutation": "KO", "null allele": "KO",
    "kd": "KD", "knockdown": "KD", "depletion": "KD",
    "ki": "KI", "knock in": "KI", "knockin": "KI",
    "oe": "OE", "overexpression": "OE", "activation": "OE",
    "mut": "Mut", "mutant": "Mut", "active mutant": "Mut", "activemutant": "Mut",
    "point mutation": "Mut", "missense": "Mut",
}
# Keyword-substring fallback for the CREEDS long tail — values like "CAG knock-in",
# "Partial Depletion", "Mutation - D77G point mutation".
PERTURBATION_TYPE_KEYWORDS = [
    ("knock in", "KI"), ("knockin", "KI"),
    ("knockout", "KO"), ("knock out", "KO"), ("deficiency", "KO"),
    ("deletion", "KO"), ("null", "KO"),
    ("knockdown", "KD"), ("knock down", "KD"), ("depletion", "KD"),
    ("deplet", "KD"), ("down expression", "KD"), ("repression", "KD"), ("silenc", "KD"),
    ("overexpression", "OE"), ("over expression", "OE"), ("overexpress", "OE"),
    ("induction", "OE"), ("induced expression", "OE"), ("activation", "OE"),
    ("mutation", "Mut"), ("mutant", "Mut"), ("missense", "Mut"),
]
# Genuinely ambiguous / non-informative → blank (these don't warn).
_AMBIGUOUS_PERTURBATION_TYPE = {"inhibition", "druginhibition", "unknown", ""}


def normalize_perturbation_type(raw: str | None) -> str:
    """Map a raw perturbation-type string to a canonical value, or "" if it doesn't
    map cleanly."""
    if raw is None:
        return ""
    raw = raw.strip()
    if "|" in raw:
        return "|".join(normalize_perturbation_type(part) for part in raw.split("|"))
    key = raw.lower().replace("-", " ").replace("_", " ").strip()
    if key in PERTURBATION_TYPE_SYNONYMS:
        return PERTURBATION_TYPE_SYNONYMS[key]
    for kw, pert_type in PERTURBATION_TYPE_KEYWORDS:
        if kw in key:
            return pert_type
    if key not in _AMBIGUOUS_PERTURBATION_TYPE:
        print(f"  WARN normalize_perturbation_type: unrecognized value {raw!r} → blank")
    return ""


def normalize_perturbation_method(raw: str | None) -> str:
    """Map a raw perturbation-method string to a canonical value, or "" if it doesn't
    map cleanly."""
    if raw is None:
        return ""
    key = raw.strip()
    for m in CANONICAL_GENE_PERTURBATION_METHODS:
        if key.lower() == m.lower():
            return m
    return ""


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
    """Read a GMT (gzipped or plain) into {'term[ direction]\\tdesc': [genes]}. Pass `direction`
    to append ' up' / ' down' when the source encodes direction in the filename, not the term."""
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
    """Merge up + down GMTs into one file, pairing siblings on adjacent lines. `transform_fn`
    (optional) rewrites each direction-tagged term into canonical ::-format. Returns lines written."""
    up = load_gmt_dict(up_path, direction="up")
    dn = load_gmt_dict(down_path, direction="down")

    # Walk up-keys first (each followed by its dn sibling if present), then unpaired dn keys.
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
    `transform_fn` (optional) is applied per term during merge to rewrite source terms to canonical ::-format."""
    up = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_up_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_up_crisp.gmt.gz", no_cache=no_cache)
    dn = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_dn_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_dn_crisp.gmt.gz", no_cache=no_cache)
    n = merge_up_down(up, dn, output_path, transform_fn=transform_fn)
    print(f"  {output_path.name}: {n} terms")
    return output_path


def standardize_gmt(intermediate_path: Path, final_path: Path,
                    parse_organism=lambda _k: "human") -> int:
    """Stage C: PC filter the intermediate GMT (with mouse→human ortholog mapping via
    `parse_organism(key) -> 'human'|'mouse'|...`) and write to final_path. Returns terms written."""
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


# Protein-coding DEG filter (cross-dataset concern).
# Every ETL dataset should route DEGs through this filter.
#
# Output gene-name contract: uppercase, and present in NCBI gene_info for a PC gene
# (either the Symbol itself or any synonym). Gene set members pass through verbatim —
# no alias-to-current-Symbol rename. 
#
# Species: human + mouse. Mouse DEGs go through MGI homology to the human ortholog.
# Everything else (rat, zebrafish, unknown) is dropped.

_HUMAN_ALIASES = {"homo sapiens", "human"}
_MOUSE_ALIASES = {"mus musculus", "mouse"}


@lru_cache(maxsize=4)
def _protein_coding_genes(organism: str, cache_dir: Path) -> frozenset[str]:
    """UPPERCASE Symbol ∪ synonyms for every protein-coding gene of `organism`."""
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    df = ncbi_genes_fetch(organism=organism, cache_dir=str(cache_dir))
    out = set()
    for _, row in df.iterrows():
        out.add(row["Symbol"].upper())
        out.update(s.upper() for s in row["All_synonyms"])
    return frozenset(out)


@lru_cache(maxsize=4)
def _non_protein_coding_genes(organism: str, cache_dir: Path) -> frozenset[str]:
    """UPPERCASE Symbol ∪ synonyms for every NON-protein-coding gene (lncRNA, pseudogene, etc.)."""
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    df = ncbi_genes_fetch(organism=organism,
                          filters=lambda d: d["type_of_gene"] != "protein-coding",
                          cache_dir=str(cache_dir))
    out = set()
    for _, row in df.iterrows():
        out.add(row["Symbol"].upper())
        out.update(s.upper() for s in row["All_synonyms"])
    return frozenset(out)


@lru_cache(maxsize=2)
def _mouse_to_human_ortholog(cache_dir: Path) -> dict[str, str]:
    """{mouse gene (UPPER) → human Symbol (UPPER)} via MGI homology. Ambiguous mouse
    synonyms (mapping to multiple mouse Symbols) drop — orthology needs an unambiguous source."""
    from maayanlab_bioinformatics.harmonization import mouse_human_homologs
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch

    mouse_df = ncbi_genes_fetch(organism="Mammalia/Mus_musculus", cache_dir=str(cache_dir))
    pairs = [(s.upper(), row["Symbol"].upper())
             for _, row in mouse_df.iterrows()
             for s in row["All_synonyms"]]
    counts = Counter(a for a, _ in pairs)
    mouse_alias_to_sym = {a: s for a, s in pairs if counts[a] == 1 or a == s}

    mgi = mouse_human_homologs(uppercase=True)  # columns: mouse, human (both UPPER)
    mouse_sym_to_human = dict(zip(mgi["mouse"], mgi["human"]))
    human_pc = _protein_coding_genes("Mammalia/Homo_sapiens", cache_dir)
    return {alias: h for alias, m_sym in mouse_alias_to_sym.items()
            if (h := mouse_sym_to_human.get(m_sym)) in human_pc}


def filter_to_human_pc(
    gmt: dict[str, list[str]], parse_organism, cache_dir: Path,
) -> dict[str, list[str]]:
    """Keep human gene set members unless they're known non-PC. Unknown human symbols
    (retired placeholders like LOC*/FLJ*/KIAA*/MGC*/C*orf*) pass through verbatim so no
    information is silently lost. Translate mouse genes to their human ortholog via MGI.
    Drop other organisms entirely. Per-term DEGs are uppercased + deduped; terms empty
    after filter drop."""
    print("  Loading NCBI gene_info + MGI homologs (cached after first run)...")
    human_non_pc = _non_protein_coding_genes("Mammalia/Homo_sapiens", cache_dir)
    mouse_to_human = _mouse_to_human_ortholog(cache_dir)
    print(f"    Human non-PC (drop set): {len(human_non_pc):,} | Mouse→human ortholog: {len(mouse_to_human):,}")

    out: dict[str, list[str]] = {}
    n_unsupported = n_empty = 0
    for key, genes in gmt.items():
        org = parse_organism(key).strip().lower()
        if org in _HUMAN_ALIASES:
            mapped = list(dict.fromkeys(g for g_raw in genes
                                        if (g := g_raw.upper()) and g not in human_non_pc))
        elif org in _MOUSE_ALIASES:
            mapped = list(dict.fromkeys(h for g in genes
                                        if (h := mouse_to_human.get(g.upper()))))
        else:
            n_unsupported += 1
            continue
        if mapped:
            out[key] = mapped
        else:
            n_empty += 1
    print(f"  Dropped {n_unsupported} unsupported-organism + {n_empty} empty-after-filter signatures")
    return out