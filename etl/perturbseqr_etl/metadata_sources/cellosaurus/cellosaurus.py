"""
Cellosaurus (https://www.cellosaurus.org/, CC BY 4.0). Parse cellosaurus.txt into a normalized
cell-line name → accession index for exact resolution.

load(cache_dir) returns (names, sublines, catalogs):
  names:    normalize(name) → {cvcl, primary, depmap, recommended}   (human/mouse, exact lookup)
  sublines: normalize(parent+gene) → {cvcl, primary, parent_cvcl}    (knockout sublines; first/lowest clone)
  catalogs: normalize(biobank catalog no.) → cvcl                    (e.g. "CCL185" → A549; unambiguous only)
"""
import re
from functools import lru_cache
from pathlib import Path

from perturbseqr_etl.dataloader import download_to

CELLOSAURUS_URL = "https://ftp.expasy.org/databases/cellosaurus/cellosaurus.txt"

# normalize: collapse spelling variants so "U2OS"/"MCF7" match Cellosaurus "U-2 OS"/"MCF-7".
_NORM_RE = re.compile(r"[^A-Za-z0-9]")


def normalize(s: str) -> str:
    return _NORM_RE.sub("", s or "").upper()


# Index-eligibility gate (shared with PerturbAtlas name-extraction): a name must be >= MIN_LEN
# normalized chars, <= MAX_TOKENS whitespace tokens, and not a generic descriptor / homonym.
MIN_LEN = 3
MAX_TOKENS = 4
BLOCKLIST = {
    "CELL", "CELLS", "LINE", "LINES", "HUMAN", "MOUSE", "MICE", "RAT", "CANCER", "TUMOR", "TUMOUR",
    "CAR", "STAGE", "EMBRYO", "STEM", "PRIMARY", "NORMAL", "CONTROL", "PARENTAL", "CLONE", "TYPE",
    "BLOOD", "BRAIN", "LIVER", "LUNG", "HUMANLUNG", "PRE", "PREB", "PRET", "PRO", "ESC", "ESCS",
    "IPSC", "IPSCS", "MEF", "MEFS", "HSF", "NSCLC", "SCLC", "PBMC", "RB1", "CA1", "OT1",
}


def index_candidate(name: str) -> str | None:
    """normalize(name) if it's eligible for the index, else None (length / token / blocklist gate)."""
    if name.count(" ") + 1 > MAX_TOKENS:
        return None
    k = normalize(name)
    return k if len(k) >= MIN_LEN and k not in BLOCKLIST else None


_KO_RE = re.compile(r"^(.+?) (\S+) \(-(?:/-)?\)(?: \d+)?$")   # "HAP1 CDK4 (-) 1", "MCF10A APC (-/-)"

# Cell-line biobanks whose DR cross-ref catalog numbers we index (a name like "A549 (CCL-185)" embeds one).
_CATALOG_COLLECTIONS = frozenset({
    "ATCC", "ECACC", "DSMZ", "JCRB", "RCB", "KCLB", "ICLC", "CLS", "BCRJ", "Coriell", "CIP", "TKG", "CCTCC", "IBRC"})


@lru_cache(maxsize=1)
def load(cache_dir: Path) -> tuple[dict, dict, dict]:
    """Parse cellosaurus.txt (human/mouse entries only). Returns (names, sublines, catalogs)."""
    path = download_to(CELLOSAURUS_URL, Path(cache_dir) / "cellosaurus.txt")
    names: dict[str, dict] = {}
    sublines: dict[str, dict] = {}
    catalogs: dict[str, str] = {}
    ambiguous: set[str] = set()
    rid = cvcl = depmap = hi_cvcl = None
    syns: list[str] = []
    cats: list[tuple[str, str]] = []
    is_org = False
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("ID   "): rid = line[5:].rstrip()
            elif line.startswith("AC   ") and cvcl is None: cvcl = line[5:].rstrip()
            elif line.startswith("SY   "): syns = [s.strip() for s in line[5:].split("; ") if s.strip()]
            elif line.startswith("DR   "):
                coll, _, cat = line[5:].partition(";")
                coll, cat = coll.strip(), cat.strip()
                if coll == "DepMap":
                    depmap = cat
                elif coll in _CATALOG_COLLECTIONS and cat:
                    cats.append((coll, cat))
            elif line.startswith("HI   "): hi_cvcl = line[5:].partition(" ! ")[0].strip()
            elif line.startswith("OX   "): is_org = is_org or ("Homo sapiens" in line or "Mus musculus" in line)
            elif line.startswith("//"):
                if rid and cvcl and is_org:
                    for nm, recommended in [(rid, True), *[(s, False) for s in syns]]:
                        key = index_candidate(nm)
                        if key and (key not in names or (recommended and not names[key]["recommended"])):
                            names[key] = {"cvcl": cvcl, "primary": rid, "depmap": depmap, "recommended": recommended}
                    m = _KO_RE.match(rid)
                    if m and hi_cvcl:                            # knockout subline → key by parent+gene
                        key = normalize(m.group(1) + m.group(2))
                        if key not in sublines or cvcl < sublines[key]["cvcl"]:   # keep first/lowest clone
                            sublines[key] = {"cvcl": cvcl, "primary": rid, "parent_cvcl": hi_cvcl}
                    for coll, cat in cats:                       # biobank catalog numbers → cvcl (e.g. "CCL-185" → A549)
                        keys = {normalize(coll + cat)}
                        if any(ch.isalpha() for ch in cat):      # bare numeric codes are too collision-prone alone
                            keys.add(normalize(cat))
                        for key in keys:
                            if key in ambiguous:
                                continue
                            if catalogs.setdefault(key, cvcl) != cvcl:   # one code → two lines: ambiguous, drop
                                ambiguous.add(key); catalogs.pop(key, None)
                rid = cvcl = depmap = hi_cvcl = None
                syns, cats, is_org = [], [], False
    return names, sublines, catalogs
