"""
LINCS L1000 CRISPR knockouts (XPR).

Coverage: 65,672 signatures from LINCS CRISPR experiments.

Raw GMT comes from internal/manual placement. Drop the source file at:
    db/etl/inputs/gene_perturbation/lincs-l1000-xpr-raw.gmt
(direction is encoded in the term itself as a ' up' / ' down' suffix).

BRDN → gene symbol resolution: we use LINCS's `instinfo_beta.txt` to try to resolve BRDN codes.

Term transform (fields 5/6 = perturbation_type / perturbation_method; the whole library is uniformly CRISPR-Cas9 KO):
  pre-resolved (raw_pert is already a gene symbol):
    "XPR020_A549.311_96H_F09_MEP1B up"
      ->  "MEP1B::A549.311::::96H::::KO::Cas9::XPR020::F09 up"   desc=""
  resolved BRDN (instinfo_beta.txt maps it to a gene):
    "XPR020_A549.311_96H_F09_BRDN0000562885 up"
      ->  "BIRC5::A549.311::::96H::::KO::Cas9::XPR020::F09::BRDN0000562885 up"   desc="BRDN0000562885"
  unresolved BRDN (instinfo_beta.txt has no gene for it):
    "XPR040_SNU761.311_96H_E03_BRDN0001484943 up"
      ->  "BRDN0001484943::SNU761.311::::96H::::KO::Cas9::XPR040::E03::BRDN0001484943 up"   desc="BRDN0001484943"

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/lincs-l1000-xpr.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/lincs_l1000_xpr.py
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.inputs._utils import GENE_INTERMEDIATE, GENE_OUTPUT, TERM_DELIMITER, strip_direction, append_to_description, standardize_gmt
from perturbseqr_etl.inputs._lincs import load_pert_map

INTERMEDIATE = GENE_INTERMEDIATE / "lincs-l1000-xpr.gmt.gz"
FINAL = GENE_OUTPUT / "lincs-l1000-xpr.gmt.gz"
# Raw GMT under db/etl/inputs/gene_perturbation/ (not _cache/) — permanent manual
# placement, the SigCom LINCS download page is client-side gated.
RAW_GMT = Path(__file__).parent / "gene_perturbation" / "lincs-l1000-xpr-raw.gmt"

# The entire XPR library is uniformly CRISPR-Cas9 knockout.
PERTURBATION_TYPE = "KO"
PERTURBATION_METHOD = "Cas9"


def make_transform(brdn_map: dict[str, str]):
    def transform(term: str) -> tuple[str, str] | None:
        """Return (canonical_term, description_addition) or None to skip."""
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 5:
            return body + direction, ""
        batch, cell_line, timepoint, batch2, raw_pert = parts[:5]
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


def download(no_cache: bool = False) -> Path:
    """Canonicalize the raw LINCS XPR GMT into OUTPUT, resolving BRDN codes to gene symbols.

    The raw GMT is an internal/manual placement (no public download URL). BRDN-map download
    happens automatically via `_lincs.load_pert_map('trt_xpr')`.
    """
    if not RAW_GMT.exists():
        raise NotImplementedError(
            f"Raw LINCS L1000 XPR GMT is an internal/manual placement. Drop the source .gmt "
            f"at {RAW_GMT} and re-run. (SigCom LINCS download page is client-side gated; no "
            f"programmatic URL.)"
        )
    transform = make_transform(load_pert_map("trt_xpr"))
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(RAW_GMT) as f_in, gzip.open(INTERMEDIATE, "wt") as f_out:
        for line in f_in:
            if not line.strip():
                continue
            term, _, rest = line.partition("\t")            # rest = "<old_desc>\t<gene1>\t..."
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
    print(download())
