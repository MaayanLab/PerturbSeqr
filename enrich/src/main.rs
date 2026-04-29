mod async_rwlockhashmap;
mod fastfisher;
mod bitvec;
mod s3;

#[macro_use] extern crate rocket;
use async_lock::RwLock;
use futures::StreamExt;
use rocket::http::ContentType;
use std::future;
use std::io::Cursor;
use std::collections::HashMap;
use rocket::request::Request;
use rocket::response::{self, Response, Responder, stream::TextStream};
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::{self, Row};
use rayon::prelude::*;
use uuid::Uuid;
use adjustp::{adjust, Procedure};
use rocket::{State, response::status::Custom, http::Status};
use rocket::serde::{json::{json, Json, Value}, Serialize, Deserialize};
use serde::{Serialize as SerdeSerialize, Deserialize as SerdeDeserialize};
use std::sync::Arc;
use retainer::Cache;
use std::time::Instant;

use fastfisher::FastFisher;
use async_rwlockhashmap::RwLockHashMap;
use bitvec::{
    SparseBitVec,       // compact storage for gene sets (indices of set bits)
    DenseBitVec,        // full-width vector for queries and library backgrounds (one byte per gene position)
    compute_overlap,    // counts query genes present in a gene set (Dense × Sparse)
    intersect_count,    // counts query genes present in a library's background (Dense × Dense)
};

// Enrichment defaults (API layer — permissive; frontend/SQL apply stricter user-facing defaults)
const CACHE_TTL_MS: u64 = 30_000;              // cache eviction: 30 seconds
const DEFAULT_CONSENSUS_TOP_N_SIGNATURES: usize = 10_000; // top N results for consensus aggregation
const DEFAULT_MIN_GENE_OVERLAP: u32 = 1;              // minimum gene overlap to include a result
const DEFAULT_PVALUE_CUTOFF: f64 = 1.0;      // p-value cutoff (1.0 = no filter at API level)
const DEFAULT_ADJ_PVALUE_CUTOFF: f64 = 1.0;  // adjusted p-value cutoff (1.0 = no filter at API level)
const INDEX_BUILD_LOG_INTERVAL: usize = 100_000; // log progress every N gene sets during index build
/**
 * Without this alternative allocator, very large chunks of memory do not get released back to the OS causing a large memory footprint over time.
 */
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[derive(Database)]
#[database("postgres")]
struct Postgres(sqlx::PgPool);

#[derive(Deserialize)]
struct InputGeneSets {
    up: Vec<String>,
    down: Vec<String>,
}


/// In-memory index for fast enrichment analysis.
/// Built from postgres at startup, serialized to disk for subsequent loads.
#[derive(SerdeSerialize, SerdeDeserialize, Clone)]
struct Bitmap {
    // Gene universe: maps each gene UUID to a bit position index (encoding: symbol → index)
    columns: HashMap<Uuid, u32>,
    // Reverse lookup: bit position index → gene symbol string (decoding: index → symbol, used for GMT export)
    columns_str: Vec<String>,

    // Gene sets: (gene_set_hash, sparse bit vector of gene positions)
    values: Vec<(Uuid, SparseBitVec)>,

    // Gene set metadata: gene_set_hash -> vec of (gene_set_id, term, description, fda_approved, count, pert, moa, cid)
    terms: HashMap<Uuid, Vec<(Uuid, String, String, bool, i32, String, String, String)>>,

    // Paired signatures: (up_index, down_index) into `values` for mimicker/reverser search
    signature_pairs: SignaturePairs,

    // Mechanism of action counts for consensus search
    moa_counts: HashMap<String, i32>,

    // Per-library state for library-specific Fisher's exact test backgrounds
    gene_set_libraries: HashMap<Uuid, String>,             // gene_set_hash -> library_name
    library_backgrounds: HashMap<String, DenseBitVec>,     // library_name -> dense bit vector of all genes in that library
    #[serde(default)]
    library_background_counts: HashMap<String, u32>,            // library_name -> |B_lib| (pre-computed library-specific background size)
    library_gene_set_indices: HashMap<String, Vec<usize>>, // library_name -> indices into `values`
    #[serde(default)]
    library_gene_set_counts: HashMap<String, usize>,      // library_name -> total gene sets in that library (BH denominator for single search)
    #[serde(default)]
    library_pair_counts: HashMap<String, usize>,           // library_name -> number of signature pairs in that library (BH denominator for paired search)
    // Union of all library backgrounds. Not used in Fisher's test (per-library backgrounds are used instead).
    // Retained for serialization compatibility.
    full_background: DenseBitVec,
}

#[derive(SerdeSerialize, SerdeDeserialize, Clone)]
struct SignaturePairs {
    pairs: Vec<(usize, usize)>, // Stores index pairs for "up" and "down" signatures
}

impl Bitmap {
    fn new() -> Self {
        Bitmap {
            columns: HashMap::new(),
            columns_str: Vec::new(),
            values: Vec::new(),
            terms: HashMap::new(),
            signature_pairs: SignaturePairs { pairs: Vec::new() },
            moa_counts: HashMap::new(),
            gene_set_libraries: HashMap::new(),
            library_backgrounds: HashMap::new(),
            library_background_counts: HashMap::new(),
            library_gene_set_indices: HashMap::new(),
            library_gene_set_counts: HashMap::new(),
            library_pair_counts: HashMap::new(),
            full_background: DenseBitVec::empty(0),
        }
    }

    // Look up which library a gene set belongs to by its index in `values`
    fn get_library_for_index(&self, index: usize) -> Option<&String> {
        let (uuid, _) = self.values.get(index)?;
        self.gene_set_libraries.get(uuid)
    }

    // Count signature pairs per library (BH denominator for paired search)
    fn get_library_pair_counts(&self) -> HashMap<String, usize> {
        let mut counts: HashMap<String, usize> = HashMap::new();
        // Both halves of a pair belong to same library, so we only check up_index
        for (up_idx, _) in &self.signature_pairs.pairs {
            if let Some(lib) = self.get_library_for_index(*up_idx) {
                *counts.entry(lib.clone()).or_default() += 1;
            }
        }
        counts
    }

    fn get_signature_pairs(&self) -> SignaturePairs {
        let mut name_to_indices: HashMap<String, (Option<usize>, Option<usize>)> = HashMap::new();

        // Iterate over values to ensure indices align with `values`
        for (idx, (uuid, _)) in self.values.iter().enumerate() {
            if let Some(term_vec) = self.terms.get(uuid) {
                for (_gene_set_id, full_name, _description, _fda_approved, _count, _pert, _moa, _cid) in term_vec {
                    if let Some(base_name) = full_name.strip_suffix(" up") {
                        name_to_indices.entry(base_name.to_string()).or_insert((None, None)).0 = Some(idx);
                    } else if let Some(base_name) = full_name.strip_suffix(" down") {
                        name_to_indices.entry(base_name.to_string()).or_insert((None, None)).1 = Some(idx);
                    }
                }
            }
        }
    
        // Extract valid pairs
        let pairs = name_to_indices
            .into_iter()
            .filter_map(|(_base_name, (up_idx, down_idx))| Some((up_idx?, down_idx?)))
            .collect();
    
        SignaturePairs { pairs }
    }

    fn get_moa_counts(&self) -> HashMap<String, i32> {
        let mut moa_counts: HashMap<String, i32> = HashMap::new();

        for term_list in self.terms.values() {
            for (_, _, _, _, _, _, moa, _cid) in term_list {
                *moa_counts.entry(moa.clone()).or_insert(0) += 1;
            }
        }
        moa_counts
    }
}

// Odds ratio with continuity correction (adds 0.5 to all cells to handle zero counts)
fn corrected_odds_ratio(a: usize, b: usize, c: usize, d: usize) -> f64 {
    const CONTINUITY_CORRECTION: f64 = 0.5;
    ((a as f64 + CONTINUITY_CORRECTION) * (d as f64 + CONTINUITY_CORRECTION))
        / ((b as f64 + CONTINUITY_CORRECTION) * (c as f64 + CONTINUITY_CORRECTION))
}

// Directional odds ratios for up/down consensus (same continuity correction)
fn corrected_directional_odds_ratios(a_up: usize, b_up: usize, a_down: usize, b_down: usize) -> (f64, f64) {
    const CONTINUITY_CORRECTION: f64 = 0.5;
    let up = ((a_up as f64 + CONTINUITY_CORRECTION) / (b_up as f64 + CONTINUITY_CORRECTION))
           / ((a_down as f64 + CONTINUITY_CORRECTION) / (b_down as f64 + CONTINUITY_CORRECTION));
    let down = ((b_up as f64 + CONTINUITY_CORRECTION) / (a_up as f64 + CONTINUITY_CORRECTION))
             / ((b_down as f64 + CONTINUITY_CORRECTION) / (a_down as f64 + CONTINUITY_CORRECTION));
    (up, down)
}

#[derive(Eq, PartialEq, PartialOrd, Ord)]
struct BackgroundQuery {
    background_id: Uuid,
    input_gene_set: DenseBitVec,
}

#[derive(Eq, PartialEq, PartialOrd, Ord)]
struct BackgroundQueryPair {
    background_id: Uuid,
    input_gene_set_up: DenseBitVec,
    input_gene_set_down: DenseBitVec,
}

// This structure stores a persistent many-reader single-writer hashmap containing cached indexes for a given background id
struct PersistentState {
    fisher: RwLock<FastFisher>,
    bitmaps: RwLockHashMap<Uuid, Bitmap>,
    latest: RwLock<Option<Uuid>>,
    cache: Cache<Arc<BackgroundQuery>, Arc<Vec<PartialQueryResult>>>,
    cachepair: Cache<Arc<BackgroundQueryPair>, Arc<Vec<PartialPairResult>>>,
    s3_bucket: Box<::s3::Bucket>,
}

// The response data, containing the ids, and relevant metrics
#[derive(Clone)] // Cloned from cache for per-request library filtering
struct PartialQueryResult {
    index: usize,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

#[derive(Clone)] // Cloned from cache for per-request library filtering
struct PartialPairResult {
    index: usize,
    index_up: usize,
    index_down: usize,
    mimicker_overlap: u32,
    reverser_overlap: u32,
    odds_ratio_mimic: f64,
    odds_ratio_reverse: f64,
    pvalue_mimic: f64,
    adj_pvalue_mimic: f64,
    pvalue_reverse: f64,
    adj_pvalue_reverse: f64,
}

#[derive(Serialize, Debug)]
struct QueryResult {
    gene_set_hash: String,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

#[derive(Serialize, Debug)]
struct PairedQueryResult {
    gene_set_hash_up: String,
    gene_set_hash_down: String,      
    mimicker_overlap: u32, 
    reverser_overlap: u32, 
    odds_ratio_mimic: f64,
    odds_ratio_reverse: f64, 
    pvalue_mimic: f64, 
    adj_pvalue_mimic: f64, 
    pvalue_reverse: f64,
    adj_pvalue_reverse: f64,
}

#[derive(Serialize, Debug, Clone)]
struct ContributingSignature {
    term: String,
    library: String,
    pvalue: f64,
}

#[derive(Serialize, Debug)]
struct DrugConsensusResult {
    drug: String,
    cid: Option<String>,  // PubChem CID for linking and grouping
    count_significant: usize,
    count_insignificant: usize,
    count_up_significant: usize,
    pvalue_up: f64,
    adj_pvalue_up: f64,
    odds_ratio_up: f64,
    pvalue_down: f64,
    adj_pvalue_down: f64,
    odds_ratio_down: f64,
    approved: bool,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
    libraries: Vec<String>,  // library names that contributed to this consensus result
    contributing_signatures: Vec<ContributingSignature>,
}

struct QueryResponse {
    results: Vec<QueryResult>,
    consensus: Vec<DrugConsensusResult>,
    moas: Vec<DrugConsensusResult>,
    // (range_start, range_end, total_count, consensus_count, moa_count, gene_set_count)
    content_range: (usize, usize, usize, usize, usize, usize),
}

struct PairedQueryResponse {
    results: Vec<PairedQueryResult>,
    consensus: Vec<DrugConsensusResult>,
    moas: Vec<DrugConsensusResult>,
    // (range_start, range_end, total_count, consensus_count, moa_count, gene_set_count)
    content_range: (usize, usize, usize, usize, usize, usize),
}


#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for QueryResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let json = rocket::serde::json::serde_json::json!({
            "results": &self.results,
            "consensus": &self.consensus,
            "moas": &self.moas
        });
        let json_str = rocket::serde::json::serde_json::to_string(&json).unwrap();
        Response::build()
            .header(ContentType::JSON)
            .raw_header("Range-Unit", "items")
            .raw_header("Content-Range", format!("{}-{}/{}/{}/{}/{}", self.content_range.0, self.content_range.1, self.content_range.2, self.content_range.3, self.content_range.4, self.content_range.5))
            .sized_body(json_str.len(), Cursor::new(json_str))
            .ok()
    }
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for PairedQueryResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let json = rocket::serde::json::serde_json::json!({
            "results": &self.results,
            "consensus": &self.consensus,
            "moas": &self.moas
        });
        let json_str = rocket::serde::json::serde_json::to_string(&json).unwrap();
        Response::build()
            .header(ContentType::JSON)
            .raw_header("Range-Unit", "items")
            .raw_header("Content-Range", format!("{}-{}/{}/{}/{}/{}", self.content_range.0, self.content_range.1, self.content_range.2, self.content_range.3, self.content_range.4, self.content_range.5))
            .sized_body(json_str.len(), Cursor::new(json_str))
            .ok()
    }
}


#[derive(SerdeSerialize, SerdeDeserialize)]
struct SerializableIndex {
    background_id: Uuid,
    bitmap: Bitmap,
}

async fn save_index(bucket: &::s3::Bucket, background_id: &Uuid, bitmap: &Bitmap) -> Result<(), String> {
    let index = SerializableIndex { background_id: *background_id, bitmap: bitmap.clone() };
    let bytes = bincode::serialize(&index).map_err(|e| e.to_string())?;
    s3::put_index(bucket, background_id, &bytes).await
}

async fn load_index(bucket: &::s3::Bucket, background_id: &Uuid) -> Result<Bitmap, String> {
    let bytes = s3::get_index(bucket, background_id).await?;
    let index: SerializableIndex = bincode::deserialize(&bytes).map_err(|e| e.to_string())?;
    if index.background_id != *background_id {
        return Err(format!("Index background_id mismatch: expected {}, got {}", background_id, index.background_id));
    }
    Ok(index.bitmap)
}

// Ensure the specific background_id exists in state, resolving it if necessary
async fn ensure_index(db: &mut Connection<Postgres>, state: &State<PersistentState>, background_id: Uuid) -> Result<(), String> {
    // Check if already in memory
    if state.bitmaps.contains_key(&background_id).await {
        return Ok(())
    }

    // Try to load from disk
    if let Ok(bitmap) = load_index(&state.s3_bucket, &background_id).await {
        if bitmap.library_backgrounds.len() == bitmap.library_background_counts.len() {
            let start = Instant::now();
            // Extend fisher table to handle this background
            {
                let mut fisher = state.fisher.write().await;
                fisher.extend_to(bitmap.columns.len() * 4);
            }
            state.bitmaps.insert(background_id, bitmap).await;
            *state.latest.write().await = Some(background_id);
            let duration = start.elapsed();
            println!("[{}] loaded from S3 in {:?}", background_id, duration);
            return Ok(());
        }
        println!("[{}] stale S3 index (library_backgrounds/library_background_counts out of sync); rebuilding from postgres", background_id);
        let _ = s3::delete_index(&state.s3_bucket, &background_id).await;
    }

    println!("[{}] initializing from database", background_id);
    let start = Instant::now();
    {
        // this lets us write a new bitmap by only blocking the whole hashmap for a short period to register the new bitmap
        // after which we block the new empty bitmap for writing
        let mut bitmap = state.bitmaps.insert_write(background_id, Bitmap::new()).await;

        let background_info = sqlx::query("select id, (select jsonb_object_agg(g.id, g.symbol) from jsonb_each(gene_ids) bg(gene_id, nil) inner join app_public.gene g on bg.gene_id::uuid = g.id) as genes from app_public.background b where id = $1::uuid;")
            .bind(background_id.to_string())
            .fetch_one(&mut **db).await.map_err(|e| e.to_string())?;

        let background_genes: sqlx::types::Json<HashMap<String, String>> = background_info.try_get("genes").map_err(|e| e.to_string())?;
        let mut background_genes = background_genes.iter().map(|(id, symbol)| Ok((Uuid::parse_str(id).map_err(|e| e.to_string())?, symbol.clone()))).collect::<Result<Vec<_>, String>>()?;
        background_genes.sort_unstable();
        {
            let mut fisher = state.fisher.write().await;
            fisher.extend_to(background_genes.len()*4);
        };
        bitmap.columns.reserve(background_genes.len());
        bitmap.columns_str.reserve(background_genes.len());
        for (i, (gene_id, gene)) in background_genes.into_iter().enumerate() {
            bitmap.columns.insert(gene_id, i as u32);
            bitmap.columns_str.push(gene);
        }

        // compute the index in memory (now includes library name and CID)
        let progress_counter = std::sync::atomic::AtomicUsize::new(0);
        sqlx::query("select gs.id, gs.term, coalesce(gs.description, '') as description, gs.hash, gs.gene_ids, fda.approved as fda_approved, fda.count as count, fda.perturbation as pert, fda.moa as moa, coalesce(gs.cid, '') as cid, coalesce(gsl.name, '') as library_name from app_public.gene_set gs left join app_public.gene_set_fda_counts fda on gs.id = fda.id left join app_public.gene_set_library gsl on gs.library_id = gsl.id;")
            .fetch(&mut **db)
            .for_each(|row| {
                let count = progress_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                if count % INDEX_BUILD_LOG_INTERVAL == 0 {
                    println!("[{}] loaded {} gene sets...", background_id, count);
                }
                let row = row.unwrap();
                let gene_set_id: uuid::Uuid = row.try_get("id").unwrap();
                let term: String = row.try_get("term").unwrap();
                let description: String = row.try_get("description").unwrap();
                let gene_set_hash: Result<uuid::Uuid, _> = row.try_get("hash");
                let fda_approved: bool = row.try_get::<bool, &str>("fda_approved").unwrap_or(false);
                let count: i32 = row.try_get("count").unwrap_or(0);
                let pert: String = row.try_get("pert").unwrap_or("").to_string();
                let moa: String = row.try_get("moa").unwrap_or("").to_string();
                let cid: String = row.try_get("cid").unwrap_or("").to_string();
                let library_name: String = row.try_get("library_name").unwrap_or("".to_string());
                if let Ok(gene_set_hash) = gene_set_hash {
                    if !bitmap.terms.contains_key(&gene_set_hash) {
                        let gene_ids: sqlx::types::Json<HashMap<String, sqlx::types::JsonValue>> = row.try_get("gene_ids").unwrap();
                        let gene_ids = gene_ids.keys().map(|gene_id| Uuid::parse_str(gene_id).unwrap()).collect::<Vec<Uuid>>();
                        let bitset = SparseBitVec::new(&bitmap.columns, &gene_ids);
                        bitmap.values.push((gene_set_hash, bitset));
                        // Store library for this gene set hash
                        if !library_name.is_empty() {
                            bitmap.gene_set_libraries.insert(gene_set_hash, library_name.clone());
                        }
                    }
                    bitmap.terms.entry(gene_set_hash).or_default().push((gene_set_id, term, description, fda_approved, count, pert, moa, cid));
                }
                future::ready(())
            })
            .await;

        // Compute per-library background bitvecs and full background
        let n_genes = bitmap.columns.len();
        let mut full_background = DenseBitVec::empty(n_genes);
        let mut library_gene_sets: HashMap<String, Vec<usize>> = HashMap::new();

        // Group gene set indices by library
        for (idx, (gene_set_hash, _)) in bitmap.values.iter().enumerate() {
            if let Some(lib_name) = bitmap.gene_set_libraries.get(gene_set_hash) {
                library_gene_sets.entry(lib_name.clone()).or_default().push(idx);
            }
        }

        // Build per-library backgrounds by OR-ing all gene sets in each library
        for (lib_name, indices) in library_gene_sets.iter() {
            let mut lib_background = DenseBitVec::empty(n_genes);
            for &idx in indices {
                let sparse = &bitmap.values[idx].1;
                let dense = DenseBitVec::from_sparse(sparse, n_genes);
                lib_background.union_mut(&dense);
            }
            // Also add to full background
            full_background.union_mut(&lib_background);
            // Insert into library_background_counts HashMap: library name --> number of set bits (unique genes) in the library's background bitvector
            bitmap.library_background_counts.insert(lib_name.clone(), lib_background.count_ones() as u32);
            bitmap.library_backgrounds.insert(lib_name.clone(), lib_background);
        }
        bitmap.full_background = full_background;
        bitmap.library_gene_set_indices = library_gene_sets;
        // Pre-compute gene set counts per library (BH denominator for single search)
        bitmap.library_gene_set_counts = bitmap.library_gene_set_indices.iter()
            .map(|(lib_name, indices)| (lib_name.clone(), indices.len()))
            .collect();

        // Debug logging for background sizes
        println!("[{}] loaded {} libraries with backgrounds", background_id, bitmap.library_backgrounds.len());
        println!("[{}] full_background gene count: {}", background_id, bitmap.full_background.count_ones());
        println!("[{}] total gene sets: {}", background_id, bitmap.values.len());
        for (lib_name, lib_bg) in bitmap.library_backgrounds.iter() {
            let gs_count = bitmap.library_gene_set_indices.get(lib_name).map(|v| v.len()).unwrap_or(0);
            println!("[{}]   {}: {} genes, {} gene sets", background_id, lib_name, lib_bg.count_ones(), gs_count);
        }

        // Compute derived data structures from the loaded gene sets
        bitmap.signature_pairs = bitmap.get_signature_pairs();
        bitmap.moa_counts = bitmap.get_moa_counts();
        bitmap.library_pair_counts = bitmap.get_library_pair_counts();

        // Save to S3 for faster subsequent startups
        if let Err(e) = save_index(&state.s3_bucket, &background_id, &bitmap).await {
            println!("[{}] warning: failed to save index to S3: {}", background_id, e);
        }
    }

    let duration = start.elapsed();
    println!("[{}] initialized from database in {:?}", background_id, duration);
    {
        let mut latest = state.latest.write().await;
        latest.replace(background_id);
    }
    Ok(())
}

#[get("/<background_id>")]
async fn ensure(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<Value, Custom<String>> {
    let background_id = Uuid::parse_str(background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    Ok(json!({
        "columns": bitmap.columns.len(),
        "index": bitmap.values.len(),
    }))
}

/**
 * This is a helper for building a GMT file on the fly, it's much cheaper to do this here
 *  than fetch it from the database, it's also nice since we won't need to save raw files.
 */
#[get("/<background_id>/gmt")]
async fn get_gmt(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: String,
) -> Result<TextStream![String + '_], Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::InternalServerError, String::from("Can't find background")))?;
    Ok(TextStream! {
        for (gene_set_hash, gene_set) in bitmap.values.iter() {
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                for (_row_id, term, description, _fda_approved, _count, _pert, _moa, _cid) in terms.iter() {
                    let mut line = String::new();
                    line.push_str(term);
                    line.push_str("\t");
                    line.push_str(description);
                    for col_ind in gene_set.v.iter() {
                        line.push_str("\t");
                        line.push_str(&bitmap.columns_str[*col_ind as usize]);
                    }
                    line.push_str("\n");
                    yield line
                }
            }
        }
    })
}

#[delete("/<background_id>")]
async fn delete(
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<(), Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    if state.bitmaps.remove(&background_id).await {
        println!("[{}] deleted from memory", background_id);
    }
    if let Err(e) = s3::delete_index(&state.s3_bucket, &background_id).await {
        println!("[{}] warning: failed to delete index from S3: {}", background_id, e);
    }
    Ok(())
}

// query a specific background_id, providing the bitset vector as input
//  the result are the gene_set_ids & relevant metrics
// this can be pretty fast since the index is saved in memory and the overlaps can be computed in parallel
#[post("/<background_id>?<filter_term>&<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>&<filter_fda>&<sortby>&<filter_ko>&<top_n>&<library_names>", data = "<input_gene_set>")]
async fn query(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_set: Json<Vec<String>>,
    background_id: &str,
    filter_term: Option<String>,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
    filter_fda: Option<bool>,
    sortby: Option<String>,
    filter_ko: Option<bool>,
    top_n: Option<usize>,
    library_names: Option<String>,
) -> Result<QueryResponse, Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let input_gene_set = input_gene_set.0.into_iter().map(|gene| Uuid::parse_str(&gene)).collect::<Result<Vec<_>, _>>().map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    let input_gene_set = DenseBitVec::new(&bitmap.columns, &input_gene_set);
    let filter_term = filter_term.and_then(|filter_term| Some(filter_term.to_lowercase()));
    let overlap_ge = overlap_ge.unwrap_or(DEFAULT_MIN_GENE_OVERLAP);
    let pvalue_le =  pvalue_le.unwrap_or(DEFAULT_PVALUE_CUTOFF);
    let adj_pvalue_le =  adj_pvalue_le.unwrap_or(DEFAULT_ADJ_PVALUE_CUTOFF);
    let sortby = sortby.and_then(|sortby| Some(sortby));
    let top_n = top_n.unwrap_or(DEFAULT_CONSENSUS_TOP_N_SIGNATURES);

    // Parse library_names filter (comma-separated string -> HashSet)
    let library_filter: Option<std::collections::HashSet<String>> = library_names.map(|names| {
        names.split(',').map(|s| s.trim().to_string()).collect()
    });

    // For each library, count how many of the user's query genes fall within that library's
    // gene universe. This is |Q ∩ B_lib| — used as the library-specific query size in the
    // Fisher's contingency table (the "b" cell = library_query_overlap_counts - overlap).
    let library_query_overlap_counts: HashMap<String, u32> = bitmap.library_backgrounds.iter()
        .map(|(name, lib_bg)| (name.clone(), intersect_count(&input_gene_set, lib_bg)))
        .collect();
    // e.g. {"LINCS L1000 CP": 198, "Tahoe-100M": 241, "CREEDS Gene": 253, ...}
    // A 265-gene query has 198 genes in L1000's universe, 241 in Tahoe's, etc.
    println!("[{}] query: input_genes={}, libraries={}",
             background_id, input_gene_set.n, library_query_overlap_counts.len());
    // Cache key: (background_id + query bitvec).
    let background_query = Arc::new(BackgroundQuery { background_id, input_gene_set });

    // Full unfiltered results are cached per query. On cache hit, clone and filter by request
    // parameters (library, FDA, etc.). On cache miss, compute from scratch and cache for reuse.
    let results = {
        let cached_results = state.cache.get(&background_query).await;

        if let Some(results) = cached_results {
            results.value().clone()
        } else {
            let fisher = state.fisher.read().await;

            // Closure: compute Fisher's exact test for one gene set against the user's query.
            // Returns None if the gene set doesn't pass overlap or p-value thresholds.
            let compute_result = |index: usize| -> Option<PartialQueryResult> {
                // Look up this gene set's hash and sparse bitvector from the index
                let (gene_set_uuid, gene_set) = &bitmap.values[index];
                // Find which library this gene set belongs to (e.g. "LINCS L1000 CP")
                let lib_name = bitmap.gene_set_libraries.get(gene_set_uuid)?;
                // Get the library-specific background size (e.g. 10,730 for L1000)
                let n_background = *bitmap.library_background_counts.get(lib_name)?;
                // Get how many query genes are in this library's universe (e.g. 198 of 265 for L1000)
                let n_user_gene_id = *library_query_overlap_counts.get(lib_name)?;

                // Count genes present in both the query and this gene set
                let n_overlap = compute_overlap(&background_query.input_gene_set, gene_set) as u32;
                // Skip if overlap is below the minimum threshold
                if n_overlap < overlap_ge {
                    return None;
                }
                // Number of genes in this gene set (length of sparse vector = number of set bits)
                let n_gs_gene_id = gene_set.v.len() as u32;
                // Build the 2x2 contingency table for Fisher's exact test:
                //   |              | In gene set | Not in gene set |
                //   | In query     | a           | b               |
                //   | Not in query | c           | d               |
                let a = n_overlap;
                let b = n_user_gene_id - a;
                let c = n_gs_gene_id - a;
                let d = n_background - b - c + a;
                // Compute one-tailed Fisher's exact test p-value
                let pvalue = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize);
                // Skip if p-value exceeds threshold
                if pvalue > pvalue_le {
                    return None;
                }
                // Odds ratio: (overlap / query size) / (gene set size / background size)
                let odds_ratio = ((n_overlap as f64) / (n_user_gene_id as f64)) / ((n_gs_gene_id as f64) / (n_background as f64));
                // Return result with placeholder adj_pvalue (BH correction applied later)
                Some(PartialQueryResult { index, n_overlap, odds_ratio, pvalue, adj_pvalue: 1.0 })
            };

            // Run compute_result against every gene set in parallel across all CPU cores (rayon).
            // Collect into per-library result vectors for independent BH correction.
            let all_results: Vec<_> = (0..bitmap.values.len())
                .into_par_iter()
                .filter_map(|index| compute_result(index))
                .collect();
            let pre_adj_count = all_results.len();

            // Group results by library
            let mut per_library: HashMap<String, Vec<PartialQueryResult>> = HashMap::new();
            for result in all_results {
                if let Some(lib) = bitmap.get_library_for_index(result.index) {
                    per_library.entry(lib.clone()).or_default().push(result);
                }
            }

            // Per-library Benjamini-Hochberg correction.
            // BH is applied within each library independently: passing p-values first, padded
            // with 1.0 to the library's total gene set count so BH knows the full test count.
            let mut results: Vec<PartialQueryResult> = Vec::with_capacity(pre_adj_count);
            for (lib_name, mut lib_results) in per_library {
                // Safe to unwrap: library_gene_set_counts is populated by ensure_index for all libraries
                let lib_size = *bitmap.library_gene_set_counts.get(&lib_name).unwrap();
                // Extract p-values from this library's passing results for BH input
                let mut pvalues: Vec<f64> = lib_results.iter().map(|r| r.pvalue).collect();
                // Pad to total gene sets in library so BH corrects over all tests, not just passing ones
                pvalues.resize(lib_size, 1.0);
                let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
                for (i, result) in lib_results.iter_mut().enumerate() {
                    result.adj_pvalue = adj_pvalues[i];
                }
                lib_results.retain(|r| r.adj_pvalue <= adj_pvalue_le);
                // Append this library's surviving results into the combined output
                results.extend(lib_results);
            }

            let post_adj_count = results.len();
            println!("[{}] filter stats: {} passed pvalue, {} passed adj_pvalue", background_id, pre_adj_count, post_adj_count);
            // Sort by raw p-value (most significant first)
            results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            let results = Arc::new(results);

            // Cache full unfiltered results (library filtering applied post-cache)
            state.cache.insert(background_query, results.clone(), CACHE_TTL_MS).await;

            let duration = start.elapsed();
            println!("[{}] enriched in {:?}", background_id, duration);
            results
        }
    };

    // Post-cache library filter: cached results contain all libraries, filter to user's selection
    let results: Arc<Vec<PartialQueryResult>> = if let Some(ref libs) = library_filter {
        let filtered: Vec<PartialQueryResult> = results.iter()
            .filter(|r| {
                bitmap.get_library_for_index(r.index)
                    .map_or(false, |lib| libs.contains(lib))
            })
            .cloned()
            .collect();
        Arc::new(filtered)
    } else {
        results // no filter, use all cached results
    };

    // Total gene sets searched (for response metadata), scoped to selected libraries if filtered
    let gene_set_count: usize = if let Some(ref libs) = library_filter {
        libs.iter()
            .filter_map(|lib| bitmap.library_gene_set_counts.get(lib))
            .sum()
    } else {
        bitmap.values.len() // no filter, count all gene sets
    };

    // CID-based consensus grouping: use CID as group key when available, fall back to perturbation name
    // This ensures synonyms (same CID, different names) are grouped together
    let mut drug_significance_counts: HashMap<String, (usize, usize, usize, bool)> = HashMap::new();
    let mut drug_counts: HashMap<String, (usize, bool)> = HashMap::new();
    let mut moa_signifigance_counts: HashMap<String, (usize, usize, usize)> = HashMap::new();
    // Maps each group_key to its output metadata: (display_name, cid, contributing_libraries).
    // group_key is PubChem CID when available, otherwise the raw perturbation name — this groups
    // synonyms (e.g., "vorinostat" and "SAHA" with the same CID) into a single consensus entry.
    let mut all_drug_metadata: HashMap<String, (String, Option<String>, std::collections::HashSet<String>)> = HashMap::new();
    let mut drug_contributing_sigs: HashMap<String, Vec<ContributingSignature>> = HashMap::new();
    let mut moa_contributing_sigs: HashMap<String, Vec<ContributingSignature>> = HashMap::new();

    for result in (*results).iter().take(top_n) {
        if let Some((gene_set_hash, _gene_set)) = bitmap.values.get(result.index) {
            let current_lib = bitmap.gene_set_libraries.get(gene_set_hash).cloned().unwrap_or_default();
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                // Iterate over the terms for the current gene set
                for (_gene_set_id, gene_set_term, _description, fda_approved, count, pert, moa, cid) in terms {
                    // Ensure `pert` is not empty before proceeding
                    if !pert.is_empty() {
                        // Use CID as group key when available, otherwise use perturbation name as-is
                        let group_key = if !cid.is_empty() {
                            cid.clone()
                        } else {
                            pert.clone()
                        };

                        // Increment the count for significant results
                        let entry = drug_significance_counts.entry(group_key.clone()).or_insert((0, 0, 0, false));
                        entry.0 += 1; // Increment significant count
                        if gene_set_term.contains(" up") {
                            entry.2 += 1;
                        }

                        // Track display name, CID, and contributing libraries for this group_key
                        let drug_metadata_entry = all_drug_metadata.entry(group_key.clone()).or_insert_with(|| {
                            let cid_opt = if !cid.is_empty() { Some(cid.clone()) } else { None };
                            (pert.clone(), cid_opt, std::collections::HashSet::new())
                        });
                        if !current_lib.is_empty() {
                            drug_metadata_entry.2.insert(current_lib.clone()); // .2 = contributing_libraries HashSet in (display_name, cid, libraries)
                        }

                        // Collect contributing signatures for drug consensus
                        drug_contributing_sigs.entry(group_key.clone()).or_default().push(ContributingSignature {
                            term: gene_set_term.clone(),
                            library: current_lib.clone(),
                            pvalue: result.pvalue,
                        });
                        if !moa.is_empty() {
                            moa_contributing_sigs.entry(moa.clone()).or_default().push(ContributingSignature {
                                term: gene_set_term.clone(),
                                library: current_lib.clone(),
                                pvalue: result.pvalue,
                            });
                        }

                        // Insert the drug's total count into `drug_counts` if it's not already present
                        if !drug_counts.contains_key(&group_key) {
                            // `count` is of type `i32`, so cast it to `usize`
                            drug_counts.insert(group_key.clone(), (*count as usize, *fda_approved));
                        }

                        let moa_entry = moa_signifigance_counts.entry(moa.clone()).or_insert((0, 0, 0));
                        moa_entry.0 += 1; // Increment significant count
                        if gene_set_term.contains(" up") {
                            moa_entry.2 += 1;
                        }
                    }
                }
            }
        }
    }

    for (group_key, (count_significant, count_insignificant, _sig_up, approved)) in &mut drug_significance_counts {
        if let Some(&(total_count, is_approved)) = drug_counts.get(group_key) {
            *count_insignificant = total_count.saturating_sub(*count_significant);
            *approved = is_approved;
        }
    }

    for (moa, (count_significant, count_insignificant, _sig_up)) in &mut moa_signifigance_counts {
        if let Some(total_count) = bitmap.moa_counts.get(moa) {
            *count_insignificant = (total_count.saturating_sub((*count_significant).try_into().unwrap())) as usize;
        }
    }

    let total_terms = bitmap.terms.values().len();

    let n_significant_drugs = results.len();
    let n_insignificant_drugs = total_terms - n_significant_drugs;

    // Extend the Fisher table if needed (only acquires write lock if extension is required)
    let required_capacity = total_terms * 2;
    {
        let fisher_read = state.fisher.read().await;
        if fisher_read.get_f().len() <= required_capacity {
            drop(fisher_read); // Release read lock before acquiring write lock
            let mut fisher_write = state.fisher.write().await;
            // Double-check after acquiring write lock (another thread may have extended it)
            if fisher_write.get_f().len() <= required_capacity {
                fisher_write.extend_to(required_capacity);
            }
        }
    }
    // Now use a read lock for the parallel computation
    let fisher = state.fisher.read().await;

    let mut consensus_results: Vec<DrugConsensusResult> = drug_significance_counts
        .par_iter() // Use Rayon parallel iterator
        .map(|(group_key, (count_sig, count_insig, sig_up, approved))| {
            // Lookup display name, CID, and libraries from all_drug_metadata
            let (display_name, cid, libs) = all_drug_metadata.get(group_key)
                .map(|(name, cid, libs)| (name.clone(), cid.clone(), libs.iter().cloned().collect::<Vec<_>>()))
                .unwrap_or_else(|| (group_key.clone(), None, vec![]));
            let sigs = drug_contributing_sigs.get(group_key).cloned().unwrap_or_default();

            // Construct the 2x2 contingency table
            let a = *count_sig; // Drug appears in significant results
            let b = *count_insig; // Drug appears in insignificant results
            let c = n_significant_drugs.saturating_sub(*count_sig); // Drug does not appear in significant results
            let d = n_insignificant_drugs.saturating_sub(*count_insig); // Drug does not appear in insignificant results
            let total_terms_by_dir = (*count_sig + *count_insig) / 2;

            // Log data quality warnings for potential stale materialized view
            if *count_insig > n_insignificant_drugs || *count_sig > n_significant_drugs {
                eprintln!("[DATA WARNING] Drug '{}': count_sig={} (max {}), count_insig={} (max {})",
                          display_name, *count_sig, n_significant_drugs, *count_insig, n_insignificant_drugs);
            }

            if (a < 5 || (*count_insig > n_insignificant_drugs)|| (*count_sig > n_significant_drugs)) {
                return DrugConsensusResult {
                    drug: display_name.clone(),
                    cid: cid.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0,
                    libraries: libs.clone(),
                    contributing_signatures: sigs.clone(),
                }
            }

            let odds_ratio = corrected_odds_ratio(a, b, c, d);

            let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
            // Store the result with Fisher's Exact Test p-value

            // Construct the second 2x2 table for directionality analysis
            let a_up = *sig_up; // Upregulated and significant
            let b_up = a.saturating_sub(*sig_up); // Downregulated and significant
            let a_down = (total_terms_by_dir as usize).saturating_sub(*sig_up); // Upregulated and insignificant
            let b_down = (*count_insig).saturating_sub(a_down); // Downregulated and insignificant

            let (odds_ratio_up, odds_ratio_down) = corrected_directional_odds_ratios(a_up, b_up, a_down, b_down);

            let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

            let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

            if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
                return DrugConsensusResult {
                    drug: display_name.clone(),
                    cid: cid.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0,
                    libraries: libs.clone(),
                    contributing_signatures: sigs.clone(),
                }
            }

            DrugConsensusResult {
                drug: display_name,
                cid,
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: p_value_up,
                adj_pvalue_up: 1.0,
                odds_ratio_up: odds_ratio_up,
                pvalue_down: p_value_down,
                adj_pvalue_down: 1.0,
                odds_ratio_down: odds_ratio_down,
                approved: *approved,
                odds_ratio: odds_ratio,
                pvalue: p_value,
                adj_pvalue: 1.0,
                libraries: libs,
                contributing_signatures: sigs,
            }
        })
    .collect(); // Collect the results into a vector

    let mut pvalues = vec![1.0; consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up = vec![1.0; consensus_results.len()];

    let mut pvalues_down = vec![1.0; consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues[i] = res.pvalue;
        pvalues_up[i] = res.pvalue_up;
        pvalues_down[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
    let adj_pvalues_up = adjust(&pvalues_up, Procedure::BenjaminiHochberg);
    let adj_pvalues_down = adjust(&pvalues_down, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues[i];
        res.adj_pvalue_up = adj_pvalues_up[i];
        res.adj_pvalue_down = adj_pvalues_down[i];
    }

    let mut moa_consensus_results: Vec<DrugConsensusResult> = moa_signifigance_counts
    .par_iter() // Use Rayon parallel iterator
    .map(|(moa, (count_sig, count_insig, sig_up))| {
        let sigs = moa_contributing_sigs.get(moa).cloned().unwrap_or_default();
        // Construct the 2x2 contingency table
        let a = *count_sig; // Drug appears in significant results
        let b = *count_insig; // Drug appears in insignificant results
        let c = n_significant_drugs.saturating_sub(*count_sig); // Drug does not appear in significant results
        let d = n_insignificant_drugs.saturating_sub(*count_insig); // Drug does not appear in insignificant results
        let total_terms_by_dir = (*count_sig + *count_insig) / 2;

        // Log data quality warnings for potential stale materialized view
        if *count_insig > n_insignificant_drugs || *count_sig > n_significant_drugs {
            eprintln!("[DATA WARNING] MOA '{}': count_sig={} (max {}), count_insig={} (max {})",
                      moa, *count_sig, n_significant_drugs, *count_insig, n_insignificant_drugs);
        }

        if (a < 5 || (*count_insig > n_insignificant_drugs)|| (*count_sig > n_significant_drugs)) {
            return DrugConsensusResult {
                drug: moa.clone(),
                cid: None,  // MOAs don't have CIDs
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: 1.0,
                adj_pvalue_up: 1.0,
                odds_ratio_up: 0.0,
                pvalue_down: 1.0,
                adj_pvalue_down: 1.0,
                odds_ratio_down: 0.0,
                approved: false,
                odds_ratio: 0.0,
                pvalue: 1.0,
                adj_pvalue: 1.0,
                libraries: vec![],
                contributing_signatures: sigs.clone(),
            }
        }

        let odds_ratio = corrected_odds_ratio(a, b, c, d);

        let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
        // Store the result with Fisher's Exact Test p-value

        // Construct the second 2x2 table for directionality analysis
        let a_up = *sig_up; // Upregulated and significant
        let b_up = a.saturating_sub(*sig_up); // Downregulated and significant
        let a_down = (total_terms_by_dir as usize).saturating_sub(*sig_up); // Upregulated and insignificant
        let b_down = (*count_insig).saturating_sub(a_down); // Downregulated and insignificant

        let (odds_ratio_up, odds_ratio_down) = corrected_directional_odds_ratios(a_up, b_up, a_down, b_down);

        let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

        let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

        if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
            return DrugConsensusResult {
                drug: moa.clone(),
                cid: None,
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: 1.0,
                adj_pvalue_up: 1.0,
                odds_ratio_up: 0.0,
                pvalue_down: 1.0,
                adj_pvalue_down: 1.0,
                odds_ratio_down: 0.0,
                approved: false,
                odds_ratio: 0.0,
                pvalue: 1.0,
                adj_pvalue: 1.0,
                libraries: vec![],
                contributing_signatures: sigs.clone(),
            }
        }

        DrugConsensusResult {
            drug: moa.clone(),
            cid: None,
            count_significant: *count_sig,
            count_insignificant: *count_insig,
            count_up_significant: *sig_up,
            pvalue_up: p_value_up,
            adj_pvalue_up: 1.0,
            odds_ratio_up: odds_ratio_up,
            pvalue_down: p_value_down,
            adj_pvalue_down: 1.0,
            odds_ratio_down: odds_ratio_down,
            approved: false,
            odds_ratio: odds_ratio,
            pvalue: p_value,
            adj_pvalue: 1.0,
            libraries: vec![],
            contributing_signatures: sigs,
        }
    })
    .collect(); // Collect the results into a vector

    let mut pvalues_moa = vec![1.0; moa_consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up_moa = vec![1.0; moa_consensus_results.len()];

    let mut pvalues_down_moa = vec![1.0; moa_consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    moa_consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues_moa[i] = res.pvalue;
        pvalues_up_moa[i] = res.pvalue_up;
        pvalues_down_moa[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues_moa = adjust(&pvalues_moa, Procedure::BenjaminiHochberg);
    let adj_pvalues_up_moa = adjust(&pvalues_up_moa, Procedure::BenjaminiHochberg);
    let adj_pvalues_down_moa = adjust(&pvalues_down_moa, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in moa_consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues_moa[i];
        res.adj_pvalue_up = adj_pvalues_up_moa[i];
        res.adj_pvalue_down = adj_pvalues_down_moa[i];
    }

    if let Some(filter_fda) = filter_fda {
        if filter_fda {
            consensus_results.retain(|result| result.approved);
        }
    }

    if let Some(filter_term) = &filter_term {
        let is_up = filter_term.contains(" up");
        let is_down = filter_term.contains(" down");
        let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
        let filter_terms: Vec<String> = filter_term_clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        if !filter_terms.is_empty() {
            consensus_results.retain(|result| {
                let drug_lower = result.drug.to_lowercase();
                filter_terms.iter().any(|ft| drug_lower.contains(ft))
            });
            moa_consensus_results.retain(|result| {
                let drug_lower = result.drug.to_lowercase();
                filter_terms.iter().any(|ft| drug_lower.contains(ft))
            });
        }

        if is_up {
            consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
            moa_consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
        } else if is_down {
            consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
            moa_consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
        }
    }

    if let Some(filter_ko) = filter_ko {
        if filter_ko {
            consensus_results.retain(|result| result.drug.contains(" "));
        }
    }

    consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));

    let consensus_len = consensus_results.len();

    let moa_consensus_len = moa_consensus_results.len();

    println!("Consensus results computed for {} perturbations and {} MoAs", consensus_len, moa_consensus_len);

    let mut results: Vec<_> = results
        .iter()
        .filter_map(|result| {
            let (gene_set_hash, _gene_set) = bitmap.values.get(result.index)?;
            if let Some(filter_term) = &filter_term {
                let is_up = filter_term.contains(" up");
                let is_down = filter_term.contains(" down");
                let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
                let filter_terms: Vec<String> = filter_term_clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                    if is_up && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert, _moa, _cid)|  gene_set_term.to_lowercase().contains(" up")) {
                        return None
                    }
                    else if is_down && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert, _moa, _cid)|  gene_set_term.to_lowercase().contains(" down")) {
                        return None
                    }
                    else if !filter_terms.is_empty() && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert, _moa, _cid)| {
                        let term_lower = gene_set_term.to_lowercase();
                        filter_terms.iter().any(|ft| term_lower.contains(ft))
                    }) {
                        return None
                    }
                }
            }
            if let Some(filter_fda) = filter_fda {
                if filter_fda {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, fda_approved, _count, _pert, _moa, _cid)| !*fda_approved) {
                            return None
                        }
                    }
                }
            }
            if let Some(filter_ko) = filter_ko {
                if filter_ko {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, _fda_approved, _count, pert, _moa, _cid)| !pert.contains(" ") ) {
                            return None
                        }
                    }
                }
            }

            Some(QueryResult {
                gene_set_hash: gene_set_hash.to_string(),
                n_overlap: result.n_overlap,
                odds_ratio: result.odds_ratio,
                pvalue: result.pvalue,
                adj_pvalue: result.adj_pvalue,
            })
        })
        .collect();

    if let Some(sortby) = sortby {
        match sortby.as_str() {
            "adj_pvalue" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| a.adj_pvalue.partial_cmp(&b.adj_pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_up" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_down" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_up" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_up" => {
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| a.adj_pvalue.partial_cmp(&b.adj_pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_down" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_down" => {
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| a.adj_pvalue.partial_cmp(&b.adj_pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "overlap" => {
                results.sort_unstable_by(|a, b| b.n_overlap.partial_cmp(&a.n_overlap).unwrap_or(std::cmp::Ordering::Equal));
            },
            _ => println!("Invalid sortby parameter. Defaulting to pvalue."),
        }
    }
    
    let range_total = results.len();
    let (range_start, range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total),
        (offset, None) => {
            if offset < results.len() {
                results.drain(..offset);
            };
            (offset, range_total)
        },
        (offset, Some(limit)) => {
            if offset < results.len() {
                results.drain(..offset);
                if limit < results.len() {
                    results.drain(limit..);
                }
            };
            (offset, offset + results.len())
        },
    };

    let (_consensus_range_start, _consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, consensus_results.len()),
        (offset, None) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
            };
            (offset, consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
                if limit < consensus_results.len() {
                    consensus_results.drain(limit..);
                }
            };
            (offset, offset + consensus_results.len())
        },
    };

    let (_moa_consensus_range_start, _moa_consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, moa_consensus_results.len()),
        (offset, None) => {
            if offset < moa_consensus_results.len() {
                moa_consensus_results.drain(..offset);
            };
            (offset, moa_consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < moa_consensus_results.len() {
                moa_consensus_results.drain(..offset);
                if limit < moa_consensus_results.len() {
                    moa_consensus_results.drain(limit..);
                }
            };
            (offset, offset + moa_consensus_results.len())
        },
    };
    
    
    Ok(QueryResponse {
        results,
        consensus: consensus_results,
        moas: moa_consensus_results,
        content_range: (range_start, range_end, range_total, consensus_len, moa_consensus_len, gene_set_count),
    })
}

#[post("/pairs/<background_id>?<filter_term>&<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>&<filter_fda>&<sortby>&<filter_ko>&<top_n>&<library_names>", data = "<input_gene_sets>")]
async fn query_pairs(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_sets: Json<InputGeneSets>,  // Expecting { "up": [...], "down": [...] }
    background_id: &str,
    filter_term: Option<String>,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
    filter_fda: Option<bool>,
    sortby: Option<String>,
    filter_ko: Option<bool>,
    top_n: Option<usize>,
    library_names: Option<String>,
) -> Result<PairedQueryResponse, Custom<String>> {

    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;

    let input_gene_set_up = input_gene_sets.up
    .iter()
    .map(|gene| Uuid::parse_str(gene))
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| Custom(Status::BadRequest, e.to_string()))?;

    let input_gene_set_down = input_gene_sets.down
        .iter()
        .map(|gene| Uuid::parse_str(gene))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| Custom(Status::BadRequest, e.to_string()))?;

    let input_gene_set_up = DenseBitVec::new(&bitmap.columns, &input_gene_set_up);
    let input_gene_set_down = DenseBitVec::new(&bitmap.columns, &input_gene_set_down);


    let filter_term = filter_term.and_then(|filter_term| Some(filter_term.to_lowercase()));
    let adj_pvalue_le =  adj_pvalue_le.unwrap_or(DEFAULT_ADJ_PVALUE_CUTOFF);
    let top_n = top_n.unwrap_or(DEFAULT_CONSENSUS_TOP_N_SIGNATURES);

    let fisher = state.fisher.read().await;

    // Parse library_names filter (comma-separated string -> HashSet)
    let library_filter: Option<std::collections::HashSet<String>> = library_names.map(|names| {
        names.split(',').map(|s| s.trim().to_string()).collect()
    });

    let library_query_overlap_counts_up: HashMap<String, u32> = bitmap.library_backgrounds.iter()
        .map(|(name, lib_bg)| (name.clone(), intersect_count(&input_gene_set_up, lib_bg)))
        .collect();
    let library_query_overlap_counts_down: HashMap<String, u32> = bitmap.library_backgrounds.iter()
        .map(|(name, lib_bg)| (name.clone(), intersect_count(&input_gene_set_down, lib_bg)))
        .collect();

    println!("[{}] Computing mimickers and reversers", background_id);
    let start = Instant::now();
    let background_query = Arc::new(BackgroundQueryPair { background_id, input_gene_set_up, input_gene_set_down });
    let mut results = {
        let cached_results = state.cachepair.get(&background_query).await;
        if let Some(results) = cached_results {
            results.value().clone()
        } else {
            let all_results: Vec<_> = bitmap.signature_pairs.pairs.par_iter().enumerate()
            .filter_map(|(index, (up_idx, down_idx))| {
                let (up_hash, gene_set_up) = &bitmap.values[*up_idx];
                let (_down_hash, gene_set_down) = &bitmap.values[*down_idx];

                let lib_name = bitmap.gene_set_libraries.get(up_hash)?;
                let n_background = *bitmap.library_background_counts.get(lib_name)?;
                let n_user_gene_id = *library_query_overlap_counts_up.get(lib_name)? + *library_query_overlap_counts_down.get(lib_name)?;

                // Compute four different overlaps
                let overlap_up_up = compute_overlap(&background_query.input_gene_set_up, &gene_set_up) as u32;
                let overlap_down_down = compute_overlap(&background_query.input_gene_set_down, &gene_set_down) as u32;
                let overlap_up_down = compute_overlap(&background_query.input_gene_set_up, &gene_set_down) as u32;
                let overlap_down_up = compute_overlap(&background_query.input_gene_set_down, &gene_set_up) as u32;

                // Compute mimicker and reverser scores
                let mimicker_overlap = overlap_up_up + overlap_down_down;
                let reverser_overlap = overlap_up_down + overlap_down_up;

                // Apply overlap filters
                if mimicker_overlap < overlap_ge.unwrap_or(DEFAULT_MIN_GENE_OVERLAP) && reverser_overlap < overlap_ge.unwrap_or(DEFAULT_MIN_GENE_OVERLAP) {
                    return None;
                }

                // Compute Fisher test for mimicker
                let a_mimic = mimicker_overlap;
                let b_mimic = n_user_gene_id - a_mimic;
                let c_mimic = (gene_set_up.v.len() + gene_set_down.v.len()) as u32 - a_mimic;
                let d_mimic = n_background - b_mimic - c_mimic + a_mimic;

                let pvalue_mimic = fisher.get_p_value(a_mimic as usize, b_mimic as usize, c_mimic as usize, d_mimic as usize);

                // Compute Fisher test for reverser
                let a_reverse = reverser_overlap;
                let b_reverse = n_user_gene_id - a_reverse;
                let c_reverse = (gene_set_up.v.len() + gene_set_down.v.len()) as u32 - a_reverse;
                let d_reverse = n_background - b_reverse - c_reverse + a_reverse;

                let pvalue_reverse = fisher.get_p_value(a_reverse as usize, b_reverse as usize, c_reverse as usize, d_reverse as usize);

                if pvalue_mimic > pvalue_le.unwrap_or(DEFAULT_PVALUE_CUTOFF) && pvalue_reverse > pvalue_le.unwrap_or(DEFAULT_PVALUE_CUTOFF) {
                    return None;
                }

                let odds_ratio_mimic = ((a_mimic as f64) / (n_user_gene_id as f64)) / ((c_mimic as f64) / (n_background as f64));
                let odds_ratio_reverse = ((a_reverse as f64) / (n_user_gene_id as f64)) / ((c_reverse as f64) / (n_background as f64));

                Some(PartialPairResult {
                    index,
                    index_up: *up_idx,
                    index_down: *down_idx,
                    mimicker_overlap,
                    reverser_overlap,
                    odds_ratio_mimic,
                    odds_ratio_reverse,
                    pvalue_mimic,
                    pvalue_reverse,
                    adj_pvalue_mimic: 1.0,
                    adj_pvalue_reverse: 1.0,
                })
            })
            .collect();

            // Group results by library
            let pre_adj_count = all_results.len();
            let mut per_library: HashMap<String, Vec<PartialPairResult>> = HashMap::new();
            for result in all_results {
                if let Some(lib) = bitmap.get_library_for_index(result.index_up) {
                    per_library.entry(lib.clone()).or_default().push(result);
                }
            }

            // Per-library BH correction for mimic and reverse p-values
            let mut results: Vec<PartialPairResult> = Vec::with_capacity(pre_adj_count);
            for (lib_name, mut lib_results) in per_library {
                // Safe to unwrap: library_pair_counts is populated by ensure_index for all libraries
                let lib_pair_count = *bitmap.library_pair_counts.get(&lib_name).unwrap();
                let mut pvalues_mimic: Vec<f64> = lib_results.iter().map(|r| r.pvalue_mimic).collect();
                let mut pvalues_reverse: Vec<f64> = lib_results.iter().map(|r| r.pvalue_reverse).collect();
                pvalues_mimic.resize(lib_pair_count, 1.0);
                pvalues_reverse.resize(lib_pair_count, 1.0);
                let adj_mimic = adjust(&pvalues_mimic, Procedure::BenjaminiHochberg);
                let adj_reverse = adjust(&pvalues_reverse, Procedure::BenjaminiHochberg);
                for (i, result) in lib_results.iter_mut().enumerate() {
                    result.adj_pvalue_mimic = adj_mimic[i];
                    result.adj_pvalue_reverse = adj_reverse[i];
                }
                lib_results.retain(|r| r.adj_pvalue_mimic <= adj_pvalue_le || r.adj_pvalue_reverse <= adj_pvalue_le);
                // Append this library's surviving results into the combined output
                results.extend(lib_results);
            }
            results.sort_unstable_by(|a, b| a.pvalue_mimic.partial_cmp(&b.pvalue_mimic).unwrap_or(std::cmp::Ordering::Equal));

            let results = Arc::new(results);
            state.cachepair.insert(background_query, results.clone(), CACHE_TTL_MS).await;

            let duration = start.elapsed();
            println!("[{}] enriched pairs in {:?}", background_id, duration);
            results
        }
    };

    // Post-cache library filter: both halves of a pair must be in selected libraries
    if let Some(ref libs) = library_filter {
        let filtered: Vec<PartialPairResult> = results.iter()
            .filter(|r| {
                let up_lib = bitmap.get_library_for_index(r.index_up);
                let down_lib = bitmap.get_library_for_index(r.index_down);
                up_lib.map_or(false, |l| libs.contains(l)) && down_lib.map_or(false, |l| libs.contains(l))
            })
            .cloned()
            .collect();
        results = Arc::new(filtered);
    }

    // Total signature pairs searched (for response metadata), scoped to selected libraries if filtered
    let gene_set_count: usize = if let Some(ref libs) = library_filter {
        bitmap.signature_pairs.pairs.iter()
            .filter(|(up_idx, down_idx)| {
                let up_matches = bitmap.get_library_for_index(*up_idx)
                    .map_or(false, |lib| libs.contains(lib));
                let down_matches = bitmap.get_library_for_index(*down_idx)
                    .map_or(false, |lib| libs.contains(lib));
                up_matches && down_matches
            })
            .count()
    } else {
        bitmap.signature_pairs.pairs.len()
    };

    // CID-based consensus grouping for paired query
    let mut drug_significance_counts: HashMap<String, (usize, usize, usize, bool)> = HashMap::new();
    let mut drug_counts: HashMap<String, (usize, bool)> = HashMap::new();
    let mut moa_signifigance_counts: HashMap<String, (usize, usize, usize)> = HashMap::new();
    // Maps each group_key to its output metadata: (display_name, cid, contributing_libraries).
    // group_key is PubChem CID when available, otherwise the raw perturbation name — this groups
    // synonyms (e.g., "vorinostat" and "SAHA" with the same CID) into a single consensus entry.
    let mut all_drug_metadata: HashMap<String, (String, Option<String>, std::collections::HashSet<String>)> = HashMap::new();
    let mut drug_contributing_sigs: HashMap<String, Vec<ContributingSignature>> = HashMap::new();
    let mut moa_contributing_sigs: HashMap<String, Vec<ContributingSignature>> = HashMap::new();

    for result in (*results).iter().take(top_n) {
        if let Some((gene_set_hash, _gene_set)) = bitmap.values.get(result.index_up) {
            let current_lib = bitmap.gene_set_libraries.get(gene_set_hash).cloned().unwrap_or_default();
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                // Iterate over the terms for the current gene set
                for (_gene_set_id, gene_set_term, _description, fda_approved, count, pert, moa, cid) in terms {
                    // Ensure `pert` is not empty before proceeding
                    if !pert.is_empty() {
                        // Use CID as group key when available, otherwise use perturbation name as-is
                        let group_key = if !cid.is_empty() {
                            cid.clone()
                        } else {
                            pert.clone()
                        };

                        // Increment the count for significant results
                        let entry = drug_significance_counts.entry(group_key.clone()).or_insert((0, 0, 0, false));
                        entry.0 += 1; // Increment significant count
                        if result.pvalue_mimic <  result.pvalue_reverse {
                            entry.2 += 1;
                        }

                        // Track display name, CID, and contributing libraries for this group_key
                        let drug_metadata_entry = all_drug_metadata.entry(group_key.clone()).or_insert_with(|| {
                            let cid_opt = if !cid.is_empty() { Some(cid.clone()) } else { None };
                            (pert.clone(), cid_opt, std::collections::HashSet::new())
                        });
                        if !current_lib.is_empty() {
                            drug_metadata_entry.2.insert(current_lib.clone()); // .2 = contributing_libraries HashSet in (display_name, cid, libraries)
                        }

                        drug_contributing_sigs.entry(group_key.clone()).or_default().push(ContributingSignature {
                            term: gene_set_term.clone(),
                            library: current_lib.clone(),
                            pvalue: result.pvalue_mimic,
                        });
                        if !moa.is_empty() {
                            moa_contributing_sigs.entry(moa.clone()).or_default().push(ContributingSignature {
                                term: gene_set_term.clone(),
                                library: current_lib.clone(),
                                pvalue: result.pvalue_mimic,
                            });
                        }

                        // Insert the drug's total count into `drug_counts` if it's not already present
                        if !drug_counts.contains_key(&group_key) {
                            // `count` is of type `i32`, so cast it to `usize`
                            drug_counts.insert(group_key.clone(), (*count as usize, *fda_approved));
                        }

                        if !moa.is_empty() {
                            let moa_entry = moa_signifigance_counts.entry(moa.clone()).or_insert((0, 0, 0));
                            moa_entry.0 += 1; // Increment significant count
                            if gene_set_term.contains(" up") {
                                moa_entry.2 += 1;
                            }
                        }

                    }
                }
            }
        }
    }

    for (group_key, (count_significant, count_insignificant, _sig_up, approved)) in &mut drug_significance_counts {
        if let Some(&(total_count, is_approved)) = drug_counts.get(group_key) {
            *count_insignificant = total_count.saturating_sub(*count_significant);
            *approved = is_approved;
        }
    }

    for (moa, (count_significant, count_insignificant, _sig_up)) in &mut moa_signifigance_counts {
        if let Some(total_count) = bitmap.moa_counts.get(moa) {
            *count_insignificant = (total_count.saturating_sub((*count_significant).try_into().unwrap())) as usize;
        }
    }

    let total_terms = bitmap.terms.values().len() / 2 as usize;

    let n_significant_drugs = results.len() / 2 as usize;

    let n_insignificant_drugs = total_terms - n_significant_drugs;

    let mut consensus_results: Vec<DrugConsensusResult> = drug_significance_counts
        .par_iter() // Use Rayon parallel iterator
        .map(|(group_key, (count_sig, count_insig, sig_up, approved))| {
            // Lookup display name, CID, and libraries from all_drug_metadata
            let (display_name, cid, libs) = all_drug_metadata.get(group_key)
                .map(|(name, cid, libs)| (name.clone(), cid.clone(), libs.iter().cloned().collect::<Vec<_>>()))
                .unwrap_or_else(|| (group_key.clone(), None, vec![]));
            let sigs = drug_contributing_sigs.get(group_key).cloned().unwrap_or_default();

            // Construct the 2x2 contingency table
            let a = *count_sig; // Drug appears in significant results
            let b = *count_insig; // Drug appears in insignificant results
            let c = n_significant_drugs.saturating_sub(*count_sig); // Drug does not appear in significant results
            let d = n_insignificant_drugs.saturating_sub(*count_insig); // Drug does not appear in insignificant results
            let total_terms_by_dir = (*count_sig + *count_insig) / 2;

            // Log data quality warnings for potential stale materialized view
            if *count_insig > n_insignificant_drugs || *count_sig > n_significant_drugs {
                eprintln!("[DATA WARNING] Drug '{}': count_sig={} (max {}), count_insig={} (max {})",
                          display_name, *count_sig, n_significant_drugs, *count_insig, n_insignificant_drugs);
            }

            if (a < 5 || (*count_insig > n_insignificant_drugs)|| (*count_sig > n_significant_drugs)) {
                return DrugConsensusResult {
                    drug: display_name.clone(),
                    cid: cid.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0,
                    libraries: libs.clone(),
                    contributing_signatures: sigs.clone(),
                }
            }

            let odds_ratio = corrected_odds_ratio(a, b, c, d);

            let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
            // Store the result with Fisher's Exact Test p-value

            // Construct the second 2x2 table for directionality analysis
            let a_up = *sig_up; // Upregulated and significant
            let b_up = a.saturating_sub(*sig_up); // Downregulated and significant
            let a_down = (total_terms_by_dir as usize).saturating_sub(*sig_up); // Upregulated and insignificant
            let b_down = (*count_insig).saturating_sub(a_down); // Downregulated and insignificant

            let (odds_ratio_up, odds_ratio_down) = corrected_directional_odds_ratios(a_up, b_up, a_down, b_down);

            let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

            let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

            if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
                return DrugConsensusResult {
                    drug: display_name.clone(),
                    cid: cid.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0,
                    libraries: libs.clone(),
                    contributing_signatures: sigs.clone(),
                }
            }

            DrugConsensusResult {
                drug: display_name,
                cid,
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: p_value_up,
                adj_pvalue_up: 1.0,
                odds_ratio_up: odds_ratio_up,
                pvalue_down: p_value_down,
                adj_pvalue_down: 1.0,
                odds_ratio_down: odds_ratio_down,
                approved: *approved,
                odds_ratio: odds_ratio,
                pvalue: p_value,
                adj_pvalue: 1.0,
                libraries: libs,
                contributing_signatures: sigs,
            }
        })
    .collect(); // Collect the results into a vector

    let mut pvalues = vec![1.0; consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up = vec![1.0; consensus_results.len()];

    let mut pvalues_down = vec![1.0; consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues[i] = res.pvalue;
        pvalues_up[i] = res.pvalue_up;
        pvalues_down[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
    let adj_pvalues_up = adjust(&pvalues_up, Procedure::BenjaminiHochberg);
    let adj_pvalues_down = adjust(&pvalues_down, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues[i];
        res.adj_pvalue_up = adj_pvalues_up[i];
        res.adj_pvalue_down = adj_pvalues_down[i];
    }

    let mut moa_consensus_results: Vec<DrugConsensusResult> = moa_signifigance_counts
    .par_iter() // Use Rayon parallel iterator
    .map(|(moa, (count_sig, count_insig, sig_up))| {
        let sigs = moa_contributing_sigs.get(moa).cloned().unwrap_or_default();
        // Construct the 2x2 contingency table
        let a = *count_sig; // Drug appears in significant results
        let b = *count_insig; // Drug appears in insignificant results
        let c = n_significant_drugs.saturating_sub(*count_sig); // Drug does not appear in significant results
        let d = n_insignificant_drugs.saturating_sub(*count_insig); // Drug does not appear in insignificant results
        let total_terms_by_dir = (*count_sig + *count_insig) / 2;

        // Log data quality warnings for potential stale materialized view
        if *count_insig > n_insignificant_drugs || *count_sig > n_significant_drugs {
            eprintln!("[DATA WARNING] MOA '{}': count_sig={} (max {}), count_insig={} (max {})",
                      moa, *count_sig, n_significant_drugs, *count_insig, n_insignificant_drugs);
        }

        if (a < 5 || (*count_insig > n_insignificant_drugs)|| (*count_sig > n_significant_drugs)) {
            return DrugConsensusResult {
                drug: moa.clone(),
                cid: None,  // MOAs don't have CIDs
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: 1.0,
                adj_pvalue_up: 1.0,
                odds_ratio_up: 0.0,
                pvalue_down: 1.0,
                adj_pvalue_down: 1.0,
                odds_ratio_down: 0.0,
                approved: false,
                odds_ratio: 0.0,
                pvalue: 1.0,
                adj_pvalue: 1.0,
                libraries: vec![],
                contributing_signatures: sigs.clone(),
            }
        }

        let odds_ratio = corrected_odds_ratio(a, b, c, d);

        let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
        // Store the result with Fisher's Exact Test p-value

        // Construct the second 2x2 table for directionality analysis
        let a_up = *sig_up; // Upregulated and significant
        let b_up = a.saturating_sub(*sig_up); // Downregulated and significant
        let a_down = (total_terms_by_dir as usize).saturating_sub(*sig_up); // Upregulated and insignificant
        let b_down = (*count_insig).saturating_sub(a_down); // Downregulated and insignificant

        let (odds_ratio_up, odds_ratio_down) = corrected_directional_odds_ratios(a_up, b_up, a_down, b_down);

        let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

        let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

        if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
            return DrugConsensusResult {
                drug: moa.clone(),
                cid: None,
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: 1.0,
                adj_pvalue_up: 1.0,
                odds_ratio_up: 0.0,
                pvalue_down: 1.0,
                adj_pvalue_down: 1.0,
                odds_ratio_down: 0.0,
                approved: false,
                odds_ratio: 0.0,
                pvalue: 1.0,
                adj_pvalue: 1.0,
                libraries: vec![],
                contributing_signatures: sigs.clone(),
            }
        }

        DrugConsensusResult {
            drug: moa.clone(),
            cid: None,
            count_significant: *count_sig,
            count_insignificant: *count_insig,
            count_up_significant: *sig_up,
            pvalue_up: p_value_up,
            adj_pvalue_up: 1.0,
            odds_ratio_up: odds_ratio_up,
            pvalue_down: p_value_down,
            adj_pvalue_down: 1.0,
            odds_ratio_down: odds_ratio_down,
            approved: false,
            odds_ratio: odds_ratio,
            pvalue: p_value,
            adj_pvalue: 1.0,
            libraries: vec![],
            contributing_signatures: sigs,
        }
    })
    .collect(); // Collect the results into a vector

    let mut pvalues_moa = vec![1.0; moa_consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up_moa = vec![1.0; moa_consensus_results.len()];

    let mut pvalues_down_moa = vec![1.0; moa_consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    moa_consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues_moa[i] = res.pvalue;
        pvalues_up_moa[i] = res.pvalue_up;
        pvalues_down_moa[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues_moa = adjust(&pvalues_moa, Procedure::BenjaminiHochberg);
    let adj_pvalues_up_moa = adjust(&pvalues_up_moa, Procedure::BenjaminiHochberg);
    let adj_pvalues_down_moa = adjust(&pvalues_down_moa, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in moa_consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues_moa[i];
        res.adj_pvalue_up = adj_pvalues_up_moa[i];
        res.adj_pvalue_down = adj_pvalues_down_moa[i];
    }

    if let Some(filter_fda) = filter_fda {
        if filter_fda {
            consensus_results.retain(|result| result.approved);
        }
    }

    if let Some(filter_term) = &filter_term {
        let is_up = filter_term.contains(" up");
        let is_down = filter_term.contains(" down");
        let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
        let filter_terms: Vec<String> = filter_term_clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        if !filter_terms.is_empty() {
            consensus_results.retain(|result| {
                let drug_lower = result.drug.to_lowercase();
                filter_terms.iter().any(|ft| drug_lower.contains(ft))
            });
            moa_consensus_results.retain(|result| {
                let drug_lower = result.drug.to_lowercase();
                filter_terms.iter().any(|ft| drug_lower.contains(ft))
            });
        }

        if is_up {
            consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
            moa_consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
        } else if is_down {
            consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
            moa_consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
        }
    }

    if let Some(filter_ko) = filter_ko {
        if filter_ko {
            consensus_results.retain(|result| result.drug.contains(" "));
        }
    }

    // Sort results by adjusted p-value
    consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));

    let consensus_len = consensus_results.len();

    let moa_consensus_len = consensus_results.len();

    println!("Consensus results computed for {} perturbations and {} MoAs", consensus_len, moa_consensus_len);


    let mut results: Vec<_> = results
        .iter()
        .filter_map(|result| {
            let (gene_set_hash, _gene_set) = bitmap.values.get(result.index_up)?;
            if let Some(filter_term) = &filter_term {
                let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
                let filter_terms: Vec<String> = filter_term_clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                let is_up = filter_term.contains(" up");
                let is_down = filter_term.contains(" down");
                if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                    if !filter_terms.is_empty() && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert, _moa, _cid)| {
                        let term_lower = gene_set_term.to_lowercase();
                        filter_terms.iter().any(|ft| term_lower.contains(ft))
                    }) {
                        return None
                    }
                } else if is_up && (result.pvalue_mimic > result.pvalue_reverse) {
                    return None
                } else if is_down && (result.pvalue_mimic < result.pvalue_reverse) {
                    return None
                }
            }
            if let Some(filter_fda) = filter_fda {
                if filter_fda {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, fda_approved, _count, _pert, _moa, _cid)| !*fda_approved) {
                            return None
                        }
                    }
                }
            }
            if let Some(filter_ko) = filter_ko {
                if filter_ko {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, _fda_approved, _count, pert, _moa, _cid)| !pert.contains(" ") ) {
                            return None
                        }
                    }
                }
            }
            Some(PairedQueryResult {
                gene_set_hash_up: bitmap.values[result.index_up].0.to_string(),
                gene_set_hash_down: bitmap.values[result.index_down].0.to_string(),
                mimicker_overlap: result.mimicker_overlap,
                reverser_overlap: result.reverser_overlap,
                odds_ratio_mimic: result.odds_ratio_mimic,
                odds_ratio_reverse: result.odds_ratio_reverse,
                pvalue_mimic: result.pvalue_mimic,
                adj_pvalue_mimic: result.adj_pvalue_mimic,
                pvalue_reverse: result.pvalue_reverse,
                adj_pvalue_reverse: result.adj_pvalue_reverse,
            })
        })
        .collect();


    if let Some(sortby) = sortby {
        match sortby.as_str() {
            "pvalue" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_up" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_down" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_up" => {
                results.sort_unstable_by(|a, b| a.pvalue_mimic.partial_cmp(&b.pvalue_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_up" => {
                results.sort_unstable_by(|a, b| a.adj_pvalue_mimic.partial_cmp(&b.adj_pvalue_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_down" => {
                results.sort_unstable_by(|a, b| a.pvalue_reverse.partial_cmp(&b.pvalue_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_down" => {
                results.sort_unstable_by(|a, b| a.adj_pvalue_reverse.partial_cmp(&b.adj_pvalue_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_mimic" => {
                results.sort_unstable_by(|a, b| a.pvalue_mimic.partial_cmp(&b.pvalue_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_mimic" => {
                results.sort_unstable_by(|a, b| a.adj_pvalue_mimic.partial_cmp(&b.adj_pvalue_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_up.partial_cmp(&b.adj_pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_reverse" => {
                results.sort_unstable_by(|a, b| a.pvalue_reverse.partial_cmp(&b.pvalue_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "adj_pvalue_reverse" => {
                results.sort_unstable_by(|a, b| a.adj_pvalue_reverse.partial_cmp(&b.adj_pvalue_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| a.adj_pvalue_down.partial_cmp(&b.adj_pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_mimic" => {
                results.sort_unstable_by(|a, b| b.odds_ratio_mimic.partial_cmp(&a.odds_ratio_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_reverse" => {
                results.sort_unstable_by(|a, b| b.odds_ratio_reverse.partial_cmp(&a.odds_ratio_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
                moa_consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            _ => println!("Invalid sortby parameter. Defaulting to pvalue."),
        }
    }
    
    let range_total = results.len();
    let (range_start, range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total),
        (offset, None) => {
            if offset < results.len() {
                results.drain(..offset);
            };
            (offset, range_total)
        },
        (offset, Some(limit)) => {
            if offset < results.len() {
                results.drain(..offset);
                if limit < results.len() {
                    results.drain(limit..);
                }
            };
            (offset, offset + results.len())
        },
    };

    let (_consensus_range_start, _consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, consensus_results.len()),
        (offset, None) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
            };
            (offset, consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
                if limit < consensus_results.len() {
                    consensus_results.drain(limit..);
                }
            };
            (offset, offset + consensus_results.len())
        },
    };

    let (_moa_consensus_range_start, _moa_consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, moa_consensus_results.len()),
        (offset, None) => {
            if offset < moa_consensus_results.len() {
                moa_consensus_results.drain(..offset);
            };
            (offset, moa_consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < moa_consensus_results.len() {
                moa_consensus_results.drain(..offset);
                if limit < moa_consensus_results.len() {
                    moa_consensus_results.drain(limit..);
                }
            };
            (offset, offset + moa_consensus_results.len())
        },
    };

    Ok(PairedQueryResponse {
        results,
        consensus: consensus_results,
        moas: moa_consensus_results,
        content_range: (range_start, range_end, range_total, consensus_len, moa_consensus_len, gene_set_count),
    })
}


#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(PersistentState {
            fisher: RwLock::new(FastFisher::new()),
            bitmaps: RwLockHashMap::new(),
            latest: RwLock::new(None),
            cache: Cache::new(),
            cachepair: Cache::new(),
            s3_bucket: s3::create_bucket(),
        })
        .attach(Postgres::init())
        .mount("/", routes![ensure, get_gmt, query, query_pairs, delete])
}
