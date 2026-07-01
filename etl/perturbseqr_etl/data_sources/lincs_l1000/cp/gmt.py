"""
LINCS L1000 chemical perturbations (CP). Paired upstream up/dn GMTs → canonical intermediate. Each
term's <plate>_<cell>_<time>_<well> prefix is looked up in siginfo_beta.txt for the authoritative
cmap_name + BRD pert_id; BRD-only names are relabeled via a Clue.io alias / PubChem Title (see _display).
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import TERM_DELIMITER, DRUG_OUTPUT
from perturbseqr_etl.data_sources.lincs_l1000._lincs import SigKey, load_sig_map, strip_cell_suffix
from perturbseqr_etl.data_sources.lincs_l1000.cp._display import display_names
from perturbseqr_etl.gmt import append_to_description, standardize_gmt, strip_direction

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "lincs-l1000-cp.gmt.gz"
FINAL = DRUG_OUTPUT / "lincs-l1000-cp.gmt.gz"
UPSTREAM = HERE.parent / "upstream"
UPSTREAM_UP = UPSTREAM / "lincs-l1000-cp-pruned-up.gmt"
UPSTREAM_DOWN = UPSTREAM / "lincs-l1000-cp-pruned-down.gmt"


def make_transform(sig_map: dict[SigKey, tuple[str, str]], display: dict[str, str]):
    def transform(term: str) -> tuple[str, str] | None:
        """Return (canonical_term, description_addition) or None to skip."""
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 5:
            return body + direction, ""
        plate, raw_cell, timepoint, well = parts[:4]
        concentration = parts[-1] if len(parts) >= 6 else ""      # dose is always the trailing token
        pert_id, cmap_name = sig_map.get((plate, raw_cell, timepoint, well), ("", ""))
        if not (pert_id or cmap_name):                            # not in siginfo (rare) → naive name parse
            cmap_name = parts[4]
            pert_id = parts[4] if parts[4].startswith("BRD-") else ""
        perturbation = display.get(pert_id) or cmap_name or pert_id   # BRD-coded cmap_name → readable alias/PubChem title
        cell = strip_cell_suffix(raw_cell)
        extras = [plate, well] + ([pert_id] if pert_id else [])
        return TERM_DELIMITER.join([perturbation, cell, "", timepoint, concentration, *extras]) + direction, pert_id
    return transform


def gmt(no_cache: bool = False) -> Path:
    """Stage A+B: canonicalize the paired upstream CP up/dn GMTs (siginfo name + BRD lookup) →
    intermediate (cached). Stage C: PC-filter → FINAL."""
    if no_cache or not INTERMEDIATE.exists():
        if not (UPSTREAM_UP.exists() and UPSTREAM_DOWN.exists()):
            raise NotImplementedError(
                f"Upstream LINCS CP GMTs (manual placement) missing. Drop the paired files at\n"
                f"  {UPSTREAM_UP}\n  {UPSTREAM_DOWN}")
        transform = make_transform(load_sig_map("trt_cp"), display_names())
        INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
        n = 0
        with gzip.open(INTERMEDIATE, "wt") as f_out:
            for path, direction in [(UPSTREAM_UP, "up"), (UPSTREAM_DOWN, "down")]:
                with open(path) as f_in:
                    for line in f_in:
                        if not line.strip():
                            continue
                        tagged = line.replace("\t", f" {direction}\t", 1)   # direction is in the filename, not the term
                        term, _, rest = tagged.partition("\t")
                        result = transform(term)
                        if result is None:
                            continue
                        new_term, desc_addition = result
                        old_desc, _, genes = rest.partition("\t")
                        f_out.write(f"{new_term}\t{append_to_description(old_desc, desc_addition)}\t{genes}")
                        n += 1
        print(f"  {INTERMEDIATE.name}: {n} terms (cmap_name + BRD pert_id via siginfo_beta.txt)")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    gmt(no_cache="--no-cache" in sys.argv)
