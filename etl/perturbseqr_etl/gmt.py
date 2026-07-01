"""Shared GMT helper. Read, merge, and standardize gene-set libraries."""
import gzip
from pathlib import Path

from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.metadata.gene import filter_to_human_pc
from perturbseqr_etl.data_sources import CACHE_DIR, DRUG_OUTPUT, GENE_OUTPUT, TERM_DELIMITER

HARMONIZOME_BASE = "https://maayanlab.cloud/static/hdfs/harmonizome/data"


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


def merge_up_down(up_path: Path, down_path: Path, output_path: Path,
                  *, transform_fn=None) -> int:
    """Merge up + dn GMTs: each up term followed by its dn sibling, then any unpaired dn terms.
    `transform_fn` (optional) rewrites each term to canonical ::-format. Return None to drop the
    term, or a (term, desc_addition) tuple to also extend its description. Returns lines written."""
    up = load_gmt_dict(up_path, direction="up")
    dn = load_gmt_dict(down_path, direction="down")
    merged: dict[str, list[str]] = {}
    for k, genes in up.items():                          # up term, then its dn sibling inline
        merged[k] = genes
        if (sib := k.replace(" up\t", " down\t", 1)) in dn:
            merged[sib] = dn[sib]
    for k, genes in dn.items():                          # unpaired dn terms, in dn order
        merged.setdefault(k, genes)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(output_path, "wt") as out:
        for key, genes in merged.items():
            term, _, desc = key.partition("\t")
            if transform_fn:
                if (r := transform_fn(term)) is None:
                    continue
                term, desc = (r[0], append_to_description(desc, r[1])) if isinstance(r, tuple) else (r, desc)
            out.write(f"{term}\t{desc}\t" + "\t".join(genes) + "\n")
            n += 1
    return n


def harmonizome_paired_download(slug: str, output_path: Path,
                                *, transform_fn=None, no_cache: bool = False) -> Path:
    """Download the Harmonizome up + dn GMTs for `slug`, merge to canonical ::-format, write output_path.
    `transform_fn` (optional) rewrites each term to canonical format during the merge."""
    up = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_up_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_up_crisp.gmt.gz", no_cache=no_cache)
    dn = download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_dn_crisp.gmt.gz",
                     CACHE_DIR / f"{slug}_dn_crisp.gmt.gz", no_cache=no_cache)
    n = merge_up_down(up, dn, output_path, transform_fn=transform_fn)
    print(f"  {output_path.name}: {n} terms")
    return output_path


def harmonizome_builder(module_file, harmonizome_slug: str, out_slug: str, make_transform,
                        *, gene: bool = False, parse_organism=None):
    """Standard Stage A+B builder for a Harmonizome-paired dataset: download the up/dn GMTs, apply the
    per-term transform, standardize → data/. `make_transform(no_cache)` returns the transform_fn (str or
    (term, desc)); for a static transform pass `lambda _nc: my_transform`. Returns (INTERMEDIATE, FINAL,
    gmt). Bind them at module scope so the metadata builders can import FINAL / INTERMEDIATE."""
    intermediate = Path(module_file).parent / "intermediate" / f"{out_slug}.gmt.gz"
    final = (GENE_OUTPUT if gene else DRUG_OUTPUT) / f"{out_slug}.gmt.gz"
    std = {"parse_organism": parse_organism} if parse_organism else {}

    def gmt(no_cache: bool = False) -> Path:
        harmonizome_paired_download(harmonizome_slug, intermediate,
                                    transform_fn=make_transform(no_cache), no_cache=no_cache)
        standardize_gmt(intermediate, final, **std)
        return final

    return intermediate, final, gmt


def top_up_down(pairs, *, n: int = 100, min_genes: int = 5) -> tuple[list[str] | None, list[str] | None]:
    """From (gene, log2fc) pairs for one condition: dedupe by gene (keep the largest |log2fc|), then
    take the top-`n` up- and down-regulated genes by signed log2fc. A direction is returned only if it
    has >= `min_genes`, else None. Pure-Python (per-condition data is small)."""
    best: dict[str, float] = {}
    for gene, fc in pairs:
        if gene not in best or abs(fc) > abs(best[gene]):
            best[gene] = fc
    ranked = sorted(best.items(), key=lambda kv: kv[1])          # ascending log2fc
    down = [g for g, fc in ranked if fc < 0][:n]
    up = [g for g, fc in reversed(ranked) if fc > 0][:n]
    return (up if len(up) >= min_genes else None,
            down if len(down) >= min_genes else None)


def write_up_down_gmt(up_sets: dict, down_sets: dict, term_fn, output_path: Path) -> int:
    """Write a canonical up/dn GMT. For each condition (union of up/dn keys, sorted), `term_fn(condition)`
    builds the canonical term body (return None to skip); the up line then the dn line are written.
    Returns lines written."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(output_path, "wt") as f:
        for condition in sorted(set(up_sets) | set(down_sets)):
            if (term_body := term_fn(condition)) is None:
                continue
            for sets, direction in ((up_sets, "up"), (down_sets, "down")):
                if (genes := sets.get(condition)):
                    f.write(f"{term_body} {direction}\t\t" + "\t".join(genes) + "\n")
                    n += 1
    return n


def strip_direction(term: str) -> tuple[str, str]:
    """Split a term into (body, direction_suffix). direction_suffix is ' up'/' down'/' dn' or ''."""
    for suffix in (" up", " down", " dn"):
        if term.endswith(suffix):
            return term[: -len(suffix)], suffix
    return term, ""


def iter_term_fields(path: Path):
    """Yield each GMT line's canonical-term field list (TERM_DELIMITER-split, direction stripped)."""
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt") as f:
        for line in f:
            yield strip_direction(line.split("\t", 1)[0])[0].split(TERM_DELIMITER)


def distinct_term_field(path: Path, idx: int) -> set[str]:
    """Distinct non-empty values of canonical-term field `idx` across a GMT (0 = perturbation,
    1 = cell line; negative counts from the end, -1 = last extra)."""
    return {f[idx] for f in iter_term_fields(path) if -len(f) <= idx < len(f) and f[idx]}


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
