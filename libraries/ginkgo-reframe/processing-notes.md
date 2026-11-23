# Ginkgo reFRAME processing methods

## Differential expression

The source data contain 12,377 compound-versus-DMSO contrasts in THP-1 cells at
24 h and 10 µM. Controls were selected from the same containers as treatment
samples. Gene IDs were mapped to human gene symbols; for duplicate symbols, the
highest-variance row was retained. Genes with zero total counts across the
samples in a contrast were excluded. DESeq2 used individual sample counts without
pre-averaging replicates. The source does not record the exact DESeq2 version or
helper defaults.

The downloadable AnnData file contains 12,377 contrasts × 19,161 genes. `X`
stores adjusted p-values, `layers['logFC']` stores log2 fold changes, and
`layers['pValue']` stores unadjusted p-values.

## Signature selection and verification

- Select genes with unadjusted `pvalue < 0.05` and `log2FoldChange > 1` (up) or
  `log2FoldChange < -1` (down). Rank by ascending unadjusted p-value, retain up
  to 1,000 genes per direction, and omit empty sets.
- Compound labels use PubChem names shorter than 90 characters and CIDs
  otherwise. Six labels were shared by distinct CIDs, and the source GMT retained
  the last entry for each shared label and direction. The compound metadata
  records the CID associated with each retained label.
- Reconstructing the GMT from the AnnData file matched all 22,800 gene sets
  (11,158 complete pairs and 484 unpaired sets). File checksums and validation
  counts are in [`source-verification.json`](source-verification.json).
- PerturbSeqr adds the verified `24H` timepoint to canonical terms, preserves
  original terms in signature metadata, and uppercases and deduplicates gene
  symbols. No additional gene-set size or biotype filter is applied.

## Rebuilding from source

With the original source archive and full-signature ZIP, run from the repository
root. Preparation uses temporary disk space for the uncompressed AnnData file.

```bash
uv run --project etl --with h5py python libraries/ginkgo-reframe/prepare_sources.py \
  --source-archive /path/to/source.zip \
  --full-signatures /path/to/deseq2.h5ad.zip

uv run --project etl perturbseqr-library build \
  --manifest libraries/ginkgo-reframe/source-manifest.json --offline
```

## UMAP visualization

The Visualization page uses the canonical public GMT listed in the release
manifest. Each dot represents one directional signature, including unpaired
signatures. The shared generator uses TF-IDF gene-set vectors, a 30-neighbor
graph, Leiden clustering, and UMAP with a minimum distance of 0.1.

Download `ginkgo-reframe.gmt.gz` from the release and verify its checksum
against `manifest.json`. Then run from the repository root:

```bash
uv run --python 3.13 --script scripts/generate_umap.py --library ginkgo-reframe \
  --gmt /path/to/ginkgo-reframe.gmt.gz --title 'Ginkgo reFRAME UMAP'
```

The app serves `public/umap/figures/ginkgo-reframe_UMAP.html`.
