"""
Replogle signed-cosine on ternary GMT vectors vs CORUM, HuMAP, Reactome, SIGNOR, StringDB, split into K562 genomewide / K562 essential / RPE1 essential.
EFAAR: https://github.com/recursionpharma/EFAAR_benchmarking
"""

import gzip
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.utils import Bunch

import efaar_benchmarking as efaar
from efaar_benchmarking import benchmarking, constants
from efaar_benchmarking.plotting import plot_recall
from maayanlab_bioinformatics.parse.gmt import GMT, gmt_read_iter


REPO_ROOT = Path("/Users/johngardner_mountsinai/work/PerturbSeqr")
REPLOGLE_GMT = REPO_ROOT / "db" / "data" / "gene_perturbation" / "replogle-perturb-seq.gmt.gz"

# (cell_line, library) → subset name. Anything else (NON-TARGETING, ENST*, etc.) is skipped.
SUBSETS = {
    ("K562", "genomewide"): "replogle_k562_genomewide",
    ("K562", "essential"):  "replogle_k562_essential",
    ("RPE1", "essential"):  "replogle_rpe1_essential",
}


def load_replogle_subsets() -> dict[str, dict[str, dict[str, set[str]]]]:
    """{subset → {target_gene → {"up": {...}, "down": {...}}}}.
    Term shape: target::cell_line::::day::::modality::method::pool::library::<id> up|down
    """
    out: dict = defaultdict(lambda: defaultdict(lambda: {"up": set(), "down": set()}))
    opener = gzip.open if REPLOGLE_GMT.suffix == ".gz" else open
    with opener(REPLOGLE_GMT, "rt") as fh:
        for term, geneset in gmt_read_iter(fh):
            parts = term.split("::")
            if len(parts) != 10:
                continue
            target, cell_line, library = parts[0], parts[1], parts[8]
            if target.startswith("ENST") or target == "NON-TARGETING":
                continue
            if (subset := SUBSETS.get((cell_line, library))) is None:
                continue
            m = re.match(r"^\S+\s+(up|down)$", parts[9])
            if not m:
                continue
            out[subset][target][m.group(1)].update(geneset.keys())
    return {s: dict(t) for s, t in out.items()}


def build_ternary_matrix(perts_by_target) -> tuple[list[str], list[str], np.ndarray]:
    """{target → {"up": set, "down": set}} → (targets, universe, V).

    Shape `perturbations x genes` is what EFAAR's `known_relationship_benchmark` expects.
    """
    targets = sorted(perts_by_target)
    universe = sorted({g for p in perts_by_target.values() for g in p["up"] | p["down"]})
    terms = [(t, "") for t in targets]
    up_lists = [list(perts_by_target[t]["up"] - perts_by_target[t]["down"]) for t in targets]
    dn_lists = [list(perts_by_target[t]["down"] - perts_by_target[t]["up"]) for t in targets]
    M_up = GMT(background=universe, terms=terms, gene_lists=up_lists).to_spmatrix()
    M_dn = GMT(background=universe, terms=terms, gene_lists=dn_lists).to_spmatrix()
    return targets, universe, (M_up - M_dn).toarray().astype(np.int8)


def benchmark_subset(targets: list[str], universe: list[str], V: np.ndarray,
                     **kwargs) -> pd.DataFrame:
    """Run EFAAR's `known_relationship_benchmark` on a ternary matrix.

    Wraps `V` as a `Bunch(features, metadata)` and dispatches. Returns a DataFrame
    with one row per benchmark source (CORUM/HuMAP/Reactome/SIGNOR/StringDB) and
    columns `recall_0.05_0.95`, `recall_0.1_0.9`
    """
    map_data = Bunch(
        features=pd.DataFrame(V, columns=universe),
        metadata=pd.DataFrame({"pert": targets}),
    )
    return benchmarking.known_relationship_benchmark(map_data, pert_col="pert", **kwargs)


def benchmark_all_subsets(log_stats: bool = False) -> pd.DataFrame:
    rows = []
    for name, perts in load_replogle_subsets().items():
        targets, universe, V = build_ternary_matrix(perts)
        if log_stats:
            print(f"\n=== {name}: {V.shape[0]} perts × {V.shape[1]} genes ===")
        df = benchmark_subset(targets, universe, V, log_stats=log_stats)
        df.insert(0, "subset", name)
        rows.append(df)
    return pd.concat(rows, ignore_index=True)


def plot_replogle(results: pd.DataFrame, out_path: Path) -> None:
    import matplotlib.pyplot as plt
    metric_dfs = {sub: results[results.subset == sub].reset_index(drop=True)
                  for sub in results.subset.unique()}
    plot_recall(metric_dfs, title="Replogle: signed cosine on ternary GMT vs EFAAR ground truths")
    plt.gcf().savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close("all")
    print(f"  saved plot → {out_path}")


def plot_replogle_celik(results: pd.DataFrame, out_path: Path) -> None:
    """Celik 2024 Fig 3 style: one panel per subset, one bar per ground truth, 10% baseline."""
    import matplotlib.pyplot as plt
    sources = ["CORUM", "HuMAP", "Reactome", "SIGNOR", "StringDB"]
    subsets = sorted(results.subset.unique())
    fig, axes = plt.subplots(1, len(subsets), figsize=(13, 4), sharey=True)
    for ax, sub in zip(axes, subsets):
        vals = (results[results.subset == sub]
                .set_index("source").loc[sources, "recall_0.05_0.95"] * 100)
        ax.bar(range(len(sources)), vals, color="steelblue", edgecolor="black", linewidth=0.5)
        ax.axhline(10, ls="--", c="black", lw=1)
        ax.text(len(sources) - 0.5, 10.5, "Random\nbaseline", va="bottom", ha="right",
                fontsize=8, fontstyle="italic")
        ax.set_title(sub.replace("replogle_", ""), fontsize=10)
        ax.set_xticks(range(len(sources)))
        ax.set_xticklabels(sources, rotation=30, ha="right", fontsize=9)
        ax.set_ylim(0, 65)
        ax.grid(False)
    axes[0].set_ylabel("Recall @ 5% tails (%)")
    fig.suptitle("Biological relationship benchmarks on Replogle (signed cosine on ternary GMT)",
                 fontsize=11)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  saved plot → {out_path}")


if __name__ == "__main__":
    results = benchmark_all_subsets(log_stats=True)
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    results.to_csv(results_dir / "replogle_known_relationship.csv", index=False)
    plot_replogle(results, results_dir / "replogle_known_relationship.png")
    plot_replogle_celik(results, results_dir / "replogle_celik.png")
    print()
    print(results.to_string(index=False))
