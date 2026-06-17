**Drug Repurposing Hub** (Broad Institute) — a curated collection of FDA-approved, clinical-trial, and pre-clinical compounds annotated with mechanism of action (MoA), protein targets, and clinical phase.
PerturbSeqr's primary source for drug **MoAs**.

- **Inputs** (`upstream/`, from https://repo-hub.broadinstitute.org/public/data/): `repo-drug-annotation-20200324.txt` (drug-level: pert_iname → moa, target, clinical_phase, disease_area, indication) and `repo-sample-annotation-20240610.txt` (per-lot chemistry: pubchem_cid, InChIKey, smiles).
- **Output** (`intermediate/`): `drug_repurposing_hub.parquet` — one row per drug (pert_iname) merging the two, used to join MoA/target/phase + CID/InChIKey onto each dataset's drug metadata. (`build.py` also writes faithful `repo_drug_annotation.parquet` + `repo_sample_annotation.parquet`.)
