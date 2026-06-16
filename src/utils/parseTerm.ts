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

/**
 * GEO series accession(s) embedded in a GEO-mined term (e.g. RummaGEO), in source order; [] if none.
 * Usually a single GSE; a comma-joined value is a SubSeries + its parent SuperSeries (SubSeries-first per the ETL).
 */
export function getGeoAccessions(term: string): string[] {
  const hit = parseTerm(term).extras.find((p) => /^GSE\d/.test(p))
  if (!hit) return []
  return hit
    .split(',')
    .map((a) => a.match(/^GSE\d+/)?.[0])
    .filter((a): a is string => !!a)
}
