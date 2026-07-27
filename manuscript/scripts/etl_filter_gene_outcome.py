"""Plot per-dataset gene outcomes from the current intermediate and final GMTs."""

import gzip
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import StrMethodFormatter

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.metadata.gene import (
    _mouse_to_human_ortholog,
    non_protein_coding_genes,
)

ROOT = Path(__file__).parents[2]
DATA_SOURCES = ROOT / "etl" / "perturbseqr_etl" / "data_sources"
DATA = ROOT / "data"
OUTPUT_DIR = ROOT / "manuscript" / "figures" / "etl"
PNG_OUTPUT = OUTPUT_DIR / "FigureS1_Gene_Pre_Processing.png"
SVG_OUTPUT = OUTPUT_DIR / "FigureS1_Gene_Pre_Processing.svg"

DISPLAY_NAMES = {
    "cm4ai": "CM4AI",
    "creeds-chem": "CREEDS Chemical",
    "creeds-gene": "CREEDS Gene",
    "deepcover-moa": "DeepCover MoA",
    "ginkgo-bioworks": "Ginkgo Bioworks",
    "lincs-l1000-cp": "LINCS L1000 CP",
    "lincs-l1000-xpr": "LINCS L1000 XPR",
    "microarrays-cmap": "Microarrays CMap",
    "nibr-drug-seq": "NIBR DRUG-seq",
    "perturb-atlas-human": "Perturb Atlas Human",
    "perturb-atlas-mouse": "Perturb Atlas Mouse",
    "replogle-perturb-seq": "Replogle et al.",
    "rummageo-chem": "RummaGEO Chemical",
    "rummageo-gene": "RummaGEO Gene",
    "sciplex": "SciPlex",
    "tahoe-100m": "Tahoe-100M",
}

SEGMENTS = [
    ("#4e79a7", "Human protein-coding symbols"),
    ("#59a14f", "Human orthologs translated from mouse symbols"),
    ("#e15759", "Human non-protein-coding symbols"),
    ("#edc948", "Mouse symbols without human orthologs"),
    ("#9c755f", "Symbols from unsupported organisms"),
]


def _genes(path: Path) -> set[str]:
    genes = set()
    with gzip.open(path, "rt") as handle:
        for line in handle:
            genes.update(gene.upper() for gene in line.rstrip("\n").split("\t")[2:] if gene)
    return genes


def _organism(dataset: str, term: str) -> str:
    fields = term.rsplit(" ", 1)[0].split("::")
    if dataset == "creeds-gene":
        return fields[7].strip().lower()
    if dataset == "creeds-chem":
        return fields[5].strip().lower()
    return "human"


def _outcomes(
    dataset: str,
    intermediate: Path,
    final: Path,
    human_non_pc: set[str],
    mouse_to_human: dict[str, str],
) -> tuple[int, ...]:
    retained_human: set[str] = set()
    translated_mouse: set[str] = set()
    excluded_human_non_pc: set[str] = set()
    excluded_mouse: set[str] = set()
    excluded_organism: set[str] = set()

    with gzip.open(intermediate, "rt") as handle:
        for line in handle:
            fields = line.rstrip("\n").split("\t")
            organism = _organism(dataset, fields[0])
            for raw_gene in fields[2:]:
                gene = raw_gene.upper()
                if not gene:
                    continue
                if organism in {"human", "homo sapiens"}:
                    target = excluded_human_non_pc if gene in human_non_pc else retained_human
                    target.add(gene)
                elif organism in {"mouse", "mus musculus"}:
                    if ortholog := mouse_to_human.get(gene):
                        translated_mouse.add(ortholog)
                    else:
                        excluded_mouse.add(gene)
                else:
                    excluded_organism.add(gene)

    final_genes = _genes(final)
    expected_final = retained_human | translated_mouse
    if unexpected := final_genes - expected_final:
        raise ValueError(
            f"{dataset}: final GMT contains {len(unexpected)} genes not accounted for "
            f"by the current intermediate GMT: {sorted(unexpected)[:5]}"
        )

    # Use the final GMT as the authority for retained genes. A source gene can disappear
    # when all signatures containing it become empty during per-signature filtering.
    retained_human &= final_genes
    translated_mouse &= final_genes

    return tuple(
        len(group)
        for group in (
            retained_human,
            translated_mouse,
            excluded_human_non_pc,
            excluded_mouse,
            excluded_organism,
        )
    )


def _rows() -> list[tuple[str, int, tuple[int, ...]]]:
    human_non_pc = non_protein_coding_genes("Mammalia/Homo_sapiens", CACHE_DIR)
    mouse_to_human = _mouse_to_human_ortholog(CACHE_DIR)
    final_paths = sorted(
        [
            *DATA.glob("drug_perturbation/*.gmt.gz"),
            *DATA.glob("gene_perturbation/*.gmt.gz"),
        ]
    )
    rows = []
    for final in final_paths:
        dataset = final.name.removesuffix(".gmt.gz")
        matches = list(DATA_SOURCES.glob(f"**/intermediate/{final.name}"))
        if len(matches) != 1:
            raise FileNotFoundError(
                f"{dataset}: expected one intermediate GMT, found {len(matches)}"
            )
        outcomes = _outcomes(
            dataset, matches[0], final, human_non_pc, mouse_to_human
        )
        rows.append((DISPLAY_NAMES.get(dataset, dataset), sum(outcomes), outcomes))
    return sorted(rows, key=lambda row: row[1], reverse=True)


def main() -> None:
    # Glyph paths keep typography identical when the SVG is viewed on another system.
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 10,
            "svg.fonttype": "path",
        }
    )
    rows = _rows()
    fig, ax = plt.subplots(figsize=(13, max(6, 0.52 * len(rows))), constrained_layout=True)
    names = [row[0] for row in reversed(rows)]
    totals = [row[1] for row in reversed(rows)]
    outcomes = [row[2] for row in reversed(rows)]
    left = [0] * len(names)

    for index, (color, label) in enumerate(SEGMENTS):
        values = [outcome[index] for outcome in outcomes]
        ax.barh(names, values, left=left, height=0.72, color=color, label=label)
        left = [start + value for start, value in zip(left, values)]

    offset = max(totals) * 0.009
    for y, total in enumerate(totals):
        ax.text(total + offset, y, f"{total:,}", va="center", fontsize=9)

    ax.set_xlim(0, max(totals) * 1.2)
    ax.set_xlabel("Unique gene symbols")
    ax.xaxis.set_major_formatter(StrMethodFormatter("{x:,.0f}"))
    ax.tick_params(axis="both", labelsize=10, color="#777777", width=0.6)
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#777777")
    ax.spines[["left", "bottom"]].set_linewidth(0.6)
    ax.legend(
        loc="lower right",
        fontsize=9,
        frameon=True,
        edgecolor="#cccccc",
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    metadata = {"Creator": "Perturb-Seqr ETL"}
    fig.savefig(PNG_OUTPUT, dpi=150, metadata=metadata)
    fig.savefig(SVG_OUTPUT, format="svg", metadata=metadata)
    SVG_OUTPUT.write_text(
        "\n".join(line.rstrip() for line in SVG_OUTPUT.read_text().splitlines()) + "\n"
    )
    plt.close(fig)
    print(f"Wrote {PNG_OUTPUT}")
    print(f"Wrote {SVG_OUTPUT}")


if __name__ == "__main__":
    main()
