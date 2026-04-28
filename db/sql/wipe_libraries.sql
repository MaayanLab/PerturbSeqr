-- Truncate library GMT data while preserving user_gene_set and background.
-- Run by ingest-entrypoint.sh between migrations and ingest when INGEST_CLEAN=true.

BEGIN;

-- The postgres database has 7 tables across 2 schemas:
--   app_public:  gene, gene_set_library, gene_set, background, user_gene_set, release, fda_counts
--   app_private: (no tables; only the pmc_stats materialized view)
-- Plus 2 materialized views:
--   app_public.gene_set_fda_counts  (rebuilt from gene_set + fda_counts)
--   app_private.pmc_stats           (rebuilt from release)
--
-- Library GMT data (truncated):  gene, gene_set_library, gene_set, fda_counts, release
-- Application data (preserved):  user_gene_set (sets analyzed counter), background
-- Possibly stale background is preserved because update_background.py will find the old UUID and delete its enrich index from S3.
TRUNCATE TABLE
  app_public.gene_set,
  app_public.gene_set_library,
  app_public.gene,
  app_public.fda_counts,
  app_public.release
CASCADE;

REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;
REFRESH MATERIALIZED VIEW app_private.pmc_stats;

COMMIT;
