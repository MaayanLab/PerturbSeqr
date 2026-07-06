"""
Declarative dataset registry on how to build metadata files
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Build:
    custom: bool = False           # dataset supplies its own <kind>_metadata.py (real logic kept there)
    lincs_cell_lines: bool = False  # cell_line built via lincs _cell_lines.build (cp/xpr)
    drug_col: str = ""             # drug: the dataset's *_drug_name column
    split_barred: bool = False     # gene_target: split perturb_atlas multi-gene rows
    resolver: bool = False         # cell_line: use the catalog-aware Cellosaurus resolver (perturb_atlas)
    gmt: str = "final"             # which GMT the builder reads: "final" | "intermediate"


@dataclass(frozen=True)
class Dataset:
    name: str                      # dotted module path under data_sources, e.g. "lincs_l1000.cp"
    tables: dict                   # kind -> Build


DATASETS = [
    # Drug
    Dataset("deepcover_moa", {
        "drug": Build(drug_col="deepcover_drug_name"),
        "cell_line": Build(),
    }),
    Dataset("ginkgo_bioworks", {
        "drug": Build(drug_col="ginkgo_drug_name"),
        "cell_line": Build(custom=True),
    }),
    Dataset("lincs_l1000.cp", {
        "drug": Build(custom=True),
        "cell_line": Build(lincs_cell_lines=True, gmt="intermediate"),
    }),
    Dataset("microarrays_cmap", {
        "drug": Build(drug_col="cmap_drug_name"),
        "cell_line": Build(),
    }),
    Dataset("nibr_drug_seq", {
        "drug": Build(custom=True),
        "cell_line": Build(),
    }),
    Dataset("rummageo_chem", {
        "drug": Build(drug_col="rummageo_drug_name"),
    }),
    Dataset("sciplex", {
        "drug": Build(drug_col="sciplex_drug_name"),
        "cell_line": Build(),
    }),
    Dataset("tahoe_100m", {
        "drug": Build(custom=True),
        "cell_line": Build(custom=True),
    }),
    Dataset("creeds_chem", {
        "drug": Build(drug_col="creeds_drug_name"),
    }),
    # Gene
    Dataset("lincs_l1000.xpr", {
        "cell_line": Build(lincs_cell_lines=True, gmt="intermediate"),
        "gene_target": Build(gmt="intermediate"),
    }),
    Dataset("perturb_atlas.human", {
        "cell_line": Build(resolver=True),
        "gene_target": Build(split_barred=True),
    }),
    Dataset("perturb_atlas.mouse", {
        "cell_line": Build(resolver=True),
        "gene_target": Build(split_barred=True),
    }),
    Dataset("replogle_perturb_seq", {
        "cell_line": Build(),
        "gene_target": Build(),
    }),
    Dataset("rummageo_gene", {
        "gene_target": Build(),
    }),
    Dataset("creeds_gene", {
        "gene_target": Build(),
    }),
    Dataset("cm4ai", {                      # upstream GMTs are manual placement
        "cell_line": Build(),
        "gene_target": Build(),
    }),
]

DATASET_NAMES = [d.name for d in DATASETS]   # replaces canonicalize_gmts.DATASET_MODULES