-- migrate:up
ALTER TYPE app_public.enrich_result
  ADD ATTRIBUTE library_count INTEGER,
  ADD ATTRIBUTE supporting_libraries TEXT[];

ALTER TYPE app_public.paired_enrich_result
  ADD ATTRIBUTE library_count INTEGER,
  ADD ATTRIBUTE supporting_libraries TEXT[];

-- migrate:down
ALTER TYPE app_public.paired_enrich_result
  DROP ATTRIBUTE supporting_libraries,
  DROP ATTRIBUTE library_count;

ALTER TYPE app_public.enrich_result
  DROP ATTRIBUTE supporting_libraries,
  DROP ATTRIBUTE library_count;
