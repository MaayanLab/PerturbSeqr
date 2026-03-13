-- Add cell line, timepoint, concentration field filters to enrichment functions
-- These are post-search filters (don't affect statistical background)

-- Add libraries field to consensus_result type
DO $$ BEGIN
  ALTER TYPE app_public.consensus_result ADD ATTRIBUTE libraries VARCHAR[];
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE app_public.consensus_result ADD ATTRIBUTE contributing_signatures JSON;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Drop and recreate indexed_enrich with new parameters
DROP FUNCTION IF EXISTS app_private.indexed_enrich;
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
  library_names VARCHAR[] DEFAULT NULL,
  post_search_filter_library_names VARCHAR[] DEFAULT NULL,
  filter_cell_line VARCHAR DEFAULT NULL,
  filter_timepoint VARCHAR DEFAULT NULL,
  filter_concentration VARCHAR DEFAULT NULL
)
RETURNS app_public.paginated_enrich_result
LANGUAGE plpython3u IMMUTABLE PARALLEL SAFE AS $$
  import os, json, requests
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
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
  if filter_cell_line: params['filter_cell_line'] = filter_cell_line
  if filter_timepoint: params['filter_timepoint'] = filter_timepoint
  if filter_concentration: params['filter_concentration'] = filter_concentration
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://enrich:8000')}/{background['id']}",
    params=params,
    json=gene_ids,
  )
  response_json = req.json()
  content_range_parts = req.headers.get('Content-Range').split('/')
  total_count = content_range_parts[1]
  consensus_count = content_range_parts[2]
  moas_count = content_range_parts[3] if len(content_range_parts) > 3 else 0
  gene_set_count = content_range_parts[4] if len(content_range_parts) > 4 else 0
  for item in response_json.get('consensus', []):
    if 'contributing_signatures' in item:
      item['contributing_signatures'] = json.dumps(item['contributing_signatures'])
  for item in response_json.get('moas', []):
    if 'contributing_signatures' in item:
      item['contributing_signatures'] = json.dumps(item['contributing_signatures'])
  return dict(
    nodes=response_json['results'],
    consensus=response_json['consensus'],
    moas=response_json.get('moas', []),
    total_count=total_count,
    consensus_count=consensus_count,
    moas_count=moas_count,
    gene_set_count=gene_set_count
  )
$$;

-- Drop and recreate background_enrich with new parameters
DROP FUNCTION IF EXISTS app_public.background_enrich;
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
  library_names VARCHAR[] DEFAULT NULL,
  post_search_filter_library_names VARCHAR[] DEFAULT NULL,
  filter_cell_line VARCHAR DEFAULT NULL,
  filter_timepoint VARCHAR DEFAULT NULL,
  filter_concentration VARCHAR DEFAULT NULL
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
    background_enrich.library_names,
    background_enrich.post_search_filter_library_names,
    background_enrich.filter_cell_line,
    background_enrich.filter_timepoint,
    background_enrich.filter_concentration
  ) r;
$$;
GRANT EXECUTE ON FUNCTION app_public.background_enrich TO guest, authenticated;

-- Drop and recreate indexed_paired_enrich with new parameters
DROP FUNCTION IF EXISTS app_private.indexed_paired_enrich;
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
  library_names VARCHAR[] DEFAULT NULL,
  post_search_filter_library_names VARCHAR[] DEFAULT NULL,
  filter_cell_line VARCHAR DEFAULT NULL,
  filter_timepoint VARCHAR DEFAULT NULL,
  filter_concentration VARCHAR DEFAULT NULL
)
RETURNS app_public.paginated_paired_enrich_result
LANGUAGE plpython3u IMMUTABLE PARALLEL SAFE AS $$
  import os, json, requests
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
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
  if filter_cell_line: params['filter_cell_line'] = filter_cell_line
  if filter_timepoint: params['filter_timepoint'] = filter_timepoint
  if filter_concentration: params['filter_concentration'] = filter_concentration
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://enrich:8000')}/pairs/{background['id']}",
    params=params,
    json={"up": gene_ids_up, "down": gene_ids_down},
  )
  response_json = req.json()
  content_range_parts = req.headers.get('Content-Range').split('/')
  total_count = content_range_parts[1]
  consensus_count = content_range_parts[2]
  moas_count = content_range_parts[3] if len(content_range_parts) > 3 else 0
  gene_set_count = content_range_parts[4] if len(content_range_parts) > 4 else 0
  for item in response_json.get('consensus', []):
    if 'contributing_signatures' in item:
      item['contributing_signatures'] = json.dumps(item['contributing_signatures'])
  for item in response_json.get('moas', []):
    if 'contributing_signatures' in item:
      item['contributing_signatures'] = json.dumps(item['contributing_signatures'])
  return dict(
    nodes=response_json['results'],
    consensus=response_json['consensus'],
    moas=response_json.get('moas', []),
    total_count=total_count,
    consensus_count=consensus_count,
    moas_count=moas_count,
    gene_set_count=gene_set_count
  )
$$;

-- Drop and recreate background_paired_enrich with new parameters
DROP FUNCTION IF EXISTS app_public.background_paired_enrich;
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
  library_names VARCHAR[] DEFAULT NULL,
  post_search_filter_library_names VARCHAR[] DEFAULT NULL,
  filter_cell_line VARCHAR DEFAULT NULL,
  filter_timepoint VARCHAR DEFAULT NULL,
  filter_concentration VARCHAR DEFAULT NULL
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
    background_paired_enrich.library_names,
    background_paired_enrich.post_search_filter_library_names,
    background_paired_enrich.filter_cell_line,
    background_paired_enrich.filter_timepoint,
    background_paired_enrich.filter_concentration
  ) r;
$$;
GRANT EXECUTE ON FUNCTION app_public.background_paired_enrich TO guest, authenticated;
