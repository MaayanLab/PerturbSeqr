from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent
DATA = HERE / "data/GFAP cell lines_ALL mutations vs WT_for Avi.xlsx"
OUT = HERE / "gene_sets"
CRAP_LIST = HERE / "contaminants/crap_gene_symbols.txt"
AUDIT = HERE / "contaminants/removed_from_gene_sets.tsv"
MUTATIONS = ["R239H", "R239C", "R79C", "R79H", "R239G"]
ADJ_P_THRESHOLD = 0.05


def load_crap() -> set[str]:
    if not CRAP_LIST.exists():
        raise FileNotFoundError(
            f"{CRAP_LIST} missing -- run `python contaminants/build_crap_gene_symbols.py` first."
        )
    return {g.strip() for g in CRAP_LIST.read_text().splitlines() if g.strip()}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    crap = load_crap()
    audit_rows = []
    for mut in MUTATIONS:
        df = pd.read_excel(DATA, sheet_name=mut)
        df.columns = ["gene", "log2fc", "adj_p"]
        df = df.dropna(subset=["gene", "log2fc", "adj_p"])
        df = df[df["adj_p"] < ADJ_P_THRESHOLD]
        df["gene"] = df["gene"].astype(str).str.strip()

        for direction, mask in (("up", df["log2fc"] > 0), ("down", df["log2fc"] < 0)):
            genes = sorted(df.loc[mask, "gene"].unique())
            kept = [g for g in genes if g not in crap]
            removed = [g for g in genes if g in crap]
            (OUT / f"{mut}_{direction}.txt").write_text("\n".join(kept) + "\n")
            audit_rows.extend({"mutation": mut, "direction": direction, "removed_gene": g}
                              for g in removed)
            flag = f"  (removed cRAP: {', '.join(removed)})" if removed else ""
            print(f"{mut} {direction}: kept={len(kept)} removed={len(removed)}{flag}")

    audit = pd.DataFrame(audit_rows, columns=["mutation", "direction", "removed_gene"])
    audit.to_csv(AUDIT, sep="\t", index=False)
    print(f"\nremoved {len(audit)} contaminant entries across all sets -> {AUDIT}")


if __name__ == "__main__":
    main()
