# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Shared cell-line cleaner for rummageo_chem.py and rummageo_gene.py.

RummaGEO metadata (rummageo_metadata.json) packs both cell line names and descriptive
terms into one cell_line field. clean_rummageo_cell() teases them apart:

    "colorectal cancer cell line SW837" -> ("SW837", "colorectal cancer")
    "HeLa (Human cervical carcinoma)"   -> ("HeLa", "Human cervical carcinoma")
    "4T1 breast cancer"                 -> ("4T1", "breast cancer")
    "SKOV3"                             -> ("SKOV3", "")

Pipeline: shared helper, not directly runnable. Imported by rummageo_*.py.
"""
import re

# Descriptor keywords for splitting "CELLLINE descriptor" strings.
_DESCRIPTORS = (
    r'(?:[\w]*(?:cancer|tumor|tumour|carcinoma|sarcoma|lymphoma|leukemia|leukaemia|melanoma|glioma|glioblastoma|adenoma|mesothelioma|neuroblastoma|adenocarcinoma|hepatoma|myeloma|blastoma))'
    r'|(?:'
    r'fibroblast|epithelial|endothelial|macrophage|monocyte|astrocyte|neuron|neuronal|hepatocyte|keratinocyte|adipocyte|myoblast|myocyte|chondrocyte|osteoblast|osteocyte|lymphocyte'
    r'|stem\s*cell|progenitor|precursor|endometri\w+'
    r'|kidney|liver|lung|brain|breast|colon|colorectal|pancrea\w*|prostate|ovary|ovarian|skin|bone|blood|muscle|heart|spleen|thymus|gastric|bladder|cervical|uterine|renal|hepatic|pulmonary|mammary|intestin\w*|thyroid|adrenal|pituitary|placenta\w*'
    r'|pre-?adipocyte|iPSC|ESC|iPS|mESCs?|hESCs?|organoid|spheroid|primary'
    r'|WT|wild.?type|KO|knockout|knock-out|KD|knockdown|knock-down|mutant|resistant|sensitive|parental'
    r'|stably|transfect\w*|overexpress\w*|shRNA|siRNA|CRISPR|clone|sub-?clone'
    r'|human|mouse|murine|rat|porcine|bovine|canine|feline'
    r')'
)


def clean_rummageo_cell(val: str) -> tuple[str, str]:
    """Extract (cell_line, cell_type) from a descriptive RummaGEO cell_line value."""
    if not val or " " not in val:
        return val or "", ""
    val = val.strip()

    m = re.search(r'\bcell\s+lines?\s*\(?([A-Za-z0-9][\w\-\.\/\+]+)\)?\s*$', val, re.I)
    if m:
        name = m.group(1)
        desc = re.sub(r'\s*\bcell\s+lines?\s*$', '', val[:m.start()], flags=re.I).strip()
        return name, desc

    m = re.match(r'^([\w][\w\-\.\/\(\)\+\#]*)\s+cell\s+lines?\s*$', val, re.I)
    if m:
        return m.group(1), ""

    m = re.match(r'^(.+?)\s+\(([^)]+)\)\s*$', val)
    if m:
        name = m.group(1).strip()
        desc = re.sub(r'\s*\bcell\s+lines?\s*$', '', m.group(2), flags=re.I).strip()
        return name, desc

    m = re.search(r'\s+(' + _DESCRIPTORS + r')', val, re.I)
    if m and m.start() > 0:
        name = val[:m.start()].strip()
        desc = val[m.start():].strip()
        if len(name) <= 30 and re.match(r'^[\w][\w\-\.\/\(\)\+\#]*$', name):
            return name, desc

    return val, ""
