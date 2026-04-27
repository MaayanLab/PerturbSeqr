// User-facing defaults for enrichment queries
// Shared constants must stay in sync with enrich/src/main.rs (Rust API defaults)
export const DEFAULT_CONSENSUS_TOP_N_SIGNATURES = 10_000; // top N results for consensus aggregation
export const DEFAULT_PVALUE_CUTOFF = 0.05;                // p-value cutoff for significance
export const RESULTS_PER_PAGE = 12;                       // results per page in the UI
export const PAGINATION_FETCH_BATCH_SIZE = 500;           // results per fetch in paginated generators
export const MAX_DOWNLOAD_RESULT_COUNT = 100_000;         // max results for TSV download
