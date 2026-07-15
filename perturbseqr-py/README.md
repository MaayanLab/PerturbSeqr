# perturbseqr

Python wrapper for the [Perturb-Seqr](https://perturbseqr.maayanlab.cloud) GraphQL API. Returns results as `pandas.DataFrame`.

## Install

```sh
uv add "perturbseqr @ git+https://github.com/MaayanLab/PerturbSeqr.git#subdirectory=perturbseqr-py"
```

## Use

```python
import perturbseqr as ps

# Single gene set enrichment
df = ps.enrich(["RASD1", "S100P", "TRIM51", "PDK4", "TIPARP", "TUBA3E"])

# Restrict libraries and result count
df = ps.enrich(genes, libraries=["LINCS L1000 CP"], top=25)

# Up/down (paired) enrichment
df = ps.enrich_pair(up=[...], down=[...])

# Search gene set terms by substring
df = ps.term_search("STAT3")
```

All three functions return a flat `DataFrame`. See docstrings for full options such as filters and sorting.
