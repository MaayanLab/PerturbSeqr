/**
 * Drug lookup and library type detection utilities.
 *
 * Metadata enrichment (RummaGEO, PerturbAtlas) is no longer needed here —
 * all metadata is now baked into canonical GMT terms by db/canonicalize_gmts.py.
 */

import libraryConfig from '@/config/libraries.json'


// ============================================================================
// Drug Lookup (Unified)
// ============================================================================
// Provides CID, MOA, FDA status, target info, and source attribution for drugs.
//
// Data sources (in priority order):
// 1. DRUGseqr metadata - for DRUGseqr NSN codes
// 2. Drug Repurposing Hub - for MOA, targets, FDA status
// 3. LINCS - for BRD codes via InChI keys
// 4. PubChem - CID fallback
//
// See db/build_drug_lookup.py for how the unified lookup is generated.

export type DrugInfo = {
  cid: string
  moa: string
  target: string
  fda_approved: boolean
  clinical_phase?: string
  name?: string  // Resolved name for BRD/NSN codes
  source: 'drug_repurposing_hub' | 'tahoe' | 'NIBR DRUG-seq' | 'lincs' | 'pubchem'
  moa_source?: 'drug_repurposing_hub' | 'tahoe' | 'NIBR DRUG-seq' | 'lincs'  // Where the MOA came from (may differ from source)
  source_url: string
}

let drugLookupCache: Record<string, DrugInfo> | null = null
let drugLookupLoading: Promise<Record<string, DrugInfo> | null> | null = null

/**
 * Load the unified drug lookup file.
 * Returns cached data on subsequent calls.
 */
async function loadDrugLookup(): Promise<Record<string, DrugInfo> | null> {
  if (drugLookupCache !== null) {
    return drugLookupCache
  }

  if (drugLookupLoading !== null) {
    return drugLookupLoading
  }

  drugLookupLoading = (async () => {
    try {
      const response = await fetch('/metadata/drug_lookup.json')
      if (!response.ok) {
        console.warn('Failed to load drug_lookup.json')
        return null
      }
      drugLookupCache = await response.json()
      return drugLookupCache
    } catch (error) {
      console.warn('Error loading drug_lookup.json:', error)
      return null
    }
  })()

  return drugLookupLoading
}

/**
 * Preload the drug lookup.
 * Call this at app startup or before displaying drug results.
 */
export async function preloadDrugLookup(): Promise<void> {
  await loadDrugLookup()
}

/**
 * Check if drug lookup is loaded.
 */
export function isDrugLookupLoaded(): boolean {
  return drugLookupCache !== null
}

/**
 * Look up drug info by name, BRD code, or NSN code.
 * Returns null if not found or not loaded.
 *
 * @param drugName - Drug name, BRD code, or NSN code (case-insensitive)
 */
export function getDrugInfo(drugName: string): DrugInfo | null {
  if (!drugLookupCache || !drugName) {
    return null
  }
  return drugLookupCache[drugName.toLowerCase()] || null
}

/**
 * Get PubChem CID for a drug.
 */
export function getDrugCid(drugName: string): string | null {
  const info = getDrugInfo(drugName)
  return info?.cid || null
}

/**
 * Get mechanism of action for a drug.
 */
export function getDrugMoa(drugName: string): string | null {
  const info = getDrugInfo(drugName)
  return info?.moa || null
}

/**
 * Get targets for a drug (pipe-separated string).
 */
export function getDrugTargets(drugName: string): string | null {
  const info = getDrugInfo(drugName)
  return info?.target || null
}

/**
 * Check if a drug is FDA approved.
 */
export function isDrugFdaApproved(drugName: string): boolean {
  const info = getDrugInfo(drugName)
  return info?.fda_approved ?? false
}

/**
 * Get PubChem URL for a drug.
 * If we have a CID, links directly to the compound page.
 * Otherwise, links to a PubChem name search.
 * Always returns a URL (never null).
 *
 * @param drugName - Drug name, BRD code, or NSN code
 */
export function getPubChemUrl(drugName: string): string {
  const cid = getDrugCid(drugName)
  if (cid) {
    return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
  }
  // Fallback to name search
  const encodedName = encodeURIComponent(drugName)
  return `https://pubchem.ncbi.nlm.nih.gov/#query=${encodedName}`
}

/**
 * Get the resolved drug name for BRD/NSN codes.
 * Returns the original name if no resolved name is available.
 */
export function getResolvedDrugName(drugName: string): string {
  const info = getDrugInfo(drugName)
  return info?.name || drugName
}


// ============================================================================
// Library Type Detection
// ============================================================================

/**
 * Check if a library is a gene perturbation library (vs drug perturbation).
 * Gene perturbation libraries contain knockouts, knockdowns, overexpression, etc.
 */
export function isGenePerturbationLibrary(libraryName: string): boolean {
  const normalizedName = libraryName.toLowerCase()
  const libraries = libraryConfig.libraries as Record<string, { displayName: string; category: string }>
  return Object.values(libraries).some(
    lib => lib.displayName.toLowerCase() === normalizedName && lib.category === 'gene'
  )
}

/**
 * Get the appropriate URL for a perturbation based on library type.
 * - Drug libraries: PubChem URL (using CID if available)
 * - Gene libraries: NCBI Gene search URL
 *
 * @param perturbation - The perturbation name (drug name or gene symbol)
 * @param libraryName - The library name to determine perturbation type
 */
export function getPerturbationUrl(perturbation: string, libraryName: string): string {
  if (isGenePerturbationLibrary(libraryName)) {
    // Gene perturbation - link to NCBI Gene search
    const geneName = perturbation.replace(/ (KO|OE|KD)$/i, '').trim()
    return `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(geneName)}`
  } else {
    // Drug perturbation - link to PubChem
    return getPubChemUrl(perturbation)
  }
}

/**
 * Get the link label for a perturbation based on library type.
 */
export function getPerturbationLinkTitle(libraryName: string): string {
  return isGenePerturbationLibrary(libraryName)
    ? 'View on NCBI Gene'
    : 'View on PubChem'
}


// ============================================================================
// Dataset URL Lookup
// ============================================================================

/**
 * Primary URLs for each dataset, matching the links on the About page.
 * Keys are display names from libraries.json (case-insensitive lookup).
 */
export const DATASET_URLS: Record<string, string> = {
  'tahoe-100m': 'https://huggingface.co/datasets/tahoebio/Tahoe-100M',
  'lincs l1000 cp': 'https://l2s2.maayanlab.cloud/download',
  'lincs l1000 xpr': 'https://l2s2.maayanlab.cloud/download',
  'microarrays cmap': 'https://www.broadinstitute.org/connectivity-map-cmap',
  'nibr drug-seq': 'https://drugseqr.maayanlab.cloud/download',
  'sciplex': 'https://github.com/cole-trapnell-lab/sci-plex',
  'deepcover moa': 'https://wren.hms.harvard.edu/DeepCoverMOA/',
  'creeds chem': 'https://maayanlab.cloud/CREEDS/',
  'creeds gene': 'https://maayanlab.cloud/CREEDS/',
  'rummageo chem': 'https://rummageo.com',
  'rummageo gene': 'https://rummageo.com',
  'ginkgo bioworks': 'https://www.ginkgobioworks.com/',
  'perturb atlas': 'https://perturbatlas.kratoss.site/#/',
  'perturb atlas mouse': 'https://perturbatlas.kratoss.site/#/',
  'replogle k562 essential': 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
  'replogle k562 genome-wide': 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
  'replogle rpe1 essential': 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
}

/**
 * Get the primary URL for a dataset.
 * Returns the URL if found, or null if not.
 *
 * @param datasetName - The dataset display name (case-insensitive)
 */
export function getDatasetUrl(datasetName: string): string | null {
  if (!datasetName) return null
  return DATASET_URLS[datasetName.toLowerCase()] || null
}
