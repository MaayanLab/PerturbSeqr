---
name: perturbseqr-library-import
description: Prepare and validate new or updated PerturbSeqr gene-set libraries from GMTs. Use when asked to onboard a perturbation dataset, canonicalize source GMT terms, write a library manifest, or register metadata and companion downloads for an existing library.
---

# Prepare a PerturbSeqr library import

Work from the repository root. The deliverable is a short `libraries/<slug>/manifest.json` pointing to a canonical GMT and any hosted downloads on S3. Use the [manifest JSON Schema](../../../ingest/perturbseqr_ingest/library-manifest.schema.json) and [validator](../../../ingest/perturbseqr_ingest/library_manifest.py) as the contract. Follow the checked-in [Ginkgo reFRAME manifest](../../../libraries/ginkgo-reframe/manifest.json) for a real release and the [operator guide](../../../libraries/README.md) for setup.

## 1. Check the files and S3 layout

- Identify the source, release/version, organism, gene identifier namespace, and category (`drug` or `gene`). The current importer accepts human gene symbols. If the source uses another namespace or species, document and verify the conversion upstream before declaring it compatible.
- Inspect the source files and processing notes. `GMT` is tab-separated: term, description (may be empty), and at least one gene symbol. Check that the first field encodes the expected experiment and ends in exactly ` up` or ` down`. For separate directional files, establish direction from verified source metadata before combining them.
- Canonical term bodies use `::`-separated fields in the following order. Keep empty fields in place so later fields do not shift. The examples below show the **term only**, not complete GMT rows.

  | Category | Field order | Example |
  |---|---|---|
  | Drug | perturbation, cell line, cell type, timepoint, concentration | `ExampleDrug::THP-1::::24H::10uM up` |
  | Gene | same five fields, then perturbation type and method | `STAT3::K562::::24H::::KD::CRISPRi down` |

- When files are ready, upload the canonical GMT and only the files intended for Downloads. The bucket root is the flat downloads directory for every library. Use `s3://perturbseqr/<slug>.gmt.gz`, descriptive full signature filenames such as `<slug>-deseq2.h5ad.zip`, and Parquet metadata such as `<slug>-drug_metadata.parquet`. Use no per-library folders or hashes in object keys. `enrich/` is reserved for index backups.
- If a source needs reshaping, do it before uploading. For a different `::` layout, a separate source manifest can declare `input.preparation.fields` in source order and `defaults` for missing canonical fields. Use an empty string for unknown context; every nonempty default needs field-specific `provenance`. Keep processing notes, validation reports, and build receipts outside S3.
- Pairing matches the complete term body within the library. Unpaired sets are allowed by default; set `pairing: "require-complete"` only when the source guarantees pairs. Keep distinct experiments distinct and investigate duplicate canonical terms.

## 2. Author the manifest

Use a stable `slug` across releases and a stable `resource.key` to group related libraries. Change `version` for a new release. Set `license` to a verified ID with optional URL and attribution, or `null` if the library-wide license is unverified. Verify redistribution rights before using public storage; link only to sources intended for public access.

This is an illustrative S3 manifest. Replace the filenames, checksum placeholder, and descriptive fields with verified values. Include the GMT in `artifacts` with the same `s3` URI as `input.gmt`.

```json
{
  "schemaVersion": 1,
  "slug": "example-drug-library",
  "displayName": "Example Drug Library",
  "category": "drug",
  "resource": { "key": "example-resource" },
  "version": "v1",
  "description": "Processed drug perturbation gene sets from Example Resource.",
  "license": null,
  "input": {
    "gmt": "s3://perturbseqr/example-drug-library.gmt.gz",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "organism": "human",
    "geneIdentifiers": "symbol"
  },
  "presentation": {
    "shortLabel": "Example DRUG-seq",
    "filterLabel": "Example Drug Library",
    "downloadTitle": "Example Resource Drug Perturbation Signatures"
  },
  "distribution": { "gmt": "public", "metadata": "public" },
  "artifacts": [
    { "kind": "gmt", "s3": "s3://perturbseqr/example-drug-library.gmt.gz", "format": "gmt.gz" },
    { "kind": "full_signatures", "label": "DESeq2 full signatures", "s3": "s3://perturbseqr/example-drug-library-deseq2.h5ad.zip" }
  ]
}
```

- Use the SHA-256 of the exact uploaded GMT bytes. For a drug library, set `input.compoundLabels: "names-and-pubchem-cids"` only if bare numeric labels are verified CIDs. If supplying verified compound annotations, declare `input.compoundAnnotations` with the S3 URI and checksum of the downloadable drug metadata file. Use one row per GMT label. Aliases help users search; the signature CID determines its PubChem link.
- Declare only hosted files in `artifacts`; use `s3` for flat bucket keys or `url` for external downloads. Use `full_signatures` for DE statistics and `expression_counts` for raw counts. Omit missing companions or use `status: "awaiting-source"`; use `status: "restricted"` without a public link for unavailable licensed files. `bytes`, `format`, and companion checksums are optional; supply them when useful and known.
- Add `sources`, `publications`, or `presentation` as useful. Keep detailed scientific methods with the processing notes and local transformations with the source manifest. The catalog supplies grid entries and Downloads cards from the deployment manifest.
- Use `displayName` as the canonical API name and fallback for display labels (no character limit; no commas). For compact surfaces, set `presentation.shortLabel` for the caption below the home-grid logo (16 characters max) and `presentation.filterLabel` for the one-line checkbox label beside the count (24 max). Use `presentation.downloadTitle` for the full Downloads heading, with no character limit. The [GDPx1/GDPx2 manifest](../../../libraries/ginkgo-bioworks/manifest.json) shows all three overrides.

## 3. Run the setup job

Once objects are on S3, validate the deployment manifest if you want a read-only preview:

```bash
uv run --project etl perturbseqr-library validate --manifest libraries/SLUG/manifest.json
```

Replace `SLUG` with the library directory name. Build the ingest image with that manifest, then select the slug in the [containerized `library-setup` job](../../../libraries/README.md#run-the-library-setup-job) to validate, stage, index, and publish. During a guided walkthrough, present one command at a time and let the operator run it. After publication, check the grid, search filters, signature counts, and Downloads links. For a first upgrade, the same job without a release argument backfills manifests marked `registration: "existing"` without re-ingesting their signatures.
