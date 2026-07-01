"""
NIBR DRUG-seq U2OS MoA Box (Li et al. 2022). Harmonizome reprocessing, fixed U2OS/24h.
https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles
NSN→name via _display; the NSN tag is kept as a term extra + description so undisclosed reagents stay identifiable.
"""
import sys

from perturbseqr_etl.data_sources import TERM_DELIMITER
from perturbseqr_etl.gmt import harmonizome_builder, strip_direction
from perturbseqr_etl.data_sources.nibr_drug_seq import _display

NSN_PREFIX = "NSN:"


def make_transform(nsn_map: dict[str, str]):
    def transform(term: str) -> tuple[str, str]:
        """AA-07-FZ97_1uM up  ->  Calcitriol::U2OS::::24h::1uM::NSN:AA-07-FZ97 up   (desc = the NSN tag)"""
        body, direction = strip_direction(term)
        parts = body.rsplit("_", 1)
        if len(parts) != 2:
            return body + direction, ""
        nsn, concentration = parts
        nsn_tag = NSN_PREFIX + nsn
        perturbation = nsn_map.get(nsn, nsn_tag)
        return TERM_DELIMITER.join([perturbation, "U2OS", "", "24h", concentration, nsn_tag]) + direction, nsn_tag
    return transform


INTERMEDIATE, FINAL, gmt = harmonizome_builder(
    __file__, "nibrdrugseq", "nibr-drug-seq", lambda _nc: make_transform(_display.nsn_name_map()))

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
