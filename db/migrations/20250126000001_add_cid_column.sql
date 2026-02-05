-- migrate:up
-- Add PubChem CID column to gene_set and fda_counts tables for proper compound normalization.
--
-- CID (Compound ID) is PubChem's unique identifier for chemical compounds.
-- Using CIDs enables:
-- 1. Synonym resolution (dexamethasone vs Dexamethasone vs dexamethasone sodium phosphate)
-- 2. Accurate signature counting (group by CID instead of string name)
-- 3. Direct MOA lookup via Drug Repurposing Hub CID matching
-- 4. Reliable PubChem links

-- Add CID column to gene_set table
ALTER TABLE app_public.gene_set
ADD COLUMN IF NOT EXISTS cid VARCHAR;

-- Add index for CID lookups and aggregation
CREATE INDEX IF NOT EXISTS gene_set_cid_idx
ON app_public.gene_set (cid)
WHERE cid IS NOT NULL;

-- Add CID column to fda_counts table
ALTER TABLE app_public.fda_counts
ADD COLUMN IF NOT EXISTS cid VARCHAR;

-- Create index for CID-based joins
CREATE INDEX IF NOT EXISTS fda_counts_cid_idx
ON app_public.fda_counts (cid)
WHERE cid IS NOT NULL;

-- Update the materialized view to include CID and use CID-based joining as fallback
-- Use DISTINCT ON to deduplicate fda_counts by join key (multiple rows can share same CID)
DROP MATERIALIZED VIEW IF EXISTS app_public.gene_set_fda_counts CASCADE;

CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
WITH fda_dedup AS (
  SELECT DISTINCT ON (COALESCE(cid, LOWER(perturbation)))
    cid,
    LOWER(perturbation) AS perturbation_lower,
    count,
    approved,
    moa
  FROM app_public.fda_counts
  ORDER BY COALESCE(cid, LOWER(perturbation)), perturbation
)
SELECT
  gs.id,
  COALESCE(gs.perturbation, '') AS perturbation,
  gs.cid,
  COALESCE(fda.count, 0) AS count,
  COALESCE(fda.approved, false) AS approved,
  fda.moa
FROM app_public.gene_set gs
LEFT JOIN fda_dedup fda
  ON COALESCE(gs.cid, LOWER(gs.perturbation)) = COALESCE(fda.cid, fda.perturbation_lower);

CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts USING BTREE (id);
CREATE INDEX gene_set_fda_counts_cid_idx ON app_public.gene_set_fda_counts USING BTREE (cid) WHERE cid IS NOT NULL;

COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';

GRANT SELECT ON app_public.gene_set_fda_counts TO guest;
GRANT ALL PRIVILEGES ON app_public.gene_set_fda_counts TO authenticated;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS app_public.gene_set_fda_counts CASCADE;

-- Recreate previous materialized view (without CID)
CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
SELECT
  gs.id,
  COALESCE(gs.perturbation, '') AS perturbation,
  COALESCE(fda.count, 0) AS count,
  COALESCE(fda.approved, false) AS approved,
  fda.moa
FROM app_public.gene_set gs
LEFT JOIN app_public.fda_counts fda
  ON LOWER(gs.perturbation) = LOWER(fda.perturbation)
WITH NO DATA;

CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts USING BTREE (id);
COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';
GRANT SELECT ON app_public.gene_set_fda_counts TO guest;
GRANT ALL PRIVILEGES ON app_public.gene_set_fda_counts TO authenticated;

DROP INDEX IF EXISTS app_public.gene_set_cid_idx;
ALTER TABLE app_public.gene_set DROP COLUMN IF EXISTS cid;

DROP INDEX IF EXISTS app_public.fda_counts_cid_idx;
ALTER TABLE app_public.fda_counts DROP COLUMN IF EXISTS cid;
