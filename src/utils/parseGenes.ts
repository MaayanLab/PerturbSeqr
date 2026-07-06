import uniqueArray from './uniqueArray'

/**
 * Parse raw pasted/uploaded text into a deduped list of gene symbols.
 * Shared by both input forms so they count genes identically. Strips CSV-cell
 * quotes and keeps tokens with a letter and length > 1, dropping pure numbers
 * (e.g. decimal columns from a pasted DE table). Non-gene tokens are dropped
 * later by background matching, so this only needs to keep the count honest.
 */
export default function parseGenes(raw: string): string[] {
  return uniqueArray(
    raw
      .split(/[;,\t\r\n\s]+/) // Split on common delimiters
      .map(v => v.replace(/^["']+|["']+$/g, '')) // Strip surrounding quotes (quoted CSV cells)
      .filter(v => v.length > 1 && /[A-Za-z]/.test(v))
  )
}
