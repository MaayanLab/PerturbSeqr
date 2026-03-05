-- migrate:up
-- Add perturbation column to gene_set table for reliable FDA/MOA joins.
--
-- Previously, the gene_set_fda_counts materialized view used:
--   split_part(gs.term, '_', 5)
-- This only worked for L1000-CP format. Different libraries have
-- perturbation at different positions in their term strings.
--
-- Solution: Store the extracted perturbation directly during ingestion.
-- The ingestion script parses terms using libraries.json config and
-- populates this column.
--
-- This enables:
-- 1. Simple, fast joins: gene_set.perturbation = fda_counts.perturbation
-- 2. Library-agnostic queries (no runtime term parsing)
-- 3. Direct indexing for perturbation searches

-- Add perturbation column (nullable for backward compatibility)
ALTER TABLE app_public.gene_set
ADD COLUMN IF NOT EXISTS perturbation VARCHAR;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS gene_set_perturbation_idx
ON app_public.gene_set (perturbation)
WHERE perturbation IS NOT NULL;

-- Update the materialized view to use the new column
-- Use CASCADE to drop dependent objects (like PostGraphile comments/foreign keys)
DROP MATERIALIZED VIEW IF EXISTS app_public.gene_set_fda_counts CASCADE;

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

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS app_public.gene_set_fda_counts CASCADE;

-- Recreate original materialized view (L1000 format only)
CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
SELECT
  gs.id,
  fda.perturbation,
  fda.count,
  fda.approved,
  fda.moa
FROM app_public.gene_set gs
JOIN app_public.fda_counts fda
  ON replace(replace(split_part(gs.term, '_', 5), ' up', ' '), ' down', ' ') = fda.perturbation
WITH NO DATA;

CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts USING BTREE (id);
COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';
GRANT SELECT ON app_public.gene_set_fda_counts TO guest;
GRANT ALL PRIVILEGES ON app_public.gene_set_fda_counts TO authenticated;

DROP INDEX IF EXISTS app_public.gene_set_perturbation_idx;
ALTER TABLE app_public.gene_set DROP COLUMN IF EXISTS perturbation;
