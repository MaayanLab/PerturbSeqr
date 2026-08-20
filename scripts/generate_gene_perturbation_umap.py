#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pandas>=1.5.0",
#     "numpy>=1.21.0",
#     "bokeh>=3.0.0",
#     "scipy>=1.9.0",
#     "statsmodels>=0.13.0",
#     "tqdm>=4.60.0",
#     "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
#     "pyenrichr",
#     "goatools",
# ]
# ///
"""
GO BP Enrichment for gene perturbation gene set libraries.

Usage:
    uv run generate_gene_perturbation_umap.py                     # Process all libraries
    uv run generate_gene_perturbation_umap.py --library sciplex   # Process specific library
    uv run generate_gene_perturbation_umap.py --list              # List available libraries
"""

import gzip
import argparse
import pandas as pd
import numpy as np
from collections import OrderedDict
from pathlib import Path
from os import path, mkdir
import re
from textwrap import wrap

from maayanlab_bioinformatics.parse.gmt import gmt_read_dict
import pyenrichr as pye

from scipy.stats import fisher_exact
from statsmodels.stats.multitest import multipletests
from tqdm import tqdm

from bokeh.models import LinearColorMapper, HoverTool, ColumnDataSource
from bokeh.plotting import figure, save
from bokeh.palettes import Viridis256
from bokeh.io import output_file
from bokeh.transform import factor_cmap
from bokeh.palettes import Category20

# broad GO term macro
from goatools.anno.broad_gos import NS2GOS

# Configuration

# Base directory for GMT files
BASE_DIR = Path(__file__).parent.parent / "data"
DRUG_DIR = BASE_DIR / "drug_perturbation"
GENE_DIR = BASE_DIR / "gene_perturbation"

# Output directories
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "umap"
ENRICHMENT_DIR = OUTPUT_DIR / "enrich"
SCATTER_DIR = OUTPUT_DIR / "csv"
FIGURE_DIR = OUTPUT_DIR / "figures"

# Settings for Enrichment analysis
TARGET_LIB = 'GO_Biological_Process_2025'
MIN_OVERLAP = 10
MIN_SET_SIZE = 5

# Library definitions: output_name -> (category, file_stem)
# output_name determines the UMAP filename: {output_name}_UMAP.html
# file_stem is used to locate the combined GMT file (contains both up and down terms)
LIBRARIES = {
    # Gene perturbations
    "lincs-l1000-xpr": ("gene", "lincs-l1000-xpr"),
    "perturbatlas-human": ("gene", "perturb-atlas-human"),
    "perturbatlas-mouse": ("gene", "perturb-atlas-mouse"),
    "creeds-gene": ("gene", "creeds-gene"),
    "geo-gene": ("gene", "rummageo-gene"),
    "replogle": ("gene", "replogle-perturb-seq"),
    "cm4ai": ("gene", "cm4ai"),
}


# GMT Loading Functions

def get_gmt_path(category: str, file_pattern: str) -> Path | None:
    """Get the path to a combined GMT file (contains both up and down terms)."""
    base_dir = DRUG_DIR if category == "drug" else GENE_DIR
    gmt_path = base_dir / f"{file_pattern}.gmt.gz"
    if not gmt_path.exists():
        print(gmt_path)
    return gmt_path if gmt_path.exists() else None


def load_gmt_file(gmt_path: Path) -> dict:
    """
    Load a GMT file and return a dictionary where:
    - Keys are gene set names (terms)
    - Values are space-delimited gene strings

    This format is required for TF-IDF vectorization.
    """

    # Handle gzipped or plain files
    if str(gmt_path).endswith('.gz'):
        open_fn = lambda p: gzip.open(p, 'rt', encoding='utf-8')
    else:
        open_fn = lambda p: open(p, 'r', encoding='utf-8')

    print(f"\tLoading GMT from: {gmt_path}")

    with open_fn(gmt_path) as f:
        lib_dict = gmt_read_dict(f)
        lib_dict = {k:set(v.keys()) for k,v in lib_dict.items()}
        # clean creeds-gene gene set terms
        if re.search('creeds-gene', gmt_path.name):
            lib_dict = {k.split('\t')[0]:v for k,v in lib_dict.items()}
    return lib_dict


def get_library(library_name: str) -> dict:
    """
    Load a library (combined up+down terms).

    Args:
        library_name: Name of the library (e.g., "sciplex", "replogle")

    Returns:
        OrderedDict mapping term names to space-delimited gene strings
    """
    if library_name not in LIBRARIES:
        raise ValueError(f"Unknown library: {library_name}. Available: {list(LIBRARIES.keys())}")

    category, file_pattern = LIBRARIES[library_name]
    gmt_path = get_gmt_path(category, file_pattern)

    if gmt_path is None:
        raise FileNotFoundError(f"GMT file not found for {library_name}")

    return load_gmt_file(gmt_path)

def get_scatter(library_name: str) -> pd.DataFrame:
    """
    Loads umap embeddings for a library.
    Args:
        library_name: Name of the library (e.g., "sciplex", "replogle")
    Returns:
        UMAP embeddings dataframe to be use for plotting
    """
    scatter_df = pd.read_csv(f'{SCATTER_DIR}/{library_name}.csv')
    return scatter_df

## Enrichment Functions ##

def load_target_library(target: str) -> dict:
    """
    Loads a Enrichr library
    Args:
        target: name of Enrichr library
    Returns:
        Dictionary for Enrichr library
    """
    target_lib = pye.libraries.get_library(library=target)
    return target_lib

def run_fishers(query_lib:dict, target_lib:dict) -> pd.DataFrame:
    """
    Runs fisher's test for query_lib against target_lib
    Args:
        query_lib: gene set library
        target_lib: gene set library
    Returns:
       dataframe of p-values (N target_lib x N query_lib )
    """
    enr_results = pye.enrichment.fisher(query_lib, target_lib, min_set_size=MIN_SET_SIZE, min_overlap=MIN_OVERLAP)
    enr_pmat = pye.enrichment.consolidate(enr_results)
    return enr_pmat

def label_top_terms(enr_pmat: pd.DataFrame, scatter_df: pd.DataFrame, to_drop: list):
    """
    Labels each signature with it's top enriched term
    Args:
        enr_pmat: dataframe of Fisher's p-values
        scatter_df: UMAP embeddings for each signature
        to_drop: terms to filter out of enrichment results (broad GO terms)
    Returns:
        Dataframe with each signatures top enriched term
    """
    top_go_terms = {}
    top_p_vals = []
    for col in enr_pmat.columns:
        top_term = enr_pmat.loc[:,col].sort_values(ascending=True).index.values
        filtered_terms = [t for t in top_term if t not in to_drop]
        top_go_terms[col] = filtered_terms[0]
        top_p_vals.append(enr_pmat.loc[filtered_terms[0],col])
    top_terms_df = pd.DataFrame({'term':top_go_terms.keys(), 'top_go_term':top_go_terms.values(), 'p_value':top_p_vals})
    top_terms_df = top_terms_df.merge(scatter_df[['term','cluster']], how='left', on='term')
    return top_terms_df

def get_enrichment_data(pmat_df: pd.DataFrame, term:str) -> pd.DataFrame:
    """
    Retrieve enrichment results for a target term
    Args:
        enr_pmat: dataframe of Fisher's p-values
        term: term from target library
    Returns:
        Dataframe with enrichment results for term
    """
    term_enr_df = pd.DataFrame(pmat_df.loc[term,:]).reset_index()
    term_enr_df = term_enr_df.rename(columns = {'index':'sig_id',term:'p-value'})
    term_enr_df['log10_pval'] = np.log10(term_enr_df['p-value'])*-1
    return term_enr_df

# Cluster / Term Specificity Calculations

def calculate_specificity(top_terms_df:pd.DataFrame):
    """
    Calculate specficity of each term to each leiden cluster
    Args:
        top_terms_df: Dataframe with each signatures top enriched term and leiden cluster
        term: term from target library
    Returns:
        Dataframe with specificity results from fisher's test
    """
    clusters = top_terms_df['cluster'].unique()
    go_terms = top_terms_df['top_go_term'].unique()
    term_vec = np.array(top_terms_df.top_go_term.to_list())
    clust_vec = np.array(top_terms_df.cluster.to_list())

    results = []
    for clust in tqdm(clusters):
        for t in go_terms:
            
            a = sum((clust_vec == clust) * (term_vec == t))
            b = sum((clust_vec == clust) * (term_vec != t))
            c = sum((clust_vec != clust) * (term_vec == t))
            d = sum((clust_vec != clust) * (term_vec != t))

            table = [[a, b],
                    [c, d]]

            odds_ratio, p = fisher_exact(table, alternative='greater')

            results.append({
                'cluster': clust,
                'term': t,
                'count': a,
                'odds_ratio': odds_ratio,
                'p_value': p
            })

    results = pd.DataFrame(results)

    # FDR correction
    results['fdr'] = multipletests(results['p_value'], method='fdr_bh')[1]

    return results

# Visualization
def compute_outliers(scatter_df:pd.DataFrame, n_std:int=3):
    '''
    Add outlier column to scatter_df that denotes signatures
    over n_std from the mean UMAP coordinates
    Args:
        scatter_df: UMAP embeddings for each signature
        n_std: # of SD used to classify outliers
    Directly updates scatter_df
    '''
    x = np.array(scatter_df['x'].to_list())
    y = np.array(scatter_df['y'].to_list())
    x_min, x_mu, x_std, x_max = np.min(x), np.mean(x), np.std(x), np.max(x)
    x_lo, x_hi = max(x_min, x_mu - x_std*n_std), min(x_max, x_mu + x_std*n_std)
    y_min, y_mu, y_std, y_max = np.min(y), np.mean(y), np.std(y), np.max(y)
    y_lo, y_hi = max(y_min, y_mu - y_std*n_std), min(y_max, y_mu + y_std*n_std)
    scatter_df['outlier'] = scatter_df.apply(lambda row: ~((row['x']>=x_lo)&(row['x']<=x_hi)&(row['y']>=y_lo)&(row['y']<=y_hi)), axis = 1)

def create_scatterplot_term(scatter_df: pd.DataFrame, enrich_df: pd.DataFrame, term:str) -> figure:
    """
    Create an interactive Bokeh scatterplot colored by term enrichment -log10(p-value)
    Args:
        scatter_df: DataFrame with x, y, direction, cluster, term, genes columns
        enrich_df: Dataframe with -log10(p-values) for term
        title: Plot title
    Returns:
        Bokeh figure object
    """
    df = scatter_df.copy()
    df = df.merge(enrich_df, how='left', left_on='term', right_on='sig_id')
    df = df.dropna(subset='log10_pval')
    df = df.sort_values(by='log10_pval', ascending=True)

    # Assign colors by log10 p-value for term enrichment
    if df['log10_pval'].min() == np.percentile(df['log10_pval'],98):
        max_val = df['log10_pval'].max()
    else:
        max_val = np.percentile(df['log10_pval'], 98)
    color_mapper = LinearColorMapper(palette="Viridis256", low=df['log10_pval'].min(), high=max_val)

    tooltips = [
        ("Gene Set", "@gene_set"),
        ("Direction", "@direction"),
        ("Cluster", "@cluster"),
    ]

    hover_emb = HoverTool(tooltips=tooltips)
    tools_emb = [hover_emb, 'pan', 'wheel_zoom', 'reset', 'save']

    plot_emb = figure(
        sizing_mode='stretch_both',
        tools=tools_emb,
        title=f"{term} Enrichment"
    )

    source = ColumnDataSource(
        data=dict(
            x=df['x'],
            y=df['y'],
            gene_set=df['term'],
            direction=df['direction'],
            cluster=df['cluster'],
            log10_pval = df['log10_pval']
        )
    )

    # Hide axis labels and grid lines
    plot_emb.xaxis.major_tick_line_color = None
    plot_emb.xaxis.minor_tick_line_color = None
    plot_emb.yaxis.major_tick_line_color = None
    plot_emb.yaxis.minor_tick_line_color = None
    plot_emb.xaxis.major_label_text_font_size = '0pt'
    plot_emb.yaxis.major_label_text_font_size = '0pt'

    plot_emb.output_backend = "svg"

    plot_emb.xaxis.axis_label = "UMAP_1"
    plot_emb.yaxis.axis_label = "UMAP_2"

    r = plot_emb.scatter(
        'x',
        'y',
        size=4,
        source=source,
        color=dict(field='log10_pval', transform=color_mapper)
    )
    color_bar = r.construct_color_bar(padding=0,
                                      ticker=plot_emb.xaxis.ticker,
                                      formatter=plot_emb.xaxis.formatter,
                                      title = '-log10(P-value)')
    
    plot_emb.add_layout(color_bar, 'below')

    return plot_emb

def create_scatterplot(scatter_df: pd.DataFrame, top_terms_df: pd.DataFrame, specific_terms_df: pd.DataFrame, title: str = "UMAP") -> figure:
    """
    Create an interactive Bokeh scatterplot colored by 10 most commonly enriched GO terms
    Args:
        scatter_df: DataFrame with x, y, direction, cluster, term, genes columns
        top_terms_df: DataFrame with most enriched GO term for each signature
        title: Plot title
    Returns:
        Bokeh figure object
    """
    # remove outleirs
    compute_outliers(scatter_df, 3)
    df = scatter_df.copy()
    df = df[~df['outlier']]
    # add signature and cluster GO term labels
    top_terms_df['enr_p_value'] = top_terms_df['p_value']
    df = df.merge(top_terms_df[['term','top_go_term','enr_p_value']], how='left', on='term')
    df = df.merge(specific_terms_df, how='left', on='cluster')
    # classify terms for signatures not enriched for cluster's most specific term as 'Other'
    df['color_go_term'] = df.apply(lambda row: row['top_go_term'] if row['top_go_term']==row['cluster_go_term'] else 'Other', axis=1)
    # classify terms for signatures with no evidence for enrichment against any GO terms as 'No Enrichment'
    df['color_go_term'] = df.apply(lambda row: 'No Enrichment' if row['enr_p_value']==1 else row['color_go_term'] , axis=1)
    # wrapped term for legend label
    df['wrapped_go'] = df['color_go_term'].apply(lambda x: "\n".join(wrap(str(x), 20)))
    # reorder for plotting
    category_counts = df.groupby('color_go_term').size().reset_index(name='count')
    category_counts = category_counts.sort_values('count', ascending=False)
    df = df.merge(category_counts, how='left', on='color_go_term')
    df = df.sort_values('count', ascending=False)

    # Color mapping
    n_colors = max(3, min(20, df['color_go_term'].nunique() - 2))
    palette = Category20[n_colors]
    term_colors = {c: palette[i % len(palette)] for i, c in enumerate(df['wrapped_go'].unique())}
    term_colors['Other'] = '#CCCCCC'
    term_colors['No Enrichment'] = "#8F8F8F"
    df['color'] = df['wrapped_go'].map(term_colors)
    df['alpha'] = df['color_go_term'].apply(lambda x: 0.5 if x in ['No Enrichment','Other'] else 1)
    
    tooltips = [
        ("Gene Set", "@gene_set"),
        ("Direction", "@direction"),
        ("Cluster", "@cluster"),
        ("GO Term", "@go_term_hover"),
        ("Enrichment P-Value", "@enr_p_value")
    ]
    hover_emb = HoverTool(tooltips=tooltips)
    tools_emb = [hover_emb, 'pan', 'wheel_zoom', 'reset', 'save']
    plot_emb = figure(
        sizing_mode='stretch_both',
        tools=tools_emb,
        title=title
    )

    source = ColumnDataSource(
        data=dict(
            x=df['x'],
            y=df['y'],
            gene_set=df['term'],
            colors=df['color'],
            direction=df['direction'],
            go_term = df['wrapped_go'],
            go_term_hover = df['top_go_term'],
            cluster=df['cluster'],
            alphas=df['alpha'],
            enr_p_value=df['enr_p_value']
        )
    )
    
    # Hide axis labels and grid lines
    plot_emb.xaxis.major_tick_line_color = None
    plot_emb.xaxis.minor_tick_line_color = None
    plot_emb.yaxis.major_tick_line_color = None
    plot_emb.yaxis.minor_tick_line_color = None
    plot_emb.xaxis.major_label_text_font_size = '0pt'
    plot_emb.yaxis.major_label_text_font_size = '0pt'

    plot_emb.output_backend = "svg"

    plot_emb.xaxis.axis_label = "UMAP_1"
    plot_emb.yaxis.axis_label = "UMAP_2"

    plot_emb.scatter(
        'x',
        'y',
        source=source,
        size=4,
        color='colors',
        legend_group='go_term',
        fill_alpha='alphas',
        line_alpha='alphas'
    )

    # Legend formatting
    plot_emb.add_layout(plot_emb.legend[0],'right')
    return plot_emb

# Main Processing Functions

def process_library(
    library_name: str,
    run_enrichment: bool = True,
    run_specificity: bool = True,
    save_html: bool = True
) -> pd.DataFrame:
    """
    Process a single library (combined up+down) and save outputs.

    Args:
        library_name: Name of the library
        run_enrichment: Indicator to run enrichment analysis or use saved results

    Saves enrichment results and specficity table
    """
    # Ensure output directories exist
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    ENRICHMENT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = ENRICHMENT_DIR / f"{library_name}.csv"
    
    if run_enrichment:
        print(f"\n{'='*60}")
        print(f"Processing: {library_name}")
        print(f"{'='*60}")

        # Load library (combined up+down)
        lib_dict = get_library(library_name)

        # Adjust parameters for very large libraries
        if len(lib_dict) > 100000:
            print(f"\tLarge library detected ({len(lib_dict)} sets), adjusting parameters...")
            n_neighbors = min(n_neighbors, 15)

        # Retrieve top enriched GO term for signature        
        target_lib = load_target_library(TARGET_LIB)
        # Fisher's test
        enrich_pmat = run_fishers(lib_dict, target_lib)
        # Save CSV
        enrich_pmat.to_csv(csv_path)
        print(f"\tSaved CSV: {csv_path}")

    else:
        print(f"\tLoading {csv_path}...")
        enrich_pmat = pd.read_csv(csv_path, index_col='term')
    
    print('\tRetrieving top enriched terms...')
    
    scatter_df = get_scatter(library_name)

    # identify broad GO terms in enrichment results
    id_pattern = r"GO:\d+"
    go_id_dict = {re.search(id_pattern, id).group():id for id in enrich_pmat.index.values}
    to_drop = [go_id_dict[id] for id in NS2GOS['BP'] if id in go_id_dict]

    top_terms_df = label_top_terms(enrich_pmat, scatter_df, to_drop)

    # Calculate term specficity
    csv_path = ENRICHMENT_DIR / f"{library_name}_specificity.csv"
    if run_specificity:
        print('\tCalculating specificity of terms to clusters...')
        results = calculate_specificity(top_terms_df)
        results.to_csv(csv_path, index=False)
        print(f"\tSaved CSV: {csv_path}")
    else:
        print(f"\tLoading {csv_path}...")
        results = pd.read_csv(csv_path)

    cluster_specific_terms_df = results.sort_values('fdr', ascending=True)\
        .groupby('cluster')\
            .agg('first')\
                .reset_index()\
                    .rename(columns={'term':'cluster_go_term','count':'sig_count'})
    
    # Save HTML visualization
    if save_html:
        html_path = FIGURE_DIR / f"{library_name}_UMAP.html"
        plot = create_scatterplot(scatter_df,
                                  top_terms_df,
                                  cluster_specific_terms_df,
                                  title=f"{library_name} UMAP")
        output_file(filename=str(html_path), title=f"{library_name} UMAP")
        save(plot)
        print(f"\tSaved HTML: {html_path}")

    return


def process_all_libraries(
    skip_large: bool = False,
    run_enrichment: bool = False,
    run_specificity: bool = False,
    save_html: bool=False
):
    """
    Process all configured libraries.

    Args:
        skip_large: Skip large libraries (L1000-CP, L1000-XPR)
        save_html: Whether to save Bokeh HTML visualizations
    """
    large_libraries = {"lincs-l1000-cp", "lincs-l1000-xpr"}
    for library_name in LIBRARIES.keys():
        if skip_large and library_name in large_libraries:
            print(f"\nSkipping large library: {library_name}")
            continue
        try:
            process_library(
                library_name,
                run_enrichment=run_enrichment,
                run_specificity=run_specificity,
                save_html=save_html
            )
        except FileNotFoundError as e:
            print(f"\nWarning: {e}")
        except Exception as e:
            print(f"\nError processing {library_name}: {e}")


def list_libraries():
    """Print available libraries and their GMT file status."""
    print("\nAvailable Libraries:")
    print("=" * 70)

    for lib_name, (category, file_pattern) in LIBRARIES.items():
        gmt_path = get_gmt_path(category, file_pattern)
        status = "✓" if gmt_path else "✗"
        print(f"  {lib_name:30} {status}  ({category})")

# CLI Entry Point

def main():
    parser = argparse.ArgumentParser(
        description="Generate UMAP embeddings for Perturb-Seqr gene set libraries",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python generate_gene_perturbation_umap.py                          # Process all libraries
    python generate_gene_perturbation_umap.py --library sciplex        # Process specific library
    python generate_gene_perturbation_umap.py --skip-large             # Skip L1000-CP and L1000-XPR
    python generate_gene_perturbation_umap.py --list                   # List available libraries
    python generate_gene_perturbation_umap.py --skip-enrichment # Skip enrichment analysis 
        """
    )

    parser.add_argument(
        "--library", "-l",
        type=str,
        help="Process a specific library (e.g., sciplex, replogle)"
    )
    parser.add_argument(
        "--skip-large",
        action="store_true",
        help="Skip large libraries (L1000-CP, L1000-XPR)"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available libraries and exit"
    )

    parser.add_argument(
        "--skip-enrichment",
        action="store_true",
        help="Don't generate new UMAP embeddings and use saved embeddings"
    )

    parser.add_argument(
        "--skip-cluster-enrichment",
        action="store_true",
        help="Don't calculate cluster term enrichment and use saved results"
    )

    parser.add_argument(
        "--no-html",
        action="store_true",
        help="Skip HTML plot generation"
    )

    args = parser.parse_args()

    if args.list:
        list_libraries()
        return

    if args.library:
        try:
            process_library(
                args.library,
                run_enrichment= not args.skip_enrichment,
                run_specificity = not args.skip_cluster_enrichment,
                save_html = not args.no_html
            )
        except FileNotFoundError as e:
            print(f"Error: {e}")
    else:
        process_all_libraries(
            skip_large=args.skip_large,
            run_enrichment= not args.skip_enrichment,
            run_specificity = not args.skip_cluster_enrichment,
            save_html = not args.no_html
        )

    print("\nDone!")


if __name__ == "__main__":
    main()
