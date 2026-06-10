-- migrate:up
-- PerturbSeek Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "plpython3u";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Schemas
CREATE SCHEMA app_public;
CREATE SCHEMA app_private;

-- Roles
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $$ BEGIN CREATE ROLE guest NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA app_public TO guest, authenticated;

--------------------------------------------------------------------------------
-- Types
--------------------------------------------------------------------------------

CREATE TYPE app_public.gene_mapping AS (
  gene_id UUID,
  gene VARCHAR
);

CREATE TYPE app_public.enrich_result AS (
  gene_set_hash UUID,
  n_overlap INTEGER,
  odds_ratio DOUBLE PRECISION,
  pvalue DOUBLE PRECISION,
  adj_pvalue DOUBLE PRECISION
);

CREATE TYPE app_public.consensus_result AS (
  drug VARCHAR,
  cid VARCHAR,
  count_significant INTEGER,
  count_insignificant INTEGER,
  count_up_significant INTEGER,
  pvalue_up DOUBLE PRECISION,
  adj_pvalue_up DOUBLE PRECISION,
  odds_ratio_up DOUBLE PRECISION,
  pvalue_down DOUBLE PRECISION,
  adj_pvalue_down DOUBLE PRECISION,
  odds_ratio_down DOUBLE PRECISION,
  approved BOOLEAN,
  odds_ratio DOUBLE PRECISION,
  pvalue DOUBLE PRECISION,
  adj_pvalue DOUBLE PRECISION,
  libraries VARCHAR[],
  contributing_signatures JSON
);

CREATE TYPE app_public.paginated_enrich_result AS (
  nodes app_public.enrich_result[],
  consensus app_public.consensus_result[],
  moas app_public.consensus_result[],
  total_count INTEGER,
  consensus_count INTEGER,
  moas_count INTEGER,
  gene_set_count INTEGER
);

CREATE TYPE app_public.paired_enrich_result AS (
  gene_set_hash_up UUID,
  gene_set_hash_down UUID,
  mimicker_overlap INTEGER,
  reverser_overlap INTEGER,
  odds_ratio_mimic DOUBLE PRECISION,
  odds_ratio_reverse DOUBLE PRECISION,
  pvalue_mimic DOUBLE PRECISION,
  adj_pvalue_mimic DOUBLE PRECISION,
  pvalue_reverse DOUBLE PRECISION,
  adj_pvalue_reverse DOUBLE PRECISION
);

CREATE TYPE app_public.paginated_paired_enrich_result AS (
  nodes app_public.paired_enrich_result[],
  consensus app_public.consensus_result[],
  moas app_public.consensus_result[],
  total_count INTEGER,
  consensus_count INTEGER,
  moas_count INTEGER,
  gene_set_count INTEGER
);

--------------------------------------------------------------------------------
-- Tables
--------------------------------------------------------------------------------

CREATE TABLE app_public.gene (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR NOT NULL UNIQUE,
  synonyms JSONB DEFAULT '{}'::JSONB,
  ncbi_gene_id INTEGER,
  description VARCHAR,
  summary TEXT
);
CREATE INDEX ON app_public.gene USING GIN (synonyms);
GRANT SELECT ON TABLE app_public.gene TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.gene TO authenticated;

CREATE TABLE app_public.gene_set_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  description VARCHAR NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT now()
);
GRANT SELECT ON TABLE app_public.gene_set_library TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.gene_set_library TO authenticated;

CREATE TABLE app_public.gene_set (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term VARCHAR NOT NULL,
  description VARCHAR,
  hash UUID NOT NULL,
  gene_ids JSONB NOT NULL,
  n_gene_ids INTEGER NOT NULL,
  library_id UUID REFERENCES app_public.gene_set_library(id) ON DELETE CASCADE,
  created TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT gene_set_term_library_key UNIQUE (term, library_id)
);
CREATE INDEX gene_set_gene_ids_idx ON app_public.gene_set USING GIN (gene_ids);
CREATE INDEX gene_set_term_idx ON app_public.gene_set USING GIN (term gin_trgm_ops);
CREATE INDEX gene_set_hash_idx ON app_public.gene_set USING BTREE (hash);
CREATE INDEX gene_set_library_id_idx ON app_public.gene_set USING BTREE (library_id);
GRANT SELECT ON TABLE app_public.gene_set TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.gene_set TO authenticated;

CREATE TABLE app_public.background (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gene_ids JSONB NOT NULL,
  n_gene_ids INTEGER NOT NULL,
  created TIMESTAMP DEFAULT now()
);
CREATE INDEX background_gene_ids_idx ON app_public.background USING GIN (gene_ids);
GRANT SELECT ON TABLE app_public.background TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.background TO authenticated;

CREATE TABLE app_public.user_gene_set (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  genes VARCHAR[],
  description VARCHAR DEFAULT '',
  created TIMESTAMP NOT NULL DEFAULT now()
);
GRANT SELECT ON TABLE app_public.user_gene_set TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.user_gene_set TO authenticated;

CREATE TABLE app_public.release (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  n_publications_processed BIGINT,
  created TIMESTAMP DEFAULT now()
);
CREATE INDEX release_created_idx ON app_public.release USING BTREE (created);
GRANT SELECT ON TABLE app_public.release TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.release TO authenticated;

CREATE TABLE app_public.fda_counts (
  perturbation VARCHAR PRIMARY KEY,
  count INTEGER,
  approved BOOLEAN,
  moa VARCHAR DEFAULT NULL
);
GRANT SELECT ON TABLE app_public.fda_counts TO guest;
GRANT ALL PRIVILEGES ON TABLE app_public.fda_counts TO authenticated;

--------------------------------------------------------------------------------
-- Materialized Views
--------------------------------------------------------------------------------

-- Maps gene sets to FDA approval status and MOA (mechanism of action) data.
-- NOTE: Created WITH NO DATA - must be refreshed after data ingestion.
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

CREATE MATERIALIZED VIEW app_private.pmc_stats AS
SELECT sum(release.n_publications_processed) AS n_publications_processed
FROM app_public.release
WITH NO DATA;

--------------------------------------------------------------------------------
-- Functions: Gene Mapping
--------------------------------------------------------------------------------

CREATE FUNCTION app_public.gene_map(genes VARCHAR[])
RETURNS SETOF app_public.gene_mapping
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT g.id AS gene_id, ug.gene AS gene
  FROM unnest(gene_map.genes) ug(gene)
  INNER JOIN app_public.gene g ON g.symbol = ug.gene OR g.synonyms ? ug.gene;
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_map TO guest, authenticated;

CREATE FUNCTION app_public.gene_map_2(genes VARCHAR[])
RETURNS SETOF app_public.gene_mapping
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT g.id AS gene_id, ug.gene AS gene
  FROM unnest(genes) ug(gene)
  LEFT JOIN app_public.gene g ON g.symbol = upper(ug.gene) OR g.synonyms ? upper(ug.gene);
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_map_2 TO guest, authenticated;

--------------------------------------------------------------------------------
-- Functions: User Gene Sets
--------------------------------------------------------------------------------

CREATE FUNCTION app_public.add_user_gene_set(genes VARCHAR[], description VARCHAR DEFAULT '')
RETURNS app_public.user_gene_set
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO app_public.user_gene_set (genes, description)
  SELECT (
    SELECT array_agg(ug.gene ORDER BY ug.gene)
    FROM unnest(add_user_gene_set.genes) ug(gene)
  ) AS genes, add_user_gene_set.description
  RETURNING *;
$$;
GRANT EXECUTE ON FUNCTION app_public.add_user_gene_set TO guest, authenticated;

--------------------------------------------------------------------------------
-- Functions: Gene Set Queries
--------------------------------------------------------------------------------

CREATE FUNCTION app_public.gene_set_genes(gene_set app_public.gene_set)
RETURNS SETOF app_public.gene
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT g.*
  FROM jsonb_each(gene_set_genes.gene_set.gene_ids) gsg(gene_id, position)
  INNER JOIN app_public.gene g ON gsg.gene_id = g.id::text
  ORDER BY gsg.position ASC;
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_set_genes TO guest, authenticated;

CREATE FUNCTION app_public.gene_set_overlap(gene_set app_public.gene_set, genes VARCHAR[])
RETURNS SETOF app_public.gene
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT DISTINCT g.*
  FROM app_public.gene_map(gene_set_overlap.genes) gm
  INNER JOIN app_public.gene g ON g.id = gm.gene_id
  WHERE gene_set.gene_ids ? gm.gene_id::text;
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_set_overlap TO guest, authenticated;

CREATE FUNCTION app_public.gene_set_gene_search(
  genes VARCHAR[],
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS SETOF app_public.gene_set
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT DISTINCT gs.*
  FROM app_public.gene_map(genes) g
  INNER JOIN app_public.gene_set gs ON gs.gene_ids ? g.gene_id::text
  WHERE (
    library_names IS NULL
    OR gs.library_id IN (
      SELECT id FROM app_public.gene_set_library
      WHERE name = ANY(library_names)
    )
  );
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_set_gene_search TO guest, authenticated;

CREATE FUNCTION app_public.gene_set_term_search(
  terms VARCHAR[],
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS SETOF app_public.gene_set
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT DISTINCT gs.*
  FROM app_public.gene_set gs
  INNER JOIN unnest(terms) ut(term) ON gs.term ILIKE ('%' || ut.term || '%')
  WHERE (
    library_names IS NULL
    OR gs.library_id IN (
      SELECT id FROM app_public.gene_set_library
      WHERE name = ANY(library_names)
    )
  );
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_set_term_search TO guest, authenticated;

CREATE FUNCTION app_public.gene_set_by_term(term varchar)
RETURNS app_public.gene_set AS $$
  SELECT gs.*
  FROM app_public.gene_set gs
  JOIN app_public.gene_set_library gsl ON gs.library_id = gsl.id
  WHERE gs.term = gene_set_by_term.term
  ORDER BY gsl.name, gs.created
  LIMIT 1;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION app_public.gene_set_by_term IS
  'Lookup a gene set by its term string. Returns the first match if term exists in multiple libraries.';
GRANT EXECUTE ON FUNCTION app_public.gene_set_by_term(varchar) TO guest, authenticated;

CREATE FUNCTION app_public.gene_mapping_gene_info(gene_mapping app_public.gene_mapping)
RETURNS app_public.gene
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT * FROM app_public.gene g WHERE g.id = gene_mapping.gene_id;
$$;
GRANT EXECUTE ON FUNCTION app_public.gene_mapping_gene_info TO guest, authenticated;

--------------------------------------------------------------------------------
-- Functions: Background & Enrichment
--------------------------------------------------------------------------------

CREATE FUNCTION app_public.current_background()
RETURNS app_public.background
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE AS $$
  SELECT * FROM app_public.background ORDER BY created ASC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION app_public.current_background TO guest, authenticated;

CREATE FUNCTION app_public.background_overlap(
  background app_public.background,
  genes VARCHAR[],
  overlap_greater_than INTEGER DEFAULT 0
)
RETURNS TABLE(gene_set_id UUID, n_overlap_gene_ids INTEGER, n_gs_gene_ids INTEGER)
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT
    gs.id AS gene_set_id,
    count(ig.gene_id) AS n_overlap_gene_ids,
    gs.n_gene_ids AS n_gs_gene_ids
  FROM (
    SELECT DISTINCT g.gene_id::text
    FROM app_public.gene_map(background_overlap.genes) g
  ) ig
  INNER JOIN app_public.gene_set gs ON gs.gene_ids ? ig.gene_id
  GROUP BY gs.id
  HAVING count(ig.gene_id) > background_overlap.overlap_greater_than;
$$;
GRANT EXECUTE ON FUNCTION app_public.background_overlap TO guest, authenticated;

CREATE FUNCTION app_private.indexed_enrich(
  background app_public.background,
  gene_ids UUID[],
  filter_term VARCHAR DEFAULT NULL,
  overlap_ge INTEGER DEFAULT 1,
  pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  adj_pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  "offset" INTEGER DEFAULT NULL,
  first INTEGER DEFAULT NULL,
  filter_fda BOOLEAN DEFAULT FALSE,
  sortby VARCHAR DEFAULT NULL,
  filter_ko BOOLEAN DEFAULT FALSE,
  top_n INTEGER DEFAULT 10000,
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS app_public.paginated_enrich_result
LANGUAGE plpython3u IMMUTABLE PARALLEL SAFE AS $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko,
    top_n=top_n
  )
  if len(gene_ids) < 1:
    return dict(nodes=[], consensus=[], moas=[], total_count=0, consensus_count=0, moas_count=0, gene_set_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  if library_names: params['library_names'] = ','.join(library_names)
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://enrich:8000')}/{background['id']}",
    params=params,
    json=gene_ids,
  )
  content_range_parts = req.headers.get('Content-Range').split('/')
  total_count = content_range_parts[1]
  consensus_count = content_range_parts[2]
  moas_count = content_range_parts[3] if len(content_range_parts) > 3 else 0
  gene_set_count = content_range_parts[4] if len(content_range_parts) > 4 else 0
  return dict(nodes=req.json()['results'], consensus=req.json()['consensus'], moas=[], total_count=total_count, consensus_count=consensus_count, moas_count=moas_count, gene_set_count=gene_set_count)
$$;

CREATE FUNCTION app_public.background_enrich(
  background app_public.background,
  genes VARCHAR[],
  filter_term VARCHAR DEFAULT NULL,
  overlap_ge INTEGER DEFAULT 1,
  pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  adj_pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  "offset" INTEGER DEFAULT NULL,
  first INTEGER DEFAULT NULL,
  filter_fda BOOLEAN DEFAULT FALSE,
  sortby VARCHAR DEFAULT NULL,
  filter_ko BOOLEAN DEFAULT FALSE,
  top_n INTEGER DEFAULT 10000,
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS app_public.paginated_enrich_result
LANGUAGE sql IMMUTABLE SECURITY DEFINER PARALLEL SAFE AS $$
  SELECT r.*
  FROM app_private.indexed_enrich(
    background_enrich.background,
    (SELECT array_agg(gene_id) FROM app_public.gene_map(genes) gm),
    background_enrich.filter_term,
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first",
    background_enrich.filter_fda,
    background_enrich.sortby,
    background_enrich.filter_ko,
    background_enrich.top_n,
    background_enrich.library_names
  ) r;
$$;
GRANT EXECUTE ON FUNCTION app_public.background_enrich TO guest, authenticated;

CREATE FUNCTION app_private.indexed_paired_enrich(
  background app_public.background,
  gene_ids_up UUID[],
  gene_ids_down UUID[],
  filter_term VARCHAR DEFAULT NULL,
  overlap_ge INTEGER DEFAULT 1,
  pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  adj_pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  "offset" INTEGER DEFAULT NULL,
  first INTEGER DEFAULT NULL,
  filter_fda BOOLEAN DEFAULT FALSE,
  sortby VARCHAR DEFAULT NULL,
  filter_ko BOOLEAN DEFAULT FALSE,
  top_n INTEGER DEFAULT 10000,
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS app_public.paginated_paired_enrich_result
LANGUAGE plpython3u IMMUTABLE PARALLEL SAFE AS $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko,
    top_n=top_n
  )
  if len(gene_ids_up) < 1 or len(gene_ids_down) < 1:
    return dict(nodes=[], consensus=[], moas=[], total_count=0, consensus_count=0, moas_count=0, gene_set_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  if library_names: params['library_names'] = ','.join(library_names)
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://enrich:8000')}/pairs/{background['id']}",
    params=params,
    json={"up": gene_ids_up, "down": gene_ids_down},
  )
  content_range_parts = req.headers.get('Content-Range').split('/')
  total_count = content_range_parts[1]
  consensus_count = content_range_parts[2]
  moas_count = content_range_parts[3] if len(content_range_parts) > 3 else 0
  gene_set_count = content_range_parts[4] if len(content_range_parts) > 4 else 0
  return dict(nodes=req.json()['results'], consensus=req.json()['consensus'], moas=[], total_count=total_count, consensus_count=consensus_count, moas_count=moas_count, gene_set_count=gene_set_count)
$$;

CREATE FUNCTION app_public.background_paired_enrich(
  background app_public.background,
  genes_up VARCHAR[],
  genes_down VARCHAR[],
  filter_term VARCHAR DEFAULT NULL,
  overlap_ge INTEGER DEFAULT 1,
  pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  adj_pvalue_le DOUBLE PRECISION DEFAULT 0.05,
  "offset" INTEGER DEFAULT NULL,
  first INTEGER DEFAULT NULL,
  filter_fda BOOLEAN DEFAULT FALSE,
  sortby VARCHAR DEFAULT NULL,
  filter_ko BOOLEAN DEFAULT FALSE,
  top_n INTEGER DEFAULT 10000,
  library_names VARCHAR[] DEFAULT NULL
)
RETURNS app_public.paginated_paired_enrich_result
LANGUAGE sql IMMUTABLE SECURITY DEFINER PARALLEL SAFE AS $$
  SELECT r.*
  FROM app_private.indexed_paired_enrich(
    background_paired_enrich.background,
    (SELECT array_agg(gene_id) FROM app_public.gene_map(genes_up) gm),
    (SELECT array_agg(gene_id) FROM app_public.gene_map(genes_down) gm),
    background_paired_enrich.filter_term,
    background_paired_enrich.overlap_ge,
    background_paired_enrich.pvalue_le,
    background_paired_enrich.adj_pvalue_le,
    background_paired_enrich."offset",
    background_paired_enrich."first",
    background_paired_enrich.filter_fda,
    background_paired_enrich.sortby,
    background_paired_enrich.filter_ko,
    background_paired_enrich.top_n,
    background_paired_enrich.library_names
  ) r;
$$;
GRANT EXECUTE ON FUNCTION app_public.background_paired_enrich TO guest, authenticated;

--------------------------------------------------------------------------------
-- Functions: Result Helpers
--------------------------------------------------------------------------------

CREATE FUNCTION app_public.enrich_result_gene_sets(enrich_result app_public.enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs WHERE gs.hash = enrich_result.gene_set_hash;
$$;
GRANT EXECUTE ON FUNCTION app_public.enrich_result_gene_sets TO guest, authenticated;

CREATE FUNCTION app_public.paired_enrich_result_gene_set(paired_enrich_result app_public.paired_enrich_result)
RETURNS SETOF app_public.gene_set
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT gs.* FROM app_public.gene_set gs
  WHERE gs.hash = paired_enrich_result.gene_set_hash_up OR gs.hash = paired_enrich_result.gene_set_hash_down;
$$;
GRANT EXECUTE ON FUNCTION app_public.paired_enrich_result_gene_set TO guest, authenticated;

CREATE FUNCTION app_public.get_fda_counts_by_id(id UUID)
RETURNS SETOF app_public.gene_set_fda_counts
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT * FROM app_public.gene_set_fda_counts WHERE id = $1;
$$;
GRANT EXECUTE ON FUNCTION app_public.get_fda_counts_by_id TO guest, authenticated;

CREATE FUNCTION app_public.pmc_stats()
RETURNS app_private.pmc_stats
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE AS $$
  SELECT * FROM app_private.pmc_stats;
$$;
GRANT EXECUTE ON FUNCTION app_public.pmc_stats TO guest, authenticated;

-- migrate:down
DROP SCHEMA IF EXISTS app_public CASCADE;
DROP SCHEMA IF EXISTS app_private CASCADE;
DROP ROLE IF EXISTS guest;
DROP ROLE IF EXISTS authenticated;
