"""Perturb-Seqr GraphQL API wrapper (v0.0.1).

Mirrors the actions exposed by the Perturb-Seqr front end: enrichment, paired
(up/down) enrichment, and term search.

    import perturbseqr as ps
    df = ps.enrich(["STAT1", "STAT3", "JAK1", "JAK2", "IFNG"])
    df = ps.enrich(genes, libraries=["LINCS L1000 CP"], top=5)
    df = ps.enrich_pair(up=[...], down=[...])
    df = ps.term_search("STAT3")
"""
from __future__ import annotations

import pandas as pd
import requests

PERTURBSEQR_URL = "https://perturbseqr.k8s.dev.maayanlab.cloud/graphql"

_session = requests.Session()


def _post(operation_name: str, variables: dict, query: str, timeout: float = 120.0) -> dict:
    response = _session.post(
        PERTURBSEQR_URL,
        json={"operationName": operation_name, "variables": variables, "query": query},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise RuntimeError(payload["errors"])
    return payload["data"]


# ---------------------------------------------------------------------------
# enrich(): single gene set
# ---------------------------------------------------------------------------

ENRICH_COLUMNS = [
    "term", "id", "library_name", "nGeneIds",
    "pvalue", "adjPvalue", "oddsRatio", "nOverlap",
]

_ENRICHMENT_QUERY = """query EnrichmentQuery(
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
}"""


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
    """Single gene set enrichment against Perturb-Seqr."""
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

    data = _post("EnrichmentQuery", variables, _ENRICHMENT_QUERY)
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

_PAIR_ENRICHMENT_QUERY = """query PairEnrichmentQuery(
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
}"""


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
    """Up/down gene set enrichment (DEX-shaped query)."""
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

    data = _post("PairEnrichmentQuery", variables, _PAIR_ENRICHMENT_QUERY)
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

_TERM_SEARCH_QUERY = """query TermSearch(
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
}"""


def term_search(
    query: str | list[str],
    *,
    libraries: list[str] | None = None,
    top: int = 10,
) -> pd.DataFrame:
    """Search gene set terms by substring(s)."""
    terms = [query] if isinstance(query, str) else list(query)
    variables: dict = {"terms": terms, "first": top, "offset": 0}
    if libraries is not None:
        variables["libraryNames"] = list(libraries)

    data = _post("TermSearch", variables, _TERM_SEARCH_QUERY)
    nodes = data["geneSetTermSearch"]["nodes"]
    if not nodes:
        return pd.DataFrame(columns=TERM_SEARCH_COLUMNS)

    df = pd.json_normalize(nodes).rename(columns={"library.name": "library_name"})
    return df[TERM_SEARCH_COLUMNS]

