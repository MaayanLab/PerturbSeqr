const TERM_DELIMITER = '::'
const FIELDS = ['perturbation', 'cellLine', 'cellType', 'timepoint', 'concentration'] as const

export type ParsedTerm = {
  perturbation: string
  cellLine: string
  cellType: string
  timepoint: string
  concentration: string
  /** KO/KD/KI/OE/Mut, blank if unknown. Gene libraries only; '|'-aligned to `perturbation` for combinations. */
  perturbationType: string
  /** CRISPRi/Cas9/shRNA/... — gene libraries only. */
  perturbationMethod: string
  direction: string
  extras: string[]
  raw: string
}

/**
 * Parse a canonical GMT term into its component fields.
 *
 * Canonical format: perturbation::cellLine::cellType::timepoint::concentration[::extra1::extra2::...] up|down
 * For gene perturbation libraries, fields 5 and 6 are perturbation_type and perturbation_method.
 *
 * @param term - The term string with direction suffix
 * @returns ParsedTerm with all fields
 */
export function parseTerm(term: string): ParsedTerm {
  let body = term
  let direction = ''

  if (body.endsWith(' up')) {
    direction = 'up'
    body = body.slice(0, -3)
  } else if (body.endsWith(' down')) {
    direction = 'down'
    body = body.slice(0, -5)
  } else if (body.endsWith(' dn')) {
    direction = 'down'
    body = body.slice(0, -3)
  }

  const parts = body.split(TERM_DELIMITER)

  return {
    perturbation: parts[0] ?? '',
    cellLine: parts[1] ?? '',
    cellType: parts[2] ?? '',
    timepoint: parts[3] ?? '',
    concentration: parts[4] ?? '',
    perturbationType: parts[5] ?? '',
    perturbationMethod: parts[6] ?? '',
    direction,
    extras: parts.slice(5),
    raw: body,
  }
}

/** Search perturbation names and canonical compound IDs, excluding experimental metadata. */
export function matchesPerturbation(parsed: ParsedTerm, query: string): boolean {
  const names = [parsed.perturbation, ...parsed.extras.filter(value => /^(BRD-[AK]\d|NSN:)/i.test(value))]
  const needle = query.toLowerCase()
  return names.some(name => name.toLowerCase().includes(needle))
}

/**
 * Get the display value for cell line. Does NOT fall back to cellType,
 * as cellType often contains long tissue/condition descriptions (e.g. from CREEDS/GEO)
 * that don't belong in a "Cell Line" column.
 */
export function getCellDisplay(parsed: ParsedTerm): string {
  return parsed.cellLine || ''
}

/**
 * Get a specific field from a parsed term, with fallback.
 */
export function getTermField(term: string, field: keyof ParsedTerm, fallback = ''): string {
  const parsed = parseTerm(term)
  const val = parsed[field]
  if (Array.isArray(val)) return val.join(TERM_DELIMITER) || fallback
  return val || fallback
}

/** Append perturbation type to each gene for gene libraries (e.g. "PRSS36 KO", "SF3A3 KD | MYC OE"). Returns `perturbation` unchanged for drug libraries or when the type is blank. */
export function formatPerturbationWithType(
  perturbation: string,
  perturbationType: string,
  isGeneLibrary: boolean,
): string {
  if (!isGeneLibrary || !perturbation) return perturbation
  const genes = perturbation.split('|')
  const types = perturbationType.split('|')
  return genes
    .map((gene, i) => {
      const t = (types[i] || '').trim()
      return t ? `${gene} ${t}` : gene
    })
    .join(' | ')
}

/** First `extras` field matching `re` (an accession prefix anchored at `^`), comma-split into bare
 *  accessions; [] if none. Shared by the GEO/SRA extractors below. */
function extractAccessions(term: string, re: RegExp): string[] {
  const hit = parseTerm(term).extras.find((p) => re.test(p))
  if (!hit) return []
  return hit
    .split(',')
    .map((a) => a.match(re)?.[0])
    .filter((a): a is string => !!a)
}

/**
 * GEO accession(s) (GSE or GDS) embedded in a GEO-mined term (RummaGEO, CREEDS); [] if none.
 * Strips any CREEDS `.NNN` suffix; a comma-joined RummaGEO value is a SubSeries + its parent SuperSeries.
 */
export function getGeoAccessions(term: string): string[] {
  return extractAccessions(term, /^(GSE|GDS)\d+/)
}

/** SRA-study accession(s) (SRP/ERP/DRP) embedded in a term (e.g. PerturbAtlas); [] if none. */
export function getSraStudyAccessions(term: string): string[] {
  return extractAccessions(term, /^(SRP|ERP|DRP)\d+/)
}
