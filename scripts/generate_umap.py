#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pandas>=1.5.0",
#     "scanpy>=1.9.0",
#     "anndata>=0.8.0",
#     "scikit-learn>=1.0.0",
#     "bokeh>=3.0.0",
#     "umap-learn>=0.5.0",
#     "igraph>=0.10.0",
#     "leidenalg>=0.9.0",
# ]
# ///
"""
UMAP embeddings for gene set libraries.
Based on: https://github.com/MaayanLab/enrichr_utils/blob/master/Enrichr_Viz.ipynb

Usage:
    uv run generate_umap.py                     # Process all libraries
    uv run generate_umap.py --library sciplex   # Process specific library
    uv run generate_umap.py --list              # List available libraries
"""

import gzip
import argparse
import pandas as pd
import scanpy as sc
import anndata
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import OrderedDict
from pathlib import Path
from os import path, mkdir

# Bokeh (for optional HTML visualization)
from bokeh.io import output_file
from bokeh.plotting import figure, save
from bokeh.models import HoverTool, ColumnDataSource
from bokeh.palettes import Category20


# Configuration

# Base directory for GMT files
BASE_DIR = Path(__file__).parent.parent / "db" / "data"
DRUG_DIR = BASE_DIR / "drug_perturbation"
GENE_DIR = BASE_DIR / "gene_perturbation"

# Output directories
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "umap"
SCATTER_DIR = OUTPUT_DIR / "csv"
FIGURE_DIR = OUTPUT_DIR / "figures"

# Library definitions: library_name -> (directory, file_pattern)
# We process up and down separately, then can combine if needed
LIBRARIES = {
    # Drug perturbations
    "sciplex": ("drug", "sciplex"),
    "nibr-drug-seq": ("drug", "nibr-drug-seq"),
    "deepcover-moa": ("drug", "deepcover-moa"),
    "ginkgo-bioworks": ("drug", "ginkgo-bioworks"),
    "lincs-l1000-cp": ("drug", "lincs-l1000-cp"),
    "geo-chem": ("drug", "geo-chem"),
    "tahoe-100m": ("drug", "tahoe-100m"),
    "microarrays-cmap": ("drug", "microarrays-cmap"),
    # Gene perturbations
    "lincs-l1000-xpr": ("gene", "lincs-l1000-xpr"),
    "perturb-atlas": ("gene", "perturb-atlas"),
    "perturb-atlas-mouse": ("gene", "perturb-atlas-mouse"),
    "geo-gene": ("gene", "geo-gene"),
    "replogle-perturb-seq-k562-essential": ("gene", "replogle-perturb-seq-k562-essential"),
    "replogle-perturb-seq-k562-genomewide": ("gene", "replogle-perturb-seq-k562-genomewide"),
    "replogle-perturb-seq-rpe1-essential": ("gene", "replogle-perturb-seq-rpe1-essential"),
}


# GMT Loading Functions

def get_gmt_path(category: str, file_pattern: str, direction: str) -> Path:
    """Get the path to a GMT file."""
    base_dir = DRUG_DIR if category == "drug" else GENE_DIR

    # Normalize direction: "dn" -> also try "down"
    directions = [direction]
    if direction == "dn":
        directions.append("down")

    for d in directions:
        path = base_dir / f"{file_pattern}-{d}.gmt.gz"
        if path.exists():
            return path

    return None


def load_gmt_file(gmt_path: Path) -> OrderedDict:
    """
    Load a GMT file and return a dictionary where:
    - Keys are gene set names (terms)
    - Values are space-delimited gene strings

    This format is required for TF-IDF vectorization.
    """
    lib_dict = OrderedDict()

    # Handle gzipped or plain files
    if str(gmt_path).endswith('.gz'):
        open_fn = lambda p: gzip.open(p, 'rt', encoding='utf-8')
    else:
        open_fn = lambda p: open(p, 'r', encoding='utf-8')

    print(f"\tLoading GMT from: {gmt_path}")

    with open_fn(gmt_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            # GMT format: term \t\t gene1 \t gene2 \t gene3 ...
            # or: term \t description \t gene1 \t gene2 ...
            tokens = line.split("\t\t")

            if len(tokens) >= 2:
                term = tokens[0].strip()
                genes = [g.strip() for g in tokens[1].split('\t') if g.strip()]
            else:
                # Fallback: split by single tab
                parts = line.split("\t")
                term = parts[0].strip()
                # Skip description field if present (index 1), genes start at index 2
                genes = [g.strip() for g in parts[2:] if g.strip()]

            if term and genes:
                lib_dict[term] = ' '.join(genes)

    print(f"\tLoaded {len(lib_dict)} gene sets")
    return lib_dict


def get_scatter_library(library_name: str, direction: str = "up") -> OrderedDict:
    """
    Load a library by name and direction.

    Args:
        library_name: Name of the library (e.g., "sciplex", "l1000-cp")
        direction: "up" or "dn" (down-regulated genes)

    Returns:
        OrderedDict mapping term names to space-delimited gene strings
    """
    if library_name not in LIBRARIES:
        raise ValueError(f"Unknown library: {library_name}. Available: {list(LIBRARIES.keys())}")

    category, file_pattern = LIBRARIES[library_name]
    gmt_path = get_gmt_path(category, file_pattern, direction)

    if gmt_path is None or not gmt_path.exists():
        raise FileNotFoundError(f"GMT file not found for {library_name} ({direction})")

    return load_gmt_file(gmt_path)


# UMAP Processing Functions

def process_scatterplot(
    libdict: OrderedDict,
    n_neighbors: int = 30,
    min_dist: float = 0.1,
    spread: float = 1.0,
    max_df: float = 1.0,
    min_df: int = 1,
    random_state: int = 42
) -> pd.DataFrame:
    """
    Generate UMAP embedding for a gene set library.

    Pipeline:
    1. TF-IDF vectorization of gene sets
    2. k-NN graph construction
    3. Leiden clustering
    4. UMAP dimensionality reduction

    Args:
        libdict: Dictionary mapping term names to space-delimited gene strings
        n_neighbors: Number of neighbors for UMAP (higher = more global structure)
        min_dist: Minimum distance between points (lower = tighter clusters)
        spread: Scale of the embedding
        max_df: Ignore genes appearing in more than this fraction of gene sets
        min_df: Ignore genes appearing in fewer than this many gene sets
        random_state: Random seed for reproducibility

    Returns:
        DataFrame with columns: x, y, cluster, term, genes
    """
    print(f"\tTF-IDF vectorizing {len(libdict)} gene sets...")
    vec = TfidfVectorizer(max_df=max_df, min_df=min_df)
    X = vec.fit_transform(libdict.values())
    print(f"\tMatrix shape: {X.shape} (gene sets x unique genes)")

    # Create AnnData object for scanpy
    adata = anndata.AnnData(X)
    adata.obs.index = list(libdict.keys())

    print(f"\tBuilding k-NN graph (n_neighbors={n_neighbors})...")
    sc.pp.neighbors(adata, n_neighbors=n_neighbors, use_rep='X')

    print(f"\tPerforming Leiden clustering...")
    sc.tl.leiden(adata, resolution=1.0, flavor='igraph', n_iterations=2, directed=False)

    print(f"\tComputing UMAP embedding (min_dist={min_dist}, spread={spread})...")
    sc.tl.umap(adata, min_dist=min_dist, spread=spread, random_state=random_state)

    # Build output DataFrame directly (avoid subsetting adata which can fail on large datasets)
    df = pd.DataFrame({
        'x': adata.obsm['X_umap'][:, 0],
        'y': adata.obsm['X_umap'][:, 1],
        'cluster': 'Cluster ' + adata.obs['leiden'].astype(str),
        'term': adata.obs.index,
        'genes': [libdict[t] for t in adata.obs.index],
    })
    # Sort by cluster for consistent ordering
    df = df.sort_values(by='cluster').reset_index(drop=True)

    n_clusters = df['cluster'].nunique()
    print(f"\tFound {n_clusters} clusters")

    return df


# Visualization Functions (Bokeh)

def get_scatter_colors(df: pd.DataFrame) -> dict:
    """Map cluster names to colors from Category20 palette."""
    clusters = pd.unique(df['cluster']).tolist()
    colors = list(Category20[20])[::2] + list(Category20[20])[1::2]
    color_mapper = {clusters[i]: colors[i % 20] for i in range(len(clusters))}
    return color_mapper


def create_scatterplot(scatter_df: pd.DataFrame, title: str = "UMAP") -> figure:
    """
    Create an interactive Bokeh scatterplot.

    Args:
        scatter_df: DataFrame with x, y, cluster, term, genes columns
        title: Plot title

    Returns:
        Bokeh figure object
    """
    df = scatter_df.copy()
    color_mapper = get_scatter_colors(df)
    df['color'] = df['cluster'].apply(lambda x: color_mapper[x])

    tooltips = [
        ("Gene Set", "@gene_set"),
        ("Cluster", "@label"),
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
            label=df['cluster']
        )
    )

    # Hide axis labels and grid lines (like Enrichr)
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
        size=4,
        source=source,
        color='colors',
        legend_group='label'
    )

    plot_emb.add_layout(plot_emb.legend[0], 'right')

    return plot_emb


# Main Processing Functions

def process_library(
    library_name: str,
    direction: str = "up",
    n_neighbors: int = 30,
    min_dist: float = 0.1,
    save_html: bool = True
) -> pd.DataFrame:
    """
    Process a single library and save outputs.

    Args:
        library_name: Name of the library
        direction: "up" or "dn"
        n_neighbors: UMAP parameter
        min_dist: UMAP parameter
        save_html: Whether to save Bokeh HTML visualization

    Returns:
        DataFrame with UMAP coordinates
    """
    print(f"\n{'='*60}")
    print(f"Processing: {library_name} ({direction})")
    print(f"{'='*60}")

    # Load library
    lib_dict = get_scatter_library(library_name, direction)

    # Adjust parameters for very large libraries
    if len(lib_dict) > 100000:
        print(f"\tLarge library detected ({len(lib_dict)} sets), adjusting parameters...")
        n_neighbors = min(n_neighbors, 15)

    # Generate UMAP
    scatter_df = process_scatterplot(
        lib_dict,
        n_neighbors=n_neighbors,
        min_dist=min_dist
    )

    # Ensure output directories exist
    SCATTER_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)

    # Save CSV
    csv_path = SCATTER_DIR / f"{library_name}_{direction}.csv"
    scatter_df.to_csv(csv_path, index=False)
    print(f"\tSaved CSV: {csv_path}")

    # Save HTML visualization
    if save_html:
        html_path = FIGURE_DIR / f"{library_name}_{direction}_UMAP.html"
        plot = create_scatterplot(scatter_df, title=f"{library_name} ({direction}) UMAP")
        output_file(filename=str(html_path), title=f"{library_name} UMAP")
        save(plot)
        print(f"\tSaved HTML: {html_path}")

    return scatter_df


def process_all_libraries(
    directions: list = ["up", "dn"],
    skip_large: bool = False,
    save_html: bool = True
):
    """
    Process all configured libraries.

    Args:
        directions: List of directions to process
        skip_large: Skip libraries with >500k gene sets (L1000-CP, L1000-XPR)
        save_html: Whether to save Bokeh HTML visualizations
    """
    large_libraries = {"lincs-l1000-cp", "lincs-l1000-xpr"}

    for library_name in LIBRARIES.keys():
        if skip_large and library_name in large_libraries:
            print(f"\nSkipping large library: {library_name}")
            continue

        for direction in directions:
            try:
                process_library(
                    library_name,
                    direction=direction,
                    save_html=save_html
                )
            except FileNotFoundError as e:
                print(f"\nWarning: {e}")
            except Exception as e:
                print(f"\nError processing {library_name} ({direction}): {e}")


def list_libraries():
    """Print available libraries and their GMT file status."""
    print("\nAvailable Libraries:")
    print("=" * 70)

    for lib_name, (category, file_pattern) in LIBRARIES.items():
        up_path = get_gmt_path(category, file_pattern, "up")
        dn_path = get_gmt_path(category, file_pattern, "dn")

        up_status = "✓" if up_path and up_path.exists() else "✗"
        dn_status = "✓" if dn_path and dn_path.exists() else "✗"

        print(f"  {lib_name:30} up:{up_status}  dn:{dn_status}  ({category})")


# CLI Entry Point

def main():
    parser = argparse.ArgumentParser(
        description="Generate UMAP embeddings for PerturbSeek gene set libraries",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python generate_umap.py                          # Process all libraries
    python generate_umap.py --library sciplex        # Process specific library
    python generate_umap.py --library sciplex --direction up
    python generate_umap.py --skip-large             # Skip L1000-CP and L1000-XPR
    python generate_umap.py --list                   # List available libraries
        """
    )

    parser.add_argument(
        "--library", "-l",
        type=str,
        help="Process a specific library (e.g., sciplex, l1000-cp)"
    )
    parser.add_argument(
        "--direction", "-d",
        type=str,
        choices=["up", "dn", "both"],
        default="both",
        help="Direction to process (default: both)"
    )
    parser.add_argument(
        "--n-neighbors",
        type=int,
        default=30,
        help="Number of neighbors for UMAP (default: 30)"
    )
    parser.add_argument(
        "--min-dist",
        type=float,
        default=0.1,
        help="Minimum distance for UMAP (default: 0.1)"
    )
    parser.add_argument(
        "--skip-large",
        action="store_true",
        help="Skip large libraries (L1000-CP, L1000-XPR)"
    )
    parser.add_argument(
        "--no-html",
        action="store_true",
        help="Skip generating HTML visualizations"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available libraries and exit"
    )

    args = parser.parse_args()

    if args.list:
        list_libraries()
        return

    directions = ["up", "dn"] if args.direction == "both" else [args.direction]

    if args.library:
        # Process single library
        for direction in directions:
            try:
                process_library(
                    args.library,
                    direction=direction,
                    n_neighbors=args.n_neighbors,
                    min_dist=args.min_dist,
                    save_html=not args.no_html
                )
            except FileNotFoundError as e:
                print(f"Error: {e}")
    else:
        # Process all libraries
        process_all_libraries(
            directions=directions,
            skip_large=args.skip_large,
            save_html=not args.no_html
        )

    print("\nDone!")


if __name__ == "__main__":
    main()
