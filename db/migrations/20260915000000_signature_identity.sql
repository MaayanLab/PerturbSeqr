-- migrate:up
ALTER TYPE app_public.enrich_result
  ADD ATTRIBUTE gene_set_id UUID;

ALTER TYPE app_public.paired_enrich_result
  ADD ATTRIBUTE gene_set_id_up UUID,
  ADD ATTRIBUTE gene_set_id_down UUID;

CREATE OR REPLACE FUNCTION app_public.enrich_result_gene_sets(enrich_result app_public.enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs WHERE gs.id = enrich_result.gene_set_id;
$$;

CREATE OR REPLACE FUNCTION app_public.paired_enrich_result_gene_set(paired_enrich_result app_public.paired_enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs
  WHERE gs.id = paired_enrich_result.gene_set_id_up OR gs.id = paired_enrich_result.gene_set_id_down;
$$;

-- migrate:down
CREATE OR REPLACE FUNCTION app_public.enrich_result_gene_sets(enrich_result app_public.enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs WHERE gs.hash = enrich_result.gene_set_hash;
$$;

CREATE OR REPLACE FUNCTION app_public.paired_enrich_result_gene_set(paired_enrich_result app_public.paired_enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs
  WHERE gs.hash = paired_enrich_result.gene_set_hash_up OR gs.hash = paired_enrich_result.gene_set_hash_down;
$$;

ALTER TYPE app_public.paired_enrich_result
  DROP ATTRIBUTE gene_set_id_down,
  DROP ATTRIBUTE gene_set_id_up;

ALTER TYPE app_public.enrich_result
  DROP ATTRIBUTE gene_set_id;
