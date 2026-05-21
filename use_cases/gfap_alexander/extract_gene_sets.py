import re
from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent
DATA = HERE / "data/GFAP cell lines_ALL mutations vs WT_for Avi.xlsx"
OUT = HERE / "gene_sets"
CRAP_LIST = HERE / "contaminants/crap_gene_symbols.txt"
CRAPOME_MATRIX = HERE / "contaminants/crapome_human_v1.xlsx"
AUDIT = HERE / "contaminants/removed_from_gene_sets.tsv"
MUTATIONS = ["R239H", "R239C", "R79C", "R79H", "R239G"]
ADJ_P_THRESHOLD = 0.05
CRAPOME_THRESHOLD = 0.50


def load_crap() -> set[str]:
    return {g.strip() for g in CRAP_LIST.read_text().splitlines() if g.strip()}


def load_crapome(threshold: float) -> set[str]:
    cr = pd.read_excel(CRAPOME_MATRIX, sheet_name=0)
    cc = [c for c in cr.columns if re.fullmatch(r"CC\d+", str(c))]
    freq = (cr[cc] > 0).sum(axis=1) / len(cc)
    return set(cr.loc[freq >= threshold, "geneSymbol"].astype(str))


def main() -> None:
    OUT.mkdir(exist_ok=True)
    crap = load_crap()
    crapome = load_crapome(CRAPOME_THRESHOLD)
    audit_rows = []
    for mut in MUTATIONS:
        df = pd.read_excel(DATA, sheet_name=mut)
        df.columns = ["gene", "log2fc", "adj_p"]
        df = df.dropna(subset=["gene", "log2fc", "adj_p"])
        df = df[df["adj_p"] < ADJ_P_THRESHOLD]
        df["gene"] = df["gene"].astype(str).str.strip()

        for direction, mask in (("up", df["log2fc"] > 0), ("down", df["log2fc"] < 0)):
            genes = sorted(df.loc[mask, "gene"].unique())
            kept, removed = [], []
            for g in genes:
                sources = [name for name, s in (("cRAP", crap), ("CRAPome", crapome)) if g in s]
                if sources:
                    removed.append(g)
                    audit_rows.append({"mutation": mut, "direction": direction,
                                       "removed_gene": g, "source": "+".join(sources)})
                else:
                    kept.append(g)
            (OUT / f"{mut}_{direction}.txt").write_text("\n".join(kept) + "\n")
            flag = f"  (removed: {', '.join(removed)})" if removed else ""
            print(f"{mut} {direction}: kept={len(kept)} removed={len(removed)}{flag}")

    audit = pd.DataFrame(audit_rows, columns=["mutation", "direction", "removed_gene", "source"])
    audit.to_csv(AUDIT, sep="\t", index=False)
    print(f"\nremoved {len(audit)} contaminant entries across all sets -> {AUDIT}")


if __name__ == "__main__":
    main()
