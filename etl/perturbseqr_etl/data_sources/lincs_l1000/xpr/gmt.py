"""
LINCS L1000 CRISPR knockouts (XPR). Upstream GMT → canonical intermediate. Uniformly CRISPR-Cas9
knockout (fields 5/6 = KO / Cas9); BRDN codes → gene symbols via instinfo_beta.txt and the .311/.311B
cell suffix is stripped to the canonical cell_iname.
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import TERM_DELIMITER, GENE_OUTPUT
from perturbseqr_etl.data_sources.lincs_l1000._lincs import load_pert_map, strip_cell_suffix
from perturbseqr_etl.gmt import append_to_description, standardize_gmt, strip_direction

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "lincs-l1000-xpr.gmt.gz"
FINAL = GENE_OUTPUT / "lincs-l1000-xpr.gmt.gz"
# Manual placement lives one level up, shared by CP + XPR (lincs_l1000/upstream/), matching ginkgo's upstream/ convention.
UPSTREAM = HERE.parent / "upstream"
UPSTREAM_UP = UPSTREAM / "lincs-l1000-xpr-pruned-up.gmt"
UPSTREAM_DOWN = UPSTREAM / "lincs-l1000-xpr-pruned-down.gmt"

PERTURBATION_TYPE = "KO"      # the entire XPR library is uniformly CRISPR-Cas9 knockout
PERTURBATION_METHOD = "Cas9"


def make_transform(brdn_map: dict[str, str]):
    def transform(term: str) -> tuple[str, str] | None:
        """Return (canonical_term, description_addition) or None to skip."""
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 5:
            return body + direction, ""
        batch, cell_line, timepoint, batch2, raw_pert = parts[:5]
        cell_line = strip_cell_suffix(cell_line)     # drop meaningless ".311"/".311B" suffix; keep isogenic variants intact
        if raw_pert.startswith("BRDN"):
            perturbation = brdn_map.get(raw_pert, raw_pert)  # fall back to raw code if unresolved
            extras = [PERTURBATION_TYPE, PERTURBATION_METHOD, batch, batch2, raw_pert]
            desc = raw_pert
        else:  # pre-resolved gene symbol (e.g. HAHN001 batch)
            perturbation = raw_pert
            extras = [PERTURBATION_TYPE, PERTURBATION_METHOD, batch, batch2]
            desc = ""
        return TERM_DELIMITER.join([perturbation, cell_line, "", timepoint, "", *extras]) + direction, desc
    return transform


def gmt(no_cache: bool = False) -> Path:
    """Stage A+B: canonicalize the paired upstream XPR up/dn GMTs (BRDN→gene) → intermediate (cached).
    Stage C: PC-filter → FINAL."""
    if no_cache or not INTERMEDIATE.exists():
        if not (UPSTREAM_UP.exists() and UPSTREAM_DOWN.exists()):
            raise NotImplementedError(
                f"Upstream LINCS XPR GMTs (manual placement) missing. Drop the paired files at\n"
                f"  {UPSTREAM_UP}\n  {UPSTREAM_DOWN}")
        transform = make_transform(load_pert_map("trt_xpr"))
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
        print(f"  {INTERMEDIATE.name}: {n} terms (BRDN codes resolved via instinfo_beta.txt)")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    gmt(no_cache="--no-cache" in sys.argv)
