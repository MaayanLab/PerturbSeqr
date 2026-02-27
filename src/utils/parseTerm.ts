const DELIMITER = '::'
const FIELDS = ['perturbation', 'cellLine', 'cellType', 'timepoint', 'concentration'] as const

export type ParsedTerm = {
  perturbation: string
  cellLine: string
  cellType: string
  timepoint: string
  concentration: string
  direction: string
  extras: string[]
  raw: string
}

/**
 * Parse a canonical GMT term into its component fields.
 *
 * Canonical format: perturbation::cellLine::cellType::timepoint::concentration[::extra1::extra2::...] up|down
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

  const parts = body.split(DELIMITER)

  return {
    perturbation: parts[0] ?? '',
    cellLine: parts[1] ?? '',
    cellType: parts[2] ?? '',
    timepoint: parts[3] ?? '',
    concentration: parts[4] ?? '',
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
  if (Array.isArray(val)) return val.join(DELIMITER) || fallback
  return val || fallback
}
