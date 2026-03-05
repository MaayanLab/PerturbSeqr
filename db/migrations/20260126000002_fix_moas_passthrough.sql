-- migrate:up

--------------------------------------------------------------------------------
-- Fix MOA data passthrough from enrich service
-- The moas array was hardcoded to [] instead of being extracted from response
--------------------------------------------------------------------------------

-- Recreate indexed_enrich with moas data passthrough
CREATE OR REPLACE FUNCTION app_private.indexed_enrich(
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
  post_search_filter_library_names VARCHAR[] DEFAULT NULL
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
  # Pass library_names as comma-separated list if provided
  if library_names: params['library_names'] = ','.join(library_names)
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
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

-- Recreate indexed_paired_enrich with moas data passthrough
CREATE OR REPLACE FUNCTION app_private.indexed_paired_enrich(
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
  post_search_filter_library_names VARCHAR[] DEFAULT NULL
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
  # Pass library_names as comma-separated list if provided
  if library_names: params['library_names'] = ','.join(library_names)
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
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

-- migrate:down

-- Revert to previous version with hardcoded moas=[]
CREATE OR REPLACE FUNCTION app_private.indexed_enrich(
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
  post_search_filter_library_names VARCHAR[] DEFAULT NULL
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
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
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

CREATE OR REPLACE FUNCTION app_private.indexed_paired_enrich(
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
  post_search_filter_library_names VARCHAR[] DEFAULT NULL
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
  if post_search_filter_library_names: params['post_search_filter_library_names'] = ','.join(post_search_filter_library_names)
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
