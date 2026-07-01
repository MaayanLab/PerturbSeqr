import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.metadata import cell_line as cell_meta, write_table

OUT_DIR = Path(__file__).parent / "intermediate"
OUT_NAME = "ginkgo-bioworks-cell_line_metadata"

ORGAN = {
    "human_aortic_smooth_muscle_cells": "Vasculature",
    "human_dermal_fibroblast": "Skin",
    "human_epithelial_melanocytes": "Skin",
    "human_skeletal_muscle_myoblasts": "Skeletal Muscle",
}


def cell_line_metadata(no_cache: bool = False) -> Path:
    rows = [{"cell_name": "A549", "ginkgo_cell_token": "A549", "role": "cell_line"}]
    rows += [{"cell_name": token.replace("_", " "), "ginkgo_cell_token": token, "role": "cell_type"}
             for token in ORGAN]
    cl = pd.DataFrame(rows)

    cl = cell_meta.annotate(cl, cache_dir=CACHE_DIR, name_col="cell_name")   # A549 → CVCL/ACH/Organ
    cl["Organ"] = [organ or ORGAN.get(token, "")
                   for organ, token in zip(cl["Organ"], cl["ginkgo_cell_token"])]
    return write_table(cl, OUT_DIR, OUT_NAME, label="cell lines")


if __name__ == "__main__":
    cell_line_metadata(no_cache="--no-cache" in sys.argv)
