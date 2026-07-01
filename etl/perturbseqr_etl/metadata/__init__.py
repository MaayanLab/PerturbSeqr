"""
Entity-level metadata API. Each module (drug, cell_line, gene, moa) exposes `annotate(df, ...) -> df`
joining `metadata_sources` annotations onto a dataset's table (existing columns never overwritten;
`*_matched_on` records the match; coverage via `warn_unmatched`). Builders share `write_table`.
"""
from pathlib import Path


def write_table(df, out_dir, out_name: str, *, label: str = "rows", note: str = ""):
    """Write `df` to <out_name>.parquet + .csv in out_dir (created if needed) and report. `note` adds a
    parenthetical detail after the row count. Returns out_dir, the value builders hand back."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_dir / f"{out_name}.parquet", index=False)
    df.to_csv(out_dir / f"{out_name}.csv", index=False)
    print(f"{label}: {len(df):>5}{(' ' + note) if note else ''} -> {out_dir}/{out_name}.parquet")
    return out_dir


def warn_unmatched(unmatched, total: int, *, entity: str, sample: int = 10) -> None:
    """Report join coverage. Raise if nothing matched; else print the rate and a few misses."""
    matched = total - len(unmatched)
    if matched <= 0:
        raise ValueError(f"{entity}: 0/{total} matched. Wrong query column or stale source build?")
    msg = f"  {entity}: {matched}/{total} matched ({matched / total:.0%})"
    if eg := [str(u) for u in unmatched if str(u).strip()][:sample]:
        msg += f"; unmatched e.g. {', '.join(eg)}"
    print(msg)
