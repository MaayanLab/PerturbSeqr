# Perturb-Seqr Documentation

> **In Progress:** Perturb-Seqr-specific documentation is in progress. The documentation below may not fully reflect the current application.

**Navigation:** [Abstract](/about) | [Dataset Filtering](#dataset-filtering) | [Single Gene Set Search](#gene-set-search) | [Up & Down Gene Set Search](#up-down-gene-set-search) | [Dataset Visualizations](#dataset-visualizations) | [Term Search](#metadata-search) | [Download](#download-page) | [API](#api)

---

## Getting Started

The Perturb-Seqr web application is a comprehensive Connectivity Mapping search engine that integrates 9 drug perturbation and 7 gene perturbation datasets into a single unifying resource. The application provides single gene set search, up and down gene set search, and term search. Additionally, Perturb-Seqr offers interactive UMAP visualizations and an API for programmatic access. To get started try submitting the included examples on the home page:

![Getting Started 1](/images/getting-started-1.png) ![Getting Started 2](/images/getting-started-2.png)

All search features are accompanied by dataset filtering, enabling users to select which drug and gene perturbation datasets are included in the underlying enrichment analysis, directly affecting the background gene set library and resulting statistical comparisons. Submitting the same gene set with different datasets selected will produce distinct enrichment results, reflecting that you are running a distinct Connectivity Mapping query. Once submitting either of the examples, a results table will be returned sorted by the most significantly overlapping gene sets or signatures. From here, you can apply additional filtering for FDA-approved drugs, for the directionality of the gene sets or signatures, as well as identify consensus mechanisms of action (MoAs), and consensus compounds seen across cell lines, time points and concentrations:

![Gene Set Search Results](/images/gene-set-search-2.png) ![Up/Down Gene Set Search Results](/images/gene-set-search-11.png)

Additionally, users can apply post-query dataset filtering that does not change the underlying enrichment analysis, but helps users narrow down results of interest.

![Gene Set Search Results](/images/post-search-dataset-dropdown.png)

Please explore the features in more depth below:

---

## Dataset Filtering

On search pages, users can toggle individual datasets on or off to control which are included in their query. Cyan icons represent drug perturbation datasets while magenta icons represent gene perturbation datasets. By default, all datasets are selected.

![Dataset Filtering](/images/dataset-icons.gif)

As described in the Getting Started section, filtering datasets prior to search directly affects the underlying enrichment analysis. The selected datasets define the background gene set library used in the statistical comparisons.

Dataset filtering selections and gene set inputs will persist as long as the user navigates back using the "BACK" button on the results page.

![Back Button 1](/images/back-button-1.png) ![Back Button 2](/images/back-button-2.png)

---

## Single Gene Set Search

The Gene Set Search page enables users to search the Perturb-Seqr database for gene sets that match their query gene set. Similarity to gene sets contained within the Perturb-Seqr database with the query gene set is measured with Fisher's exact test. Any significantly overlapping gene sets are returned to the user along with their accompanying metadata. User query gene sets can be pasted or typed into the input form with each gene on a new line, or the user may upload a file containing genes where the genes are listed with new line, tab, or comma separators:

![Single Gene Set Input](/images/gene-set-search-1.png)

Paginated results are returned with the total number of gene sets which the query was compared to and the number of those gene sets which were significantly enriched. Enrichment statistics are provided on the right side of the table. The user may explore the metadata associated with the signatures on each results page, by clicking on the icon next to the compound or gene perturbation, or on the underlined cell line:

![Single Gene Set Results](/images/gene-set-search-2.png)

Other information such as the directionality of the gene set, the number of overlapping genes, and the total number of genes in the enriched gene set are also displayed. Clicking the overlap or gene set size will open a modal box with the corresponding genes as well as buttons to copy the gene set to the clipboard, or to view the enrichment results on RummaGEO, Rummagene, or Enrichr:

![Gene Set Overlap Modal](/images/gene-set-search-3.png)

To further filter and refine the results, the user may use the search bar located above the table to search for gene sets containing certain keywords. This allows, for instance, to view enriched results from the A549 cell line based upon the same input gene set. The total number of enriched gene sets is updated accordingly:

![Keyword Search Filter](/images/gene-set-search-4.png)

Results may also be easily downloaded using the button to the far right of the search feature in a tab delimited format (for downloads of greater than 10,000 results please refer to the downloads page):

![Download Results](/images/gene-set-search-5.png)

Users may additionally filter results by the direction of the signature, FDA approved drugs, drug or gene perturbation type, and dataset with the buttons above the table:

![Filter Buttons](/images/gene-set-search-6.png)

To generate consensus results, selecting the consensus perturbations button at the top of the table will compute significant compounds and gene perturbations using the Fisher's exact test, taking into account the number of significant and insignificant signatures corresponding to that perturbation. P-values for the direction of the signature are then generated for each significant consensus perturbation using the number of significant up and down, and insignificant up and down terms for that perturbation:

![Consensus Results](/images/gene-set-search-7.png)

To identify the most common mechanisms of action and their directionality similar to the consensus compound feature, the consensus mechanism of action button can be selected. This will compute the number of significant and insignificant signatures corresponding to that mechanism of action and generate p-values for the direction of the signature using the number of significant up and down, and insignificant up and down terms for that mechanism of action:

![Consensus MoA](/images/gene-set-search-8.png)

---

## Up & Down Gene Set Search

The up and down gene set search functionality enables users to search the Perturb-Seqr database for gene set signature pairs that most significantly mimic or reverse the expression of the submitted up- and down-gene set signature. A Fisher's exact test is also used to assess the significance of these results, specifically measuring a mimicker overlap (up Perturb-Seqr gene set & up user gene set + down Perturb-Seqr gene set & down user gene set) and reverser overlap (up Perturb-Seqr gene set & down user gene set + down Perturb-Seqr gene set & up user gene set). Any significantly overlapping mimicker or reverser signature is returned to the user along with their accompanying metadata. Similarly to the single gene set search, user query gene sets can be pasted or typed into the two input boxes with each gene on a new line, or the user may upload a file containing genes where the genes are listed with new line, tab, or comma separators after selecting the up & down gene set option on the input form:

![Up/Down Input 1](/images/gene-set-search-9.png) ![Up/Down Input 2](/images/gene-set-search-10.png)

The gene set search page is very similar to that of the single gene set search page, displaying the enrichment statistics, button filters, and mimicker and reverser overlaps which can be opened as modals and further explored:

![Up/Down Results](/images/gene-set-search-11.png)

---

## Dataset Visualizations

Users can explore the unique structure and clustering of each dataset through precomputed UMAP visualizations. Datasets can be selected from the dropdown menu. Hovering over points on the UMAP will display the corresponding term.

![UMAP Visualizations](/images/umaps.png)

---

## Term Search

Perturb-Seqr also provides direct metadata search of all dataset signatures. Paginated results are returned with accompanying metadata of the returned signatures:

![Term Search](/images/metadata-search-1.png)

These results can also be further filtered using the search bar at the top right of the table:

![Term Search Filter](/images/metadata-search-2.png)

Term search results, formatted as a gene matrix transpose (GMT), or a metadata table can be downloaded in a tab-delimited format as well:

![Term Search Download](/images/metadata-search-3.png)

---

## Download Page

All data is available in GMT format on the Download page. The term format for each dataset is shown, with each term format consistent up to the fifth position. Links to the original publication, Harmonizome, and full differential expression matrices are also available.

![Download Page 1](/images/download-1.png) ![Download Page 2](/images/download-2.png)

---

## API

Perturb-Seqr provides programmatic access through a GraphQL endpoint. Users can learn more about GraphQL queries from their provided [documentation](https://graphql.org/learn/). The Perturb-Seqr [GraphQL endpoint](/graphiql) and associated Postgres database provide users with a wide range of available queries and with a user interface to test and develop these queries:

![GraphiQL](/images/api-1.png)

For example, enrichment analysis queries can be performed in Python against the Perturb-Seqr gene sets using the requests library as follows. The optional `library_names` parameter restricts the background gene set library to specific datasets, directly affecting the statistical comparisons:

```python
import requests
import pandas as pd

url = "https://perturbseqr.com/graphql"

def enrich_perturbseqr_single_set(geneset: list, first=1000, library_names=None):
    variables = {
        "filterTerm": "",
        "offset": 0,
        "first": first,
        "filterFda": False,
        "sortBy": "pvalue_up",
        "filterKo": False,
        "genes": geneset,
    }
    if library_names is not None:
        variables["libraryNames"] = library_names

    query = {
    "operationName": "EnrichmentQuery",
    "variables": variables,
    "query": """query EnrichmentQuery(
                    $genes: [String]!
                    $filterTerm: String = ""
                    $offset: Int = 0
                    $first: Int = 10
                    $filterFda: Boolean = false
                    $sortBy: String = ""
                    $filterKo: Boolean = false
                    $libraryNames: [String]
                    ) {
                    currentBackground {
                        enrich(
                        genes: $genes
                        filterTerm: $filterTerm
                        offset: $offset
                        first: $first
                        filterFda: $filterFda
                        sortby: $sortBy
                        filterKo: $filterKo
                        libraryNames: $libraryNames
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
                                geneSetFdaCountsById {
                                nodes {
                                    approved
                                    count
                                }
                                }
                            }
                            totalCount
                            }
                        }
                        totalCount
                        geneSetCount
                        consensusCount
                        consensus {
                            drug
                            oddsRatio
                            pvalue
                            adjPvalue
                            approved
                            countSignificant
                            countInsignificant
                            countUpSignificant
                            pvalueUp
                            adjPvalueUp
                            oddsRatioUp
                            pvalueDown
                            adjPvalueDown
                            oddsRatioDown
                        }
                        }
                    }
                    }
                    """,
    }

    response = requests.post(url, json=query)

    response.raise_for_status()
    res = response.json()
    consensus = res['data']['currentBackground']['enrich']['consensus']
    enrichment = res['data']['currentBackground']['enrich']['nodes']
    df_consensus = pd.DataFrame(consensus).rename(columns={'drug': 'perturbation'})

    df_enrichment = pd.json_normalize(
        enrichment,
        record_path=['geneSets', 'nodes'],
        meta=['geneSetHash', 'pvalue', 'adjPvalue', 'oddsRatio', 'nOverlap']
    )
    if df_enrichment.empty:
        return pd.DataFrame(), pd.DataFrame()
    df_enrichment["approved"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['approved'] if len(x) > 0 else False)
    df_enrichment["count"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['count'] if len(x) > 0 else 0)
    df_enrichment.drop(columns=['geneSetFdaCountsById.nodes'], inplace=True)
    df_enrichment['direction'] = df_enrichment["term"].map(lambda t: t.split(' ')[-1])

    return df_enrichment, df_consensus
```

Additionally, up and down gene set enrichment analysis queries can be performed in Python against all Perturb-Seqr signatures using the requests library as follows:

```python
def enrich_perturbseqr_up_down(genes_up: list[str], genes_down: list[str], first=100):
  query = {
    "operationName": "PairEnrichmentQuery",
    "variables": {
      "filterTerm": "",
      "offset": 0,
      "first": first,
      "filterFda": False,
      "sortBy": "pvalue_mimic",
      "filterKo": False,
      "topN": 1000,
      "pvalueLe": 0.05,
      "genesUp": genes_up,
      "genesDown": genes_down
    },
    "query": """query PairEnrichmentQuery($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = "", $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
      currentBackground {
        pairedEnrich(
          filterTerm: $filterTerm
          offset: $offset
          first: $first
          filterFda: $filterFda
          sortby: $sortBy
          filterKo: $filterKo
          topN: $topN
          pvalueLe: $pvalueLe
          genesDown: $genesDown
          genesUp: $genesUp
          ) {
            totalCount
            consensusCount
            consensus {
              drug
              oddsRatio
              pvalue
              adjPvalue
              approved
              countSignificant
              countInsignificant
              countUpSignificant
              pvalueUp
              adjPvalueUp
              oddsRatioUp
              pvalueDown
              adjPvalueDown
              oddsRatioDown
              }
              nodes {
                adjPvalueMimic
                adjPvalueReverse
                mimickerOverlap
                oddsRatioMimic
                oddsRatioReverse
                pvalueMimic
                pvalueReverse
                reverserOverlap
                geneSet {
                  nodes {
                    id
                    nGeneIds
                    term
                    geneSetFdaCountsById {
                      nodes {
                        count
                        approved
                        }
                      }
                    }
                  }
                }
              }
            }
          }
    """
  }

  response = requests.post(url, json=query)

  response.raise_for_status()
  res = response.json()

  consensus = res['data']['currentBackground']['pairedEnrich']['consensus']
  enrichment = res['data']['currentBackground']['pairedEnrich']['nodes']

  df_consensus_pair = pd.DataFrame(consensus).rename(columns={'drug': 'perturbation',
                                                              'pvalueUp': 'pvalueMimic',
                                                              'pvalueDown': 'pvalueReverse',
                                                              'adjPvalueUp': 'adjPvalueMimic',
                                                              'adjPvalueDown': 'adjPvalueReverse',
                                                              'oddsRatioUp': 'oddsRatioMimic',
                                                              'oddsRatioDown': 'oddsRatioReverse'
                                                            })
  df_enrichment_pair = pd.DataFrame(enrichment)

  df_enrichment_pair['term'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['term'].split(' ')[0])
  df_enrichment_pair['approved'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['geneSetFdaCountsById']['nodes'][0]['approved'])
  df_enrichment_pair['count'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['geneSetFdaCountsById']['nodes'][0]['count'])
  df_enrichment_pair['nGeneIdsUp'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['nGeneIds'])
  df_enrichment_pair['nGeneIdsDown'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['nGeneIds'])
  df_enrichment_pair["geneSetIdUp"] = df_enrichment_pair["geneSet"].map(
      lambda t: next((node['id'] for node in t['nodes'] if ' up' in node['term']), None)
  )

  df_enrichment_pair["geneSetIdDown"] = df_enrichment_pair["geneSet"].map(
      lambda t: next((node['id'] for node in t['nodes'] if ' down' in node['term']), None)
  )

  df_enrichment_pair = df_enrichment_pair.set_index('term')
  df_enrichment_pair = df_enrichment_pair.drop(columns=['geneSet']).reset_index(drop=False)

  return df_enrichment_pair, df_consensus_pair
```

Overlapping genes can be retrieved from either the single or up- and down-gene set search results using the Perturb-Seqr gene set ids provided in the returned enrichment tables:

```python
## Use this function to get the overlap from a user set of genes and a given Perturb-Seqr gene set (id)
## gene set ids are returned as a part of the enrichment query shown above
def get_overlap(genes, id):
    query = {
    "operationName": "OverlapQuery",
    "variables": {
        "id": id,
        "genes": genes
    },
    "query": """query OverlapQuery($id: UUID!, $genes: [String]!) {geneSet(id: $id) {
    overlap(genes: $genes) {
      nodes {
        symbol
        ncbiGeneId
        description
        summary
      }   }}}"""
    }

    response = requests.post(url, json=query)

    response.raise_for_status()
    res = response.json()
    return [item['symbol'] for item in res['data']['geneSet']['overlap']['nodes']]
```

```python
def get_perturbseqr_up_dn_overlap(genes_up: list[str], genes_down: list[str], id_up: str, id_down: str, overlap_type: str):
    if overlap_type == 'mimicker':
        up_up_overlap = get_overlap(genes_up, id_up)
        dn_dn_overlap = get_overlap(genes_down, id_down)
        return list(set(up_up_overlap) | set(dn_dn_overlap))
    elif overlap_type == 'reverser':
        up_dn_overlap = get_overlap(genes_up, id_down)
        dn_up_overlap = get_overlap(genes_down, id_up)
        return list(set(up_dn_overlap) | set(dn_up_overlap))
```

To find the overlap of a user gene set and the Perturb-Seqr background, the following query can be used to retrieve the overlap and converted symbols:

```python
def get_perturbseqr_valid_genes(genes: list[str]):
    query = {
    "query": """query GenesQuery($genes: [String]!) {
        geneMap2(genes: $genes) {
            nodes {
                gene
                geneInfo {
                    symbol
                    }
                }
            }
        }""",
    "variables": {"genes": genes},
    "operationName": "GenesQuery"
    }

    response = requests.post(url, json=query)

    response.raise_for_status()
    res = response.json()
    return [g['geneInfo']['symbol'] for g in res['data']['geneMap2']['nodes'] if g['geneInfo'] != None]
```

---

Perturb-Seqr is actively being developed by [the Ma'ayan Lab](https://labs.icahn.mssm.edu/maayanlab/).
