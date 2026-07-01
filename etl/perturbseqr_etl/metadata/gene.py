"""
Every ETL dataset should route its DEGs through `filter_to_human_pc`. Output gene-name contract:
uppercase, and present in NCBI gene_info for a PC gene (either the Symbol itself or any synonym).
Gene set members pass through verbatim, no alias-to-current-Symbol rename.

Species: human + mouse. Mouse DEGs go through MGI homology to the human ortholog.
"""
from collections import Counter
from functools import lru_cache
from pathlib import Path

from perturbseqr_etl.metadata import warn_unmatched

_HUMAN_ALIASES = {"homo sapiens", "human"}
_MOUSE_ALIASES = {"mus musculus", "mouse"}


@lru_cache(maxsize=4)
def protein_coding_genes(organism: str, cache_dir: Path) -> frozenset[str]:
    """UPPERCASE Symbol ∪ synonyms for every protein-coding gene of `organism`."""
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    df = ncbi_genes_fetch(organism=organism, cache_dir=str(cache_dir))
    out = set()
    for _, row in df.iterrows():
        out.add(row["Symbol"].upper())
        out.update(s.upper() for s in row["All_synonyms"])
    return frozenset(out)


@lru_cache(maxsize=4)
def non_protein_coding_genes(organism: str, cache_dir: Path) -> frozenset[str]:
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
    synonyms (mapping to multiple mouse Symbols) drop, orthology needs an unambiguous source."""
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
    human_pc = protein_coding_genes("Mammalia/Homo_sapiens", cache_dir)
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
    human_non_pc = non_protein_coding_genes("Mammalia/Homo_sapiens", cache_dir)
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


# Gene cross-reference annotation (NCBI gene_info + HGNC)
HGNC_URL = "https://storage.googleapis.com/public-download-files/hgnc/json/json/hgnc_complete_set.json"


@lru_cache(maxsize=2)
def _hgnc_index(cache_dir: Path) -> tuple[dict, dict]:
    """(by_ensembl_id, by_UPPER_symbol) -> {hgnc_id, ncbi_gene_id, uniprot_ids, name, alias_symbol[], prev_symbol[]}."""
    import json
    from perturbseqr_etl.dataloader import download_to
    path = download_to(HGNC_URL, cache_dir / "hgnc_complete_set.json")
    by_ensembl: dict[str, dict] = {}
    by_symbol: dict[str, dict] = {}
    for r in json.loads(Path(path).read_text())["response"]["docs"]:
        rec = {
            "hgnc_id": r.get("hgnc_id", ""),
            "ncbi_gene_id": str(r["entrez_id"]) if r.get("entrez_id") else "",
            "uniprot_ids": "|".join(r.get("uniprot_ids") or []),
            "name": r.get("name", ""),
            "alias_symbol": r.get("alias_symbol") or [],
            "prev_symbol": r.get("prev_symbol") or [],
        }
        if ens := r.get("ensembl_gene_id"):
            by_ensembl[ens] = rec
        if sym := r.get("symbol"):
            by_symbol[sym.upper()] = rec
    return by_ensembl, by_symbol


@lru_cache(maxsize=4)
def _ncbi_index(organism: str, cache_dir: Path) -> dict:
    """UPPER current Symbol -> (ncbi_gene_id, [synonyms]) from NCBI gene_info. Keyed on the current
    Symbol only. We never resolve an ID through another gene's synonym list (a symbol that's only a
    synonym is left blank rather than inheriting the canonical gene's ID)."""
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    df = ncbi_genes_fetch(organism=organism, cache_dir=str(cache_dir))
    return {row["Symbol"].upper(): (str(row["GeneID"]),
                                    [s for s in str(row["Synonyms"]).split("|") if s and s != "-"])
            for _, row in df.iterrows()}


@lru_cache(maxsize=2)
def _symbol_to_ensembl(cache_dir: Path) -> dict[str, str]:
    """UPPER current HGNC symbol → ensembl_gene_id. Current symbol only. We don't resolve through
    alias/prev symbols, so a non-current symbol is left blank rather than mapped to the renamed
    gene's ID (e.g. ARNTL is NOT mapped to BMAL1's Ensembl id)."""
    import json
    from perturbseqr_etl.dataloader import download_to
    docs = json.loads(Path(download_to(HGNC_URL, cache_dir / "hgnc_complete_set.json")).read_text())["response"]["docs"]
    return {sym.upper(): ens for r in docs
            if (ens := r.get("ensembl_gene_id")) and (sym := r.get("symbol"))}


def add_ensembl_id(df, *, cache_dir: Path, symbol_col: str = "gene_symbol"):
    """Resolve gene symbols to Ensembl gene IDs via HGNC (current → alias → prev symbol) and add an
    `ensembl_id` column ('' if unresolved)."""
    sym2ens = _symbol_to_ensembl(cache_dir)
    ens = [sym2ens.get(str(s).upper(), "") for s in df[symbol_col]]
    warn_unmatched([s for s, e in zip(df[symbol_col], ens) if not e], len(df), entity="gene→Ensembl")
    return df.assign(ensembl_id=ens)


def annotate(df, *, cache_dir: Path, symbol_col: str = "gene_symbol",
             ensembl_col: str = "ensembl_id", organism: str = "Mammalia/Homo_sapiens"):
    """Add NCBI/HGNC cross-reference IDs + synonyms to a gene table."""
    by_ensembl, by_symbol = _hgnc_index(cache_dir)
    ncbi = _ncbi_index(organism, cache_dir)
    cols: dict[str, list] = {k: [] for k in ("ncbi_gene_id", "hgnc_id", "uniprot_ids", "name",
                                             "hgnc_alias_symbol", "hgnc_prev_symbol", "ncbi_synonyms")}
    unmatched = []
    for sym, ens in zip(df[symbol_col], df[ensembl_col]):
        hg = by_ensembl.get(ens) or by_symbol.get(str(sym).upper())
        ncbi_id, ncbi_syns = ncbi.get(str(sym).upper(), ("", []))
        if hg is None and not ncbi_id and not ncbi_syns:
            unmatched.append(sym)
        gene_id = (hg and hg["ncbi_gene_id"]) or ncbi_id
        cols["ncbi_gene_id"].append(gene_id)
        cols["hgnc_id"].append(hg["hgnc_id"] if hg else "")
        cols["uniprot_ids"].append(hg["uniprot_ids"] if hg else "")
        cols["name"].append(hg["name"] if hg else "")
        cols["hgnc_alias_symbol"].append("|".join(hg["alias_symbol"]) if hg else "")
        cols["hgnc_prev_symbol"].append("|".join(hg["prev_symbol"]) if hg else "")
        cols["ncbi_synonyms"].append("|".join(ncbi_syns))
    warn_unmatched(unmatched, len(df), entity="gene")
    return df.assign(**cols)


def build_gene_target_metadata(gmt_path, out_dir, *, cache_dir: Path, out_name: str | None = None,
                               split_barred: bool = False):
    # perturbed gene (field 0) + perturbation_type/method (fields 5/6) -> Ensembl + NCBI/HGNC.
    # split_barred: split a |-barred multi-gene field 0 into per-gene rows, aligned with field-5 types.
    from itertools import zip_longest
    import pandas as pd
    from perturbseqr_etl.gmt import iter_term_fields   # lazy: gmt.py imports this module (avoids a cycle)
    from perturbseqr_etl.metadata import write_table
    gmt_path = Path(gmt_path)
    if not gmt_path.exists():
        raise FileNotFoundError(f"GMT not found: {gmt_path}\n  Run the dataset's gmt.py first.")
    out_name = out_name or gmt_path.name.removesuffix(".gmt.gz") + "-gene_target_metadata"
    rows: set[tuple[str, str, str]] = set()
    for f in iter_term_fields(gmt_path):
        if not (f and f[0]):
            continue
        ptype = f[5] if len(f) > 5 else ""
        method = f[6] if len(f) > 6 else ""
        if split_barred and "|" in f[0]:                                       # multi-gene perturbation
            for gene, t in zip_longest(f[0].split("|"), ptype.split("|"), fillvalue=""):
                if gene:
                    rows.add((gene, t, method))
        else:
            rows.add((f[0], ptype, method))
    gm = pd.DataFrame(sorted(rows), columns=["gene_symbol", "perturbation_type", "method"])
    gm = add_ensembl_id(gm, cache_dir=cache_dir)
    gm = annotate(gm, cache_dir=cache_dir)
    return write_table(gm, out_dir, out_name, label="gene targets")
