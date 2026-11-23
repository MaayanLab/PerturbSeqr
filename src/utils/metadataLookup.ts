import { findCatalogLibrary } from './libraryCatalog'
import { resolveCompound, type CompoundContext, type CompoundLookup, type LibraryCompoundLookup } from './drugAnnotations'

let legacyCompounds: CompoundLookup = {}
let libraryCompounds: LibraryCompoundLookup = {}
let drugLookupLoading: Promise<void> | null = null
let drugLookupLoadedAt = 0

/** Load published library annotations separately from the legacy label lookup. */
export async function preloadDrugLookup(): Promise<void> {
  if (Date.now() - drugLookupLoadedAt < 60000) return
  if (drugLookupLoading) return drugLookupLoading

  drugLookupLoading = (async () => {
    try {
      const [legacy, published] = await Promise.all([
        fetch('/metadata/drug_lookup.json').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/library-compounds', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      if (legacy) legacyCompounds = legacy
      if (published) libraryCompounds = published
      drugLookupLoadedAt = Date.now()
    } finally { drugLookupLoading = null }
  })()
  return drugLookupLoading
}

export function getSignatureCompound(context: CompoundContext, annotationsLoaded = true) {
  return resolveCompound(context, annotationsLoaded ? libraryCompounds : {}, annotationsLoaded ? legacyCompounds : {})
}

export function isGenePerturbationLibrary(libraryName: string): boolean {
  return findCatalogLibrary(libraryName)?.category === 'gene'
}

export function getGenePerturbationUrl(perturbation: string): string {
  const geneName = perturbation.replace(/ (KO|OE|KD)$/i, '').trim()
  return `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(geneName)}`
}

export function getDatasetUrl(datasetName: string): string | null {
  const manifest = findCatalogLibrary(datasetName)?.manifest
  return manifest?.sources?.[0]?.url ?? manifest?.presentation?.relatedLinks?.[0]?.url ?? null
}

/** GEO accession-viewer URL for a GEO accession (GSE/GDS). */
export function getGeoUrl(gse: string): string {
  return `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${gse}`
}

/** ENA Browser URL for an INSDC study accession (SRP/ERP/DRP). */
export function getEnaUrl(acc: string): string {
  return `https://www.ebi.ac.uk/ena/browser/view/${acc}`
}
