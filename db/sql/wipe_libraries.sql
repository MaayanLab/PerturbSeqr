-- Truncate library GMT data while preserving user_gene_set and background.
-- Run by ingest-entrypoint.sh between migrations and ingest when INGEST_CLEAN=true.

BEGIN;

-- app_public: gene, gene_set_library, gene_set, background, user_gene_set, release, fda_counts
-- Truncated (library GMT data): gene, gene_set_library, gene_set, fda_counts, release
-- Preserved: user_gene_set (sets analyzed counter), background.
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
