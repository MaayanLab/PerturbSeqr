-- migrate:up
SET LOCAL lock_timeout = '5s';

-- Older deployments may still have the extra post_search_filter_library_names
-- argument. PostGraphile hides both versions when public function names collide.
DROP FUNCTION IF EXISTS app_public.background_enrich(
  app_public.background, varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]);
DROP FUNCTION IF EXISTS app_public.background_paired_enrich(
  app_public.background, varchar[], varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]);

GRANT EXECUTE ON FUNCTION app_public.background_enrich(
  app_public.background, varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[]) TO guest, authenticated;
GRANT EXECUTE ON FUNCTION app_public.background_paired_enrich(
  app_public.background, varchar[], varchar[], varchar, integer, double precision, double precision,
  integer, integer, boolean, varchar, boolean, integer, varchar[]) TO guest, authenticated;

-- An old private helper works with its final argument defaulted. Drop it only
-- if the shorter helper exists too; otherwise, the public wrapper still needs it.
DO $$
BEGIN
  IF to_regprocedure('app_private.indexed_enrich(app_public.background, uuid[], varchar, integer, double precision, double precision, integer, integer, boolean, varchar, boolean, integer, varchar[])') IS NOT NULL THEN
    DROP FUNCTION IF EXISTS app_private.indexed_enrich(
      app_public.background, uuid[], varchar, integer, double precision, double precision,
      integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]);
  END IF;
  IF to_regprocedure('app_private.indexed_paired_enrich(app_public.background, uuid[], uuid[], varchar, integer, double precision, double precision, integer, integer, boolean, varchar, boolean, integer, varchar[])') IS NOT NULL THEN
    DROP FUNCTION IF EXISTS app_private.indexed_paired_enrich(
      app_public.background, uuid[], uuid[], varchar, integer, double precision, double precision,
      integer, integer, boolean, varchar, boolean, integer, varchar[], varchar[]);
  END IF;
END;
$$;

-- migrate:down
-- Do not restore obsolete overloads that would hide the enrichment fields again.
SELECT 1;
