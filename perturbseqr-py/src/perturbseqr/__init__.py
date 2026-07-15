"""Perturb-Seqr GraphQL API wrapper.

Mirrors the actions exposed by the Perturb-Seqr front end: enrichment, paired
(up/down) enrichment, and term search.
"""
from __future__ import annotations

import pandas as pd
from gql import Client, gql
from gql.transport.requests import RequestsHTTPTransport

PERTURBSEQR_URL = "https://perturbseqr.maayanlab.cloud/graphql"

_transport = RequestsHTTPTransport(url=PERTURBSEQR_URL, timeout=60, retries=0)
_client = Client(transport=_transport)


def _execute(query, variables: dict) -> dict:
    return _client.execute(query, variable_values=variables)


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
