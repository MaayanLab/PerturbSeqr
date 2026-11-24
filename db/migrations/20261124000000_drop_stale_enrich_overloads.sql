-- migrate:up
-- Databases migrated before post_search_filter_library_names was folded out of the
-- earlier migrations still hold that signature. The catalog migration then created
-- the current signature beside it instead of replacing it, and PostGraphile omits
-- overloaded functions, which removed enrich and pairedEnrich from the API.
DROP FUNCTION IF EXISTS app_public.background_enrich(
  app_public.background, varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]
);
DROP FUNCTION IF EXISTS app_public.background_paired_enrich(
  app_public.background, varchar[], varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]
);

-- The current signatures were created rather than replaced on those databases, so
-- they never received the grants made in the init migration.
GRANT EXECUTE ON FUNCTION app_public.background_enrich(
  app_public.background, varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[]
) TO guest, authenticated;
GRANT EXECUTE ON FUNCTION app_public.background_paired_enrich(
  app_public.background, varchar[], varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[]
) TO guest, authenticated;

-- migrate:down
-- The dropped signatures are obsolete; nothing to restore.
