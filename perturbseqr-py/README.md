# perturbseqr

Python wrapper for the [Perturb-Seqr](https://perturbseqr.k8s.dev.maayanlab.cloud) dev server deployment (for now) GraphQL API. Returns results as `pandas.DataFrame`.

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

# List valid library names (use these for `libraries=`)
ps.list_libraries()                  # all 16
ps.list_libraries(category="drug")   # drug perturbation libraries only
ps.list_libraries(category="gene")   # gene perturbation libraries only

# Per-library signature counts (one API call — the same one the front end uses)
ps.library_stats()                   # DataFrame: name, n_sets

# Gene-level helpers (all single API call)
ps.check_genes(genes)                # which inputs resolve in the Perturb-Seqr background
ps.gene_descriptions(genes)          # NCBI description + summary per gene
ps.get_overlap(genes, signature_id)  # genes overlapping with one Perturb-Seqr signature
ps.get_signature_genes(uuid_or_term) # gene members of a specific signature
ps.find_signatures_containing(genes) # signatures whose members include any of these genes
```

Passing an unknown library name to any function raises `ValueError` with a "did you mean" suggestion — e.g. `libraries=["DeepCover MOA"]` → `Did you mean: 'DeepCover MOA' → 'DeepCover MoA'`.

All three enrichment/search functions return a flat `DataFrame`. See docstrings for full options such as filters and sorting.
