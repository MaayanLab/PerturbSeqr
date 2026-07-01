"""
DepMap model metadata (https://depmap.org, 24Q4). ModelID (ACH-*), RRID (= Cellosaurus CVCL),
StrippedCellLineName, OncotreeLineage (Organ). Cross-references Cellosaurus ↔ DepMap.
"""
from functools import lru_cache
from pathlib import Path

import pandas as pd

from perturbseqr_etl.dataloader import download_to

DEPMAP_MODEL_URL = "https://ndownloader.figshare.com/files/51065297"   # DepMap 24Q4 Model.csv


@lru_cache(maxsize=1)
def load(cache_dir: Path) -> pd.DataFrame:
    """DepMap Model table (ModelID, RRID, StrippedCellLineName, OncotreeLineage, …) as strings."""
    path = download_to(DEPMAP_MODEL_URL, Path(cache_dir) / "depmap_model.csv")
    return pd.read_csv(path, dtype=str).fillna("")
