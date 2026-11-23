-- migrate:up
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

-- Library identities and releases. The setup job adds presentation metadata from
-- the manifests; existing signatures and their library IDs stay in place.
ALTER TABLE app_public.gene_set_library
  ADD COLUMN slug text UNIQUE,
  ADD COLUMN category text CHECK (category IN ('drug', 'gene')),
  ADD COLUMN resource_key text,
  ADD COLUMN active_revision_id uuid;

UPDATE app_public.gene_set_library SET slug = 'legacy-' || id::text;
ALTER TABLE app_public.gene_set_library
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN slug SET DEFAULT 'legacy-' || uuid_generate_v4()::text;

CREATE TABLE app_public.library_revision (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES app_public.gene_set_library ON DELETE CASCADE,
  version text NOT NULL,
  checksum text NOT NULL,
  manifest jsonb NOT NULL,
  report jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('staged', 'published')),
  created timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (library_id, checksum),
  UNIQUE (library_id, id)
);

ALTER TABLE app_public.gene_set_library
  ADD CONSTRAINT gene_set_library_active_revision_fkey
  FOREIGN KEY (id, active_revision_id) REFERENCES app_public.library_revision (library_id, id);

-- A legacy revision's ID equals the library ID. A NULL revision_id on a gene
-- set denotes that legacy revision. No backfill of the signature table is needed.
INSERT INTO app_public.library_revision (id, library_id, version, checksum, manifest, status, published_at)
SELECT id, id, 'legacy', slug, jsonb_build_object('legacy', true), 'published', now()
FROM app_public.gene_set_library;

UPDATE app_public.gene_set_library SET active_revision_id = id;

ALTER TABLE app_public.gene_set
  ADD COLUMN revision_id uuid,
  ADD CONSTRAINT gene_set_revision_fkey
    FOREIGN KEY (library_id, revision_id) REFERENCES app_public.library_revision (library_id, id)
    ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT gene_set_revision_requires_library
    CHECK (revision_id IS NULL OR library_id IS NOT NULL) NOT VALID;

CREATE UNIQUE INDEX gene_set_revision_term_idx
  ON app_public.gene_set (COALESCE(revision_id, library_id), term);
ALTER TABLE app_public.gene_set DROP CONSTRAINT gene_set_term_library_key;

CREATE TABLE app_public.library_artifact (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  revision_id uuid NOT NULL REFERENCES app_public.library_revision ON DELETE CASCADE,
  kind text NOT NULL,
  metadata jsonb NOT NULL
);
CREATE INDEX ON app_public.library_artifact (revision_id);

CREATE TABLE app_public.library_compound (
  revision_id uuid NOT NULL REFERENCES app_public.library_revision ON DELETE CASCADE,
  label text NOT NULL,
  cid text,
  metadata jsonb NOT NULL,
  PRIMARY KEY (revision_id, label)
);

CREATE TABLE app_public.library_generation (
  id uuid PRIMARY KEY REFERENCES app_public.background ON DELETE CASCADE,
  revision_ids uuid[] NOT NULL,
  candidate_revision_id uuid NOT NULL REFERENCES app_public.library_revision,
  parent_background_id uuid,
  status text NOT NULL CHECK (status IN ('building', 'ready', 'published')),
  report jsonb NOT NULL DEFAULT '{}',
  created timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX ON app_public.library_generation (candidate_revision_id);

CREATE TABLE app_private.library_publication (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  background_id uuid REFERENCES app_public.background
);

-- Capture the background selected by the old implementation before replacing it.
INSERT INTO app_private.library_publication (background_id)
SELECT id FROM app_public.current_background() WHERE id IS NOT NULL;

-- Only active revisions are public. Do not expose raw authoring manifests, which
-- can include local paths or restricted links.
ALTER TABLE app_public.gene_set_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_libraries ON app_public.gene_set_library FOR SELECT TO guest, authenticated
  USING (active_revision_id IS NOT NULL);

ALTER TABLE app_public.gene_set ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_gene_sets ON app_public.gene_set FOR SELECT TO guest, authenticated
  USING (COALESCE(revision_id, library_id) IN (SELECT active_revision_id FROM app_public.gene_set_library));

ALTER TABLE app_public.library_revision ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_revisions ON app_public.library_revision FOR SELECT TO guest, authenticated
  USING (id IN (SELECT active_revision_id FROM app_public.gene_set_library));

ALTER TABLE app_public.library_artifact ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_artifacts ON app_public.library_artifact FOR SELECT TO guest, authenticated
  USING (revision_id IN (SELECT active_revision_id FROM app_public.gene_set_library));

ALTER TABLE app_public.library_compound ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_compounds ON app_public.library_compound FOR SELECT TO guest, authenticated
  USING (revision_id IN (SELECT active_revision_id FROM app_public.gene_set_library));

GRANT SELECT (id, library_id, version, checksum, report, status, created, published_at)
  ON app_public.library_revision TO guest, authenticated;
GRANT SELECT ON app_public.library_artifact, app_public.library_compound TO guest, authenticated;

CREATE OR REPLACE FUNCTION app_public.current_background() RETURNS app_public.background
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app_public, app_private AS $$
  SELECT b.*
  FROM app_public.background b
  WHERE b.id = COALESCE(
    (SELECT background_id FROM app_private.library_publication WHERE singleton),
    (SELECT b2.id FROM app_public.background b2
     WHERE NOT EXISTS (SELECT 1 FROM app_public.library_generation g WHERE g.id = b2.id)
     ORDER BY b2.created DESC LIMIT 1)
  );
$$;

ALTER TABLE app_public.background ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_background ON app_public.background FOR SELECT TO guest, authenticated
  USING (id = (SELECT b.id FROM app_public.current_background() b));

-- SQL callers can construct a background composite without reading its protected row.
CREATE OR REPLACE FUNCTION app_public.background_enrich(
  background app_public.background, genes varchar[], filter_term varchar DEFAULT NULL,
  overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05,
  adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT NULL,
  first integer DEFAULT NULL, filter_fda boolean DEFAULT false, sortby varchar DEFAULT NULL,
  filter_ko boolean DEFAULT false, top_n integer DEFAULT 10000, library_names varchar[] DEFAULT NULL
) RETURNS app_public.paginated_enrich_result
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app_public, app_private AS $$
BEGIN
  IF background.id IS DISTINCT FROM (SELECT id FROM app_public.current_background()) THEN
    RAISE EXCEPTION 'Only the published background is queryable' USING ERRCODE = '42501';
  END IF;
  RETURN app_private.indexed_enrich(
    background, (SELECT COALESCE(array_agg(gene_id), '{}'::uuid[]) FROM app_public.gene_map(genes)),
    filter_term, overlap_ge, pvalue_le, adj_pvalue_le, "offset", first, filter_fda, sortby,
    filter_ko, top_n, library_names
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_public.background_paired_enrich(
  background app_public.background, genes_up varchar[], genes_down varchar[], filter_term varchar DEFAULT NULL,
  overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05,
  adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT NULL,
  first integer DEFAULT NULL, filter_fda boolean DEFAULT false, sortby varchar DEFAULT NULL,
  filter_ko boolean DEFAULT false, top_n integer DEFAULT 10000, library_names varchar[] DEFAULT NULL
) RETURNS app_public.paginated_paired_enrich_result
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app_public, app_private AS $$
BEGIN
  IF background.id IS DISTINCT FROM (SELECT id FROM app_public.current_background()) THEN
    RAISE EXCEPTION 'Only the published background is queryable' USING ERRCODE = '42501';
  END IF;
  RETURN app_private.indexed_paired_enrich(
    background,
    (SELECT COALESCE(array_agg(gene_id), '{}'::uuid[]) FROM app_public.gene_map(genes_up)),
    (SELECT COALESCE(array_agg(gene_id), '{}'::uuid[]) FROM app_public.gene_map(genes_down)),
    filter_term, overlap_ge, pvalue_le, adj_pvalue_le, "offset", first, filter_fda, sortby,
    filter_ko, top_n, library_names
  );
END;
$$;

-- Share the same snapshot filter between index construction and verification.
CREATE FUNCTION app_private.library_snapshot_sets(revisions uuid[]) RETURNS SETOF app_public.gene_set
LANGUAGE sql STABLE AS $$
  SELECT gs.*
  FROM app_public.gene_set gs
  WHERE COALESCE(gs.revision_id, gs.library_id) = ANY (revisions);
$$;

-- Only small columns take part in grouping and joins. Deduplicate FDA metadata
-- once; do not scan it per signature or sort the gene member arrays.
CREATE FUNCTION app_private.library_annotations(revisions uuid[])
RETURNS TABLE (id uuid, perturbation varchar, cid varchar, count bigint, approved boolean, moa varchar, total_count bigint)
LANGUAGE sql STABLE AS $$
  WITH signatures AS (
    SELECT gs.id, gs.library_id, gs.revision_id, gs.perturbation, gs.cid,
           COALESCE(NULLIF(gs.cid, ''), LOWER(gs.perturbation)) AS compound_key
    FROM app_private.library_snapshot_sets(revisions) gs
  ), fda AS MATERIALIZED (
    SELECT DISTINCT ON (compound_key) compound_key, approved, moa
    FROM (
      SELECT COALESCE(NULLIF(cid, ''), LOWER(perturbation)) AS compound_key, perturbation, approved, moa
      FROM app_public.fda_counts
    ) entries
    ORDER BY compound_key, perturbation
  )
  SELECT gs.id, COALESCE(gs.perturbation, ''), gs.cid,
         CASE WHEN NULLIF(gs.perturbation, '') IS NULL THEN 0
              ELSE count(*) FILTER (WHERE NULLIF(gs.perturbation, '') IS NOT NULL)
                   OVER (PARTITION BY gs.library_id, gs.compound_key) END,
         COALESCE((c.metadata->>'fda_approved')::boolean, fda.approved, false),
         COALESCE(NULLIF(c.metadata->>'moa', ''), fda.moa)::varchar,
         CASE WHEN NULLIF(gs.perturbation, '') IS NULL THEN 0
              ELSE count(*) FILTER (WHERE NULLIF(gs.perturbation, '') IS NOT NULL)
                   OVER (PARTITION BY gs.compound_key) END
  FROM signatures gs
  LEFT JOIN fda USING (compound_key)
  LEFT JOIN app_public.library_compound c
    ON c.revision_id = gs.revision_id AND c.label = gs.perturbation;
$$;

CREATE FUNCTION app_private.active_library_revisions() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT array_agg(active_revision_id) FROM app_public.gene_set_library WHERE active_revision_id IS NOT NULL;
$$;

CREATE FUNCTION app_private.library_index_rows(background uuid)
RETURNS TABLE (
  id uuid, term varchar, description varchar, hash uuid, gene_ids jsonb,
  fda_approved boolean, count bigint, pert text, moa text, cid text, library_name varchar
) LANGUAGE sql STABLE AS $$
  SELECT gs.id, gs.term, COALESCE(gs.description, ''), gs.hash, gs.gene_ids,
         a.approved, a.count, a.perturbation::text, a.moa::text, COALESCE(a.cid, '')::text,
         COALESCE(r.manifest->>'displayName', l.name)::varchar
  FROM app_private.library_annotations(COALESCE(
    (SELECT g.revision_ids FROM app_public.library_generation g WHERE g.id = background),
    app_private.active_library_revisions()
  )) a
  JOIN app_public.gene_set gs ON gs.id = a.id
  JOIN app_public.gene_set_library l ON l.id = gs.library_id
  JOIN app_public.library_revision r ON r.id = COALESCE(gs.revision_id, gs.library_id);
$$;

-- Preserve the GraphQL relation and column types, using the lightweight annotation query.
DROP MATERIALIZED VIEW app_public.gene_set_fda_counts;
CREATE MATERIALIZED VIEW app_public.gene_set_fda_counts AS
  SELECT * FROM app_private.library_annotations(app_private.active_library_revisions());
CREATE INDEX gene_set_fda_counts_id_idx ON app_public.gene_set_fda_counts (id);
CREATE INDEX gene_set_fda_counts_cid_idx ON app_public.gene_set_fda_counts (cid) WHERE cid IS NOT NULL;
COMMENT ON MATERIALIZED VIEW app_public.gene_set_fda_counts IS '@foreignKey (id) references app_public.gene_set (id)';
GRANT SELECT ON app_public.gene_set_fda_counts TO guest, authenticated;

CREATE OR REPLACE FUNCTION app_public.gene_set_term_search(terms varchar[], library_names varchar[] DEFAULT NULL)
RETURNS SETOF app_public.gene_set LANGUAGE sql STABLE AS $$
  SELECT gs.*
  FROM app_public.gene_set gs
  WHERE (library_names IS NULL OR gs.library_id IN (
    SELECT id FROM app_public.gene_set_library WHERE name = ANY (library_names)
  )) AND EXISTS (
    SELECT 1 FROM unnest(terms) AS query(value)
    WHERE gs.term ILIKE '%' || query.value || '%' OR gs.cid = query.value OR EXISTS (
      SELECT 1
      FROM app_public.library_compound c, jsonb_array_elements_text(c.metadata->'aliases') AS alias(value)
      WHERE c.revision_id = gs.revision_id AND c.label = gs.perturbation
        AND alias.value ILIKE '%' || query.value || '%'
    )
  );
$$;

CREATE FUNCTION app_public.library_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app_public, app_private AS $$
  SELECT jsonb_build_object(
    'generation', (SELECT id FROM app_public.current_background()),
    'libraries', COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id, 'slug', l.slug, 'name', l.name, 'category', l.category,
      'resourceKey', COALESCE(l.resource_key, l.slug),
      'description', COALESCE(r.manifest->>'description', l.description),
      'manifest', r.manifest - 'input' - 'artifacts', 'counts', r.report, 'revisionId', r.id,
      'artifacts', COALESCE((
        SELECT jsonb_agg(a.metadata || jsonb_build_object('id', a.id) ORDER BY (a.metadata->>'order')::int, a.id)
        FROM app_public.library_artifact a WHERE a.revision_id = r.id
      ), '[]'::jsonb)
    ) ORDER BY l.name), '[]'::jsonb)
  )
  FROM app_public.gene_set_library l
  JOIN app_public.library_revision r ON r.id = l.active_revision_id;
$$;
GRANT EXECUTE ON FUNCTION app_public.library_catalog TO guest, authenticated;

CREATE OR REPLACE FUNCTION app_public.increment_file_download(key varchar) RETURNS app_public.file_download
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app_public AS $$
  INSERT INTO app_public.file_download (key, count)
  SELECT increment_file_download.key, 1
  WHERE increment_file_download.key ~ '^[A-Za-z0-9._-]{1,200}$' OR EXISTS (
    SELECT 1
    FROM app_public.library_artifact a
    JOIN app_public.gene_set_library l ON l.active_revision_id = a.revision_id
    WHERE a.metadata->>'objectKey' = increment_file_download.key
      AND (a.metadata->>'status' = 'public' OR (a.metadata->>'status' = 'external' AND a.metadata ? 's3'))
  )
  ON CONFLICT (key) DO UPDATE SET count = app_public.file_download.count + 1
  RETURNING *;
$$;

-- Apply a complete snapshot and switch its background in the same transaction.
CREATE FUNCTION app_private.activate_library_snapshot(generation uuid, revisions uuid[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE app_public.gene_set_library SET active_revision_id = NULL
  WHERE active_revision_id IS NOT NULL AND NOT (active_revision_id = ANY (revisions));

  UPDATE app_public.gene_set_library l
  SET active_revision_id = r.id,
      name = COALESCE(r.manifest->>'displayName', l.name),
      description = COALESCE(r.manifest->>'description', l.description),
      category = COALESCE(r.manifest->>'category', l.category),
      resource_key = COALESCE(r.manifest#>>'{resource,key}', l.resource_key)
  FROM app_public.library_revision r
  WHERE r.id = ANY (revisions) AND l.id = r.library_id AND l.active_revision_id IS DISTINCT FROM r.id;

  REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;

  INSERT INTO app_private.library_publication (singleton, background_id) VALUES (true, generation)
  ON CONFLICT (singleton) DO UPDATE SET background_id = EXCLUDED.background_id;
END;
$$;

CREATE FUNCTION app_public.publish_library_generation(generation uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  candidate app_public.library_generation;
  current_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('library-publication'));
  SELECT * INTO candidate FROM app_public.library_generation WHERE id = generation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown generation'; END IF;

  SELECT id INTO current_id FROM app_public.current_background();
  IF current_id = generation AND candidate.status = 'published' THEN RETURN generation; END IF;
  IF candidate.status <> 'ready' THEN RAISE EXCEPTION 'Index must be verified before publication'; END IF;
  IF current_id IS DISTINCT FROM candidate.parent_background_id THEN
    RAISE EXCEPTION 'Catalog changed; rebuild candidate against current generation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app_public.library_revision r
    WHERE r.id = candidate.candidate_revision_id
      AND candidate.revision_ids @> ARRAY[r.id]
      AND NOT EXISTS (
        SELECT 1 FROM app_public.gene_set_library l
        WHERE l.id <> r.library_id AND l.active_revision_id IS NOT NULL
          AND NOT (l.active_revision_id = ANY (candidate.revision_ids))
      )
  ) THEN RAISE EXCEPTION 'Candidate omits an active library'; END IF;

  UPDATE app_public.library_revision SET status = 'published', published_at = COALESCE(published_at, now())
  WHERE id = candidate.candidate_revision_id;

  PERFORM app_private.activate_library_snapshot(generation, candidate.revision_ids);

  UPDATE app_public.library_generation SET status = 'published', published_at = now() WHERE id = generation;
  RETURN generation;
END;
$$;
REVOKE ALL ON FUNCTION app_public.publish_library_generation FROM PUBLIC, guest, authenticated;

CREATE FUNCTION app_public.rollback_library_generation(generation uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  revisions uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('library-publication'));
  SELECT revision_ids INTO revisions FROM app_public.library_generation WHERE id = generation AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rollback requires a previously published generation'; END IF;

  PERFORM app_private.activate_library_snapshot(generation, revisions);
  RETURN generation;
END;
$$;
REVOKE ALL ON FUNCTION app_public.rollback_library_generation FROM PUBLIC, guest, authenticated;

-- migrate:down
-- Restore the pre-migration backup to downgrade without losing revision data.
DO $$ BEGIN RAISE EXCEPTION 'Library catalog migration is forward-only'; END $$;
