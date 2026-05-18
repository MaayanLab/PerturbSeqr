"""Perturb-Seqr GraphQL API wrapper.

Mirrors the actions exposed by the Perturb-Seqr front end: enrichment, paired
(up/down) enrichment, and term search.
"""
from __future__ import annotations

import difflib
import uuid as _uuid

import pandas as pd
from gql import Client, gql
from gql.transport.requests import RequestsHTTPTransport

PERTURBSEQR_URL = "https://perturbseqr.k8s.dev.maayanlab.cloud/graphql"

_transport = RequestsHTTPTransport(url=PERTURBSEQR_URL, timeout=60, retries=0)
_client = Client(transport=_transport)


def _execute(query, variables: dict) -> dict:
    return _client.execute(query, variable_values=variables)


# ---------------------------------------------------------------------------
# Library catalog
# Source of truth: src/config/libraries.json (displayName values).
# Update this list when libraries are added/renamed there.
# ---------------------------------------------------------------------------

DRUG_LIBRARIES: tuple[str, ...] = (
    "CREEDS Chem",
    "DeepCover MoA",
    "Ginkgo Bioworks",
    "LINCS L1000 CP",
    "Microarrays CMap",
    "NIBR DRUG-seq",
    "RummaGEO Chem",
    "SciPlex",
    "Tahoe-100M",
)

GENE_LIBRARIES: tuple[str, ...] = (
    "CM4AI",
    "CREEDS Gene",
    "LINCS L1000 XPR",
    "Perturb Atlas Human",
    "Perturb Atlas Mouse",
    "Replogle et al.",
    "RummaGEO Gene",
)

LIBRARIES: tuple[str, ...] = tuple(sorted(DRUG_LIBRARIES + GENE_LIBRARIES))


def list_libraries(*, category: str | None = None) -> list[str]:
    """Return valid library names accepted by the `libraries=` argument.

    Parameters
    ----------
    category : {"drug", "gene", None}, optional
        Filter to drug or gene perturbation libraries. None returns both.
    """
    if category is None:
        return list(LIBRARIES)
    if category == "drug":
        return list(DRUG_LIBRARIES)
    if category == "gene":
        return list(GENE_LIBRARIES)
    raise ValueError(f"category must be 'drug', 'gene', or None; got {category!r}")


def _validate_libraries(libs: list[str] | None) -> None:
    if libs is None:
        return
    unknown = [name for name in libs if name not in LIBRARIES]
    if not unknown:
        return
    suggestions = {}
    for name in unknown:
        match = difflib.get_close_matches(name, LIBRARIES, n=1, cutoff=0.6)
        if match:
            suggestions[name] = match[0]
    hint = ""
    if suggestions:
        pairs = ", ".join(f"{k!r} → {v!r}" for k, v in suggestions.items())
        hint = f" Did you mean: {pairs}."
    raise ValueError(
        f"Unknown library name(s): {unknown}.{hint} "
        f"Call perturbseqr.list_libraries() to see all valid names. "
        f"Valid libraries: {list(LIBRARIES)}"
    )


# ---------------------------------------------------------------------------
# enrich(): single gene set
# ---------------------------------------------------------------------------

ENRICH_COLUMNS = [
    "term", "id", "library_name", "nGeneIds",
    "pvalue", "adjPvalue", "oddsRatio", "nOverlap",
]

_ENRICHMENT_QUERY = gql("""query EnrichmentQuery(
    $genes: [String]!
    $libraryNames: [String]
    $filterTerm: String = ""
    $offset: Int = 0
    $first: Int = 10
    $filterFda: Boolean = false
    $sortBy: String = ""
    $filterKo: Boolean = false
) {
    currentBackground {
        enrich(
            genes: $genes
            libraryNames: $libraryNames
            filterTerm: $filterTerm
            offset: $offset
            first: $first
            filterFda: $filterFda
            sortby: $sortBy
            filterKo: $filterKo
        ) {
            nodes {
                geneSetHash
                pvalue
                adjPvalue
                oddsRatio
                nOverlap
                geneSets {
                    nodes {
                        term
                        id
                        nGeneIds
                        library { name }
                    }
                }
            }
            totalCount
        }
    }
}""")


def enrich(
    genes: list[str],
    *,
    libraries: list[str] | None = None,
    top: int = 100,
    sort_by: str = "pvalue",
    filter_term: str = "",
    filter_fda: bool = False,
    filter_ko: bool = False,
) -> pd.DataFrame:
    """Single gene set enrichment.

    Parameters
    ----------
    genes : list[str]
        Gene symbols.
    libraries : list[str], optional
        Restrict to these library names.
    top : int, default 100
        Max rows returned.
    sort_by : str, default "pvalue"
        Sort column.
    filter_term : str, default ""
        Substring filter on the term column.
    filter_fda : bool, default False
        Keep only FDA-approved drugs.
    filter_ko : bool, default False
        Keep only gene knockouts.
    """
    _validate_libraries(libraries)
    variables: dict = {
        "genes": list(genes),
        "first": top,
        "offset": 0,
        "filterTerm": filter_term,
        "filterFda": filter_fda,
        "filterKo": filter_ko,
        "sortBy": sort_by,
    }
    if libraries is not None:
        variables["libraryNames"] = list(libraries)

    data = _execute(_ENRICHMENT_QUERY, variables)
    nodes = data["currentBackground"]["enrich"]["nodes"]
    if not nodes:
        return pd.DataFrame(columns=ENRICH_COLUMNS)

    df = pd.json_normalize(
        nodes,
        record_path=["geneSets", "nodes"],
        meta=["pvalue", "adjPvalue", "oddsRatio", "nOverlap"],
    ).rename(columns={"library.name": "library_name"})
    return df[ENRICH_COLUMNS]


# ---------------------------------------------------------------------------
# enrich_pair(): up/down gene set enrichment
# ---------------------------------------------------------------------------

ENRICH_PAIR_COLUMNS = [
    "term", "id", "library_name", "nGeneIds",
    "pvalueMimic", "adjPvalueMimic", "oddsRatioMimic", "mimickerOverlap",
    "pvalueReverse", "adjPvalueReverse", "oddsRatioReverse", "reverserOverlap",
]

_PAIR_ENRICHMENT_QUERY = gql("""query PairEnrichmentQuery(
    $genesUp: [String]!
    $genesDown: [String]!
    $libraryNames: [String]
    $filterTerm: String = ""
    $offset: Int = 0
    $first: Int = 10
    $filterFda: Boolean = false
    $sortBy: String = ""
    $filterKo: Boolean = false
    $topN: Int = 10000
    $pvalueLe: Float = 0.05
) {
    currentBackground {
        pairedEnrich(
            genesUp: $genesUp
            genesDown: $genesDown
            libraryNames: $libraryNames
            filterTerm: $filterTerm
            offset: $offset
            first: $first
            filterFda: $filterFda
            sortby: $sortBy
            filterKo: $filterKo
            topN: $topN
            pvalueLe: $pvalueLe
        ) {
            nodes {
                pvalueMimic
                adjPvalueMimic
                oddsRatioMimic
                mimickerOverlap
                pvalueReverse
                adjPvalueReverse
                oddsRatioReverse
                reverserOverlap
                geneSet {
                    nodes {
                        term
                        id
                        nGeneIds
                        library { name }
                    }
                }
            }
            totalCount
        }
    }
}""")


def enrich_pair(
    *,
    up: list[str],
    down: list[str],
    libraries: list[str] | None = None,
    top: int = 100,
    sort_by: str = "pvalue_mimic",
    filter_term: str = "",
    filter_fda: bool = False,
    filter_ko: bool = False,
    top_n: int = 1000,
    pvalue_le: float = 0.05,
) -> pd.DataFrame:
    """Paired up and down gene set enrichment.

    Parameters
    ----------
    up : list[str]
        Up-regulated gene symbols.
    down : list[str]
        Down-regulated gene symbols.
    libraries : list[str], optional
        Restrict to these library names.
    top : int, default 100
        Max rows returned.
    sort_by : str, default "pvalue_mimic"
        Sort column.
    filter_term : str, default ""
        Substring filter on the term column.
    filter_fda : bool, default False
        Keep only FDA-approved drugs.
    filter_ko : bool, default False
        Keep only gene knockouts.
    top_n : int, default 1000
        Max library size considered.
    pvalue_le : float, default 0.05
        Keep only rows with p <= this.
    """
    _validate_libraries(libraries)
    variables: dict = {
        "genesUp": list(up),
        "genesDown": list(down),
        "first": top,
        "offset": 0,
        "filterTerm": filter_term,
        "filterFda": filter_fda,
        "filterKo": filter_ko,
        "sortBy": sort_by,
        "topN": top_n,
        "pvalueLe": pvalue_le,
    }
    if libraries is not None:
        variables["libraryNames"] = list(libraries)

    data = _execute(_PAIR_ENRICHMENT_QUERY, variables)
    nodes = data["currentBackground"]["pairedEnrich"]["nodes"]
    if not nodes:
        return pd.DataFrame(columns=ENRICH_PAIR_COLUMNS)

    df = pd.json_normalize(
        nodes,
        record_path=["geneSet", "nodes"],
        meta=[
            "pvalueMimic", "adjPvalueMimic", "oddsRatioMimic", "mimickerOverlap",
            "pvalueReverse", "adjPvalueReverse", "oddsRatioReverse", "reverserOverlap",
        ],
    ).rename(columns={"library.name": "library_name"})
    return df[ENRICH_PAIR_COLUMNS]


# ---------------------------------------------------------------------------
# term_search(): paginated text search across gene set names
# ---------------------------------------------------------------------------

TERM_SEARCH_COLUMNS = ["term", "id", "library_name", "nGeneIds"]

_TERM_SEARCH_QUERY = gql("""query TermSearch(
    $terms: [String]!
    $libraryNames: [String]
    $offset: Int = 0
    $first: Int = 10
) {
    geneSetTermSearch(
        terms: $terms
        libraryNames: $libraryNames
        offset: $offset
        first: $first
    ) {
        nodes {
            id
            term
            nGeneIds
            library { name }
        }
        totalCount
    }
}""")


def term_search(
    query: str | list[str],
    *,
    libraries: list[str] | None = None,
    top: int = 10,
) -> pd.DataFrame:
    """Search gene set terms by substring.

    Parameters
    ----------
    query : str | list[str]
        Substring(s) to match.
    libraries : list[str], optional
        Restrict to these library names.
    top : int, default 10
        Max rows returned.
    """
    _validate_libraries(libraries)
    terms = [query] if isinstance(query, str) else list(query)
    variables: dict = {"terms": terms, "first": top, "offset": 0}
    if libraries is not None:
        variables["libraryNames"] = list(libraries)

    data = _execute(_TERM_SEARCH_QUERY, variables)
    nodes = data["geneSetTermSearch"]["nodes"]
    if not nodes:
        return pd.DataFrame(columns=TERM_SEARCH_COLUMNS)

    df = pd.json_normalize(nodes).rename(columns={"library.name": "library_name"})
    return df[TERM_SEARCH_COLUMNS]


# ---------------------------------------------------------------------------
# Library stats (per-library signature counts — same query the front end uses)
# ---------------------------------------------------------------------------

_ALL_LIBRARIES_QUERY = gql("""query AllLibraries {
    geneSetLibraries {
        nodes {
            name
            geneSetsByLibraryId { totalCount }
        }
    }
}""")


def library_stats() -> pd.DataFrame:
    """Signature counts per library (single API call — the same query the front end uses).

    Returns a DataFrame with columns ``name`` and ``n_sets``.
    """
    data = _execute(_ALL_LIBRARIES_QUERY, {})
    rows = [
        {"name": n["name"], "n_sets": n["geneSetsByLibraryId"]["totalCount"]}
        for n in data["geneSetLibraries"]["nodes"]
    ]
    return pd.DataFrame(rows).sort_values("name").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Gene-level helpers (all single-call against geneMap2 / geneSet / geneSetGeneSearch)
# ---------------------------------------------------------------------------

# All scalar fields exposed on the `Gene` postgraphile type (excluding `nodeId`,
# which is just postgraphile's Apollo-cache key — not useful outside the frontend).
_GENE_FIELDS = "id symbol ncbiGeneId synonyms description summary"

_CHECK_GENES_QUERY = gql(f"""query CheckGenes($genes: [String]!) {{
    geneMap2(genes: $genes) {{
        nodes {{
            gene
            geneInfo {{ {_GENE_FIELDS} }}
        }}
    }}
}}""")


def check_genes(genes: list[str]) -> pd.DataFrame:
    """Resolve user gene symbols against the Perturb-Seqr background.

    Returns a DataFrame with one row per input gene, columns ``input`` plus every
    scalar field on the underlying ``Gene`` type — ``recognized_symbol``,
    ``ncbi_gene_id``, ``synonyms``, ``description``, ``summary``, ``id`` — with
    ``None``/``NaN`` for unrecognized inputs.

    Notes:
    - ``synonyms`` is the ``gene.synonyms`` JSONB column. As of writing this is
      ``{}`` for every recognized gene; the schema supports alias resolution but
      the ingest pipeline does not populate it.
    - "X of Y mapped" diagnostic: ``df["recognized_symbol"].notna().sum()``.
    - Unmapped rows are usually the more useful diagnostic — they reveal typos,
      historical aliases, and non-protein-coding entries.
    """
    data = _execute(_CHECK_GENES_QUERY, {"genes": list(genes)})
    rows = []
    for n in data["geneMap2"]["nodes"]:
        info = n["geneInfo"] or {}
        rows.append({
            "input": n["gene"],
            "recognized_symbol": info.get("symbol"),
            "ncbi_gene_id":      info.get("ncbiGeneId"),
            "synonyms":          info.get("synonyms"),
            "description":       info.get("description"),
            "summary":           info.get("summary"),
            "id":                info.get("id"),
        })
    return pd.DataFrame(rows)


_GENE_DESCRIPTIONS_QUERY = gql(f"""query GeneDescriptions($genes: [String]!) {{
    geneMap2(genes: $genes) {{
        nodes {{
            geneInfo {{ {_GENE_FIELDS} }}
        }}
    }}
}}""")


def gene_descriptions(genes: list[str]) -> pd.DataFrame:
    """Every ``Gene``-type field for recognized genes. Unrecognized inputs are dropped.

    Returns DataFrame columns: ``symbol``, ``ncbi_gene_id``, ``synonyms``,
    ``description``, ``summary``, ``id``.

    Differs from :func:`check_genes` only in that unrecognized inputs are dropped
    and there is no ``input`` column — use this when you want to look up the
    biology of a list of known-valid symbols.
    """
    data = _execute(_GENE_DESCRIPTIONS_QUERY, {"genes": list(genes)})
    rows = []
    for n in data["geneMap2"]["nodes"]:
        info = n["geneInfo"]
        if info is None:
            continue
        rows.append({
            "symbol":       info["symbol"],
            "ncbi_gene_id": info["ncbiGeneId"],
            "synonyms":     info["synonyms"],
            "description":  info["description"],
            "summary":      info["summary"],
            "id":           info["id"],
        })
    return pd.DataFrame(rows)


_OVERLAP_QUERY = gql("""query Overlap($id: UUID!, $genes: [String]!) {
    geneSet(id: $id) {
        overlap(genes: $genes) {
            nodes { symbol }
        }
    }
}""")


def get_overlap(genes: list[str], signature_id: str) -> list[str]:
    """Gene symbols overlapping between the user list and a Perturb-Seqr signature.

    ``signature_id`` is the UUID returned by ``enrich`` / ``enrich_pair`` / ``term_search``
    in the ``id`` column. Useful for understanding *why* a particular signature ranked
    high — which of the user's genes actually contribute to the overlap.
    """
    data = _execute(_OVERLAP_QUERY, {"id": signature_id, "genes": list(genes)})
    gs = data["geneSet"]
    if gs is None:
        raise ValueError(f"No signature found with id: {signature_id!r}")
    return [n["symbol"] for n in gs["overlap"]["nodes"]]


_SIGNATURE_GENES_BY_ID = gql("""query SigById($id: UUID!) {
    geneSet(id: $id) {
        term
        genes { nodes { symbol ncbiGeneId description } }
    }
}""")

_SIGNATURE_GENES_BY_TERM = gql("""query SigByTerm($term: String!) {
    geneSetByTerm(term: $term) {
        term
        genes { nodes { symbol ncbiGeneId description } }
    }
}""")


def get_signature_genes(signature: str) -> pd.DataFrame:
    """Gene members of a Perturb-Seqr signature, looked up by UUID or term string.

    Returns DataFrame columns: ``symbol``, ``ncbi_gene_id``, ``description``.
    Raises ``ValueError`` if no signature matches.
    """
    try:
        _uuid.UUID(signature)
        is_uuid = True
    except ValueError:
        is_uuid = False

    if is_uuid:
        data = _execute(_SIGNATURE_GENES_BY_ID, {"id": signature})
        gs = data["geneSet"]
    else:
        data = _execute(_SIGNATURE_GENES_BY_TERM, {"term": signature})
        gs = data["geneSetByTerm"]

    if gs is None:
        raise ValueError(f"No signature found for: {signature!r}")
    rows = [
        {"symbol": n["symbol"], "ncbi_gene_id": n["ncbiGeneId"], "description": n["description"]}
        for n in gs["genes"]["nodes"]
    ]
    return pd.DataFrame(rows)


_GENE_SEARCH_QUERY = gql("""query GeneSearch(
    $genes: [String]!
    $libraryNames: [String]
    $offset: Int!
    $first: Int!
) {
    geneSetGeneSearch(
        genes: $genes
        libraryNames: $libraryNames
        offset: $offset
        first: $first
    ) {
        nodes {
            id
            term
            nGeneIds
            library { name }
        }
        totalCount
    }
}""")


def find_signatures_containing(
    genes: list[str],
    *,
    libraries: list[str] | None = None,
    top: int = 100,
) -> pd.DataFrame:
    """Find Perturb-Seqr signatures whose gene members include any of ``genes``.

    Returns DataFrame columns: ``id``, ``term``, ``library_name``, ``n_genes``.
    """
    _validate_libraries(libraries)
    variables: dict = {"genes": list(genes), "offset": 0, "first": top}
    if libraries is not None:
        variables["libraryNames"] = list(libraries)
    data = _execute(_GENE_SEARCH_QUERY, variables)
    nodes = data["geneSetGeneSearch"]["nodes"]
    if not nodes:
        return pd.DataFrame(columns=["id", "term", "library_name", "n_genes"])
    df = pd.json_normalize(nodes).rename(columns={
        "library.name": "library_name",
        "nGeneIds": "n_genes",
    })
    return df[["id", "term", "library_name", "n_genes"]]
