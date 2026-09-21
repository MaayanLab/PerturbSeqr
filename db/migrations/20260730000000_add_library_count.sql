-- migrate:up
ALTER TYPE app_public.enrich_result
  ADD ATTRIBUTE library_count INTEGER,
  ADD ATTRIBUTE supporting_libraries TEXT[];

ALTER TYPE app_public.paired_enrich_result
  ADD ATTRIBUTE library_count INTEGER,
  ADD ATTRIBUTE supporting_libraries TEXT[];

DROP MATERIALIZED VIEW app_public.gene_set_fda_counts;

CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
WITH per_lib_counts AS (
  SELECT
    COALESCE(NULLIF(cid, ''), LOWER(perturbation)) AS join_key,
    library_id,
    COUNT(*) AS count,
    SUM(COUNT(*)) OVER (PARTITION BY COALESCE(NULLIF(cid, ''), LOWER(perturbation)))::bigint AS total_count
  FROM app_public.gene_set
  WHERE perturbation IS NOT NULL AND perturbation != ''
  GROUP BY COALESCE(NULLIF(cid, ''), LOWER(perturbation)), library_id
),
fda_dedup AS (
  SELECT DISTINCT ON (COALESCE(NULLIF(cid, ''), LOWER(perturbation)))
    cid,
    LOWER(perturbation) AS perturbation_lower,
    approved,
    moa
  FROM app_public.fda_counts
  ORDER BY COALESCE(NULLIF(cid, ''), LOWER(perturbation)), perturbation
)
SELECT
  gs.id,
  COALESCE(gs.perturbation, '') AS perturbation,
  gs.cid,
  COALESCE(plc.count, 0) AS count,
  COALESCE(fda.approved, false) AS approved,
  fda.moa,
  COALESCE(plc.total_count, 0) AS total_count
FROM app_public.gene_set gs
LEFT JOIN per_lib_counts plc
  ON COALESCE(NULLIF(gs.cid, ''), LOWER(gs.perturbation)) = plc.join_key
  AND gs.library_id = plc.library_id
LEFT JOIN fda_dedup fda
  ON COALESCE(NULLIF(gs.cid, ''), LOWER(gs.perturbation))
     = COALESCE(NULLIF(fda.cid, ''), fda.perturbation_lower);

CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts USING BTREE (id);
CREATE INDEX gene_set_fda_counts_cid_idx ON app_public.gene_set_fda_counts USING BTREE (cid) WHERE cid IS NOT NULL;

COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';
COMMENT ON COLUMN app_public.gene_set_fda_counts.total_count IS 'Total stored signatures for this perturbation across all libraries; up and down gene sets count separately.';

GRANT SELECT ON app_public.gene_set_fda_counts TO guest;
GRANT ALL PRIVILEGES ON app_public.gene_set_fda_counts TO authenticated;

-- migrate:down
DROP MATERIALIZED VIEW app_public.gene_set_fda_counts;

CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
WITH per_lib_counts AS (
  SELECT
    COALESCE(NULLIF(cid, ''), LOWER(perturbation)) AS join_key,
    library_id,
    COUNT(*) AS count
  FROM app_public.gene_set
  WHERE perturbation IS NOT NULL AND perturbation != ''
  GROUP BY COALESCE(NULLIF(cid, ''), LOWER(perturbation)), library_id
),
fda_dedup AS (
  SELECT DISTINCT ON (COALESCE(NULLIF(cid, ''), LOWER(perturbation)))
    cid,
    LOWER(perturbation) AS perturbation_lower,
    approved,
    moa
  FROM app_public.fda_counts
  ORDER BY COALESCE(NULLIF(cid, ''), LOWER(perturbation)), perturbation
)
SELECT
  gs.id,
  COALESCE(gs.perturbation, '') AS perturbation,
  gs.cid,
  COALESCE(plc.count, 0) AS count,
  COALESCE(fda.approved, false) AS approved,
  fda.moa
FROM app_public.gene_set gs
LEFT JOIN per_lib_counts plc
  ON COALESCE(NULLIF(gs.cid, ''), LOWER(gs.perturbation)) = plc.join_key
  AND gs.library_id = plc.library_id
LEFT JOIN fda_dedup fda
  ON COALESCE(NULLIF(gs.cid, ''), LOWER(gs.perturbation))
     = COALESCE(NULLIF(fda.cid, ''), fda.perturbation_lower);

CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts USING BTREE (id);
CREATE INDEX gene_set_fda_counts_cid_idx ON app_public.gene_set_fda_counts USING BTREE (cid) WHERE cid IS NOT NULL;

COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';

GRANT SELECT ON app_public.gene_set_fda_counts TO guest;
GRANT ALL PRIVILEGES ON app_public.gene_set_fda_counts TO authenticated;

ALTER TYPE app_public.paired_enrich_result
  DROP ATTRIBUTE supporting_libraries,
  DROP ATTRIBUTE library_count;

ALTER TYPE app_public.enrich_result
  DROP ATTRIBUTE supporting_libraries,
  DROP ATTRIBUTE library_count;
