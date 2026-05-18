"""Extract per-mutation up/down gene lists from the proteomics xlsx.

Reads `data/GFAP cell lines_ALL mutations vs WT_for Avi.xlsx` and writes
`gene_sets/{MUTATION}_{up,down}.txt` (one gene symbol per line).

Run with:
    uv run --no-project --with pandas --with openpyxl python extract_gene_sets.py
"""
from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent
DATA = HERE / "data/GFAP cell lines_ALL mutations vs WT_for Avi.xlsx"
OUT = HERE / "gene_sets"
MUTATIONS = ["R239H", "R239C", "R79C", "R79H", "R239G"]
ADJ_P_THRESHOLD = 0.05


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for mut in MUTATIONS:
        df = pd.read_excel(DATA, sheet_name=mut)
        df.columns = ["gene", "log2fc", "adj_p"]
        df = df.dropna(subset=["gene", "log2fc", "adj_p"])
        df = df[df["adj_p"] < ADJ_P_THRESHOLD]
        df["gene"] = df["gene"].astype(str).str.strip()

        up = sorted(df.loc[df["log2fc"] > 0, "gene"].unique())
        dn = sorted(df.loc[df["log2fc"] < 0, "gene"].unique())

        (OUT / f"{mut}_up.txt").write_text("\n".join(up) + "\n")
        (OUT / f"{mut}_down.txt").write_text("\n".join(dn) + "\n")
        print(f"{mut}: up={len(up)}  down={len(dn)}")


if __name__ == "__main__":
    main()
