import libraryConfig from '@/config/libraries.json'

type TermFormat = {
  delimiter: string
  fields: string[]
  optional: string[]
  splitFromEnd?: boolean  // If true, assign fields from the end of parts array (first field gets joined remainder)
  joinMiddle?: boolean    // If true, first field = first part, last N fields from end, middle parts joined for second field
  fieldsFromEnd?: number  // Number of fields to assign from end (used with joinMiddle)
  fixedValues?: Record<string, string>  // Fixed values to include for all terms (e.g., cellLine for single-cell-line datasets)
}

type ParsedTerm = {
  [key: string]: string | undefined
}

/**
 * Parse a term string into its component fields based on library config.
 *
 * Handles both formats:
 * - Old: "library:term direction" (e.g., "l1000-sigs:BRD-A00267231_HEMADO_A549_24.0_h_10.0_um up")
 * - New: "term direction" (e.g., "BRD-A00267231_HEMADO_A549_24.0_h_10.0_um up")
 *
 * @param term - The term with optional library prefix and direction suffix
 * @param libraryName - The library/dataset name (from gene set's library relation, optional)
 * @returns Object with parsed fields (perturbation, cellLine, timepoint, etc.)
 */
export function parseTerm(term: string, libraryName?: string): ParsedTerm {
  let termBody = term
  let detectedLibrary = libraryName

  // Check for old format with library prefix (library:term)
  const colonIndex = termBody.indexOf(':')
  if (colonIndex !== -1) {
    // Extract library from term prefix if present
    const prefixLibrary = termBody.substring(0, colonIndex)
    termBody = termBody.substring(colonIndex + 1)
    // Use prefix library if no library name provided
    if (!detectedLibrary) {
      detectedLibrary = prefixLibrary
    }
  }

  // Extract direction (last space-separated part if it's "up" or "down")
  let direction = ''
  if (termBody.endsWith(' up')) {
    direction = 'up'
    termBody = termBody.slice(0, -3)
  } else if (termBody.endsWith(' down')) {
    direction = 'down'
    termBody = termBody.slice(0, -5)
  } else if (termBody.endsWith(' dn')) {
    direction = 'down'
    termBody = termBody.slice(0, -3)
  }

  // If no library name, return raw term with direction
  if (!detectedLibrary) {
    return {
      raw: termBody,
      direction
    }
  }

  // Get term format from config (normalize library name to lowercase for lookup)
  const libraries = libraryConfig.libraries as Record<string, { termFormat?: TermFormat }>
  // Try lowercase version for config lookup (config keys are lowercase with hyphens)
  const normalizedLibraryName = detectedLibrary.toLowerCase()
  const libConfig = libraries[normalizedLibraryName]
  const termFormat = libConfig?.termFormat

  if (!termFormat) {
    // No format defined, return raw term
    return {
      library: detectedLibrary,
      raw: termBody,
      direction
    }
  }

  // Split by delimiter
  const parts = termBody.split(termFormat.delimiter)

  // Map parts to field names
  const result: ParsedTerm = {
    library: detectedLibrary,
    direction
  }

  if (termFormat.joinMiddle && termFormat.fieldsFromEnd && parts.length > termFormat.fieldsFromEnd + 1) {
    // First part → first field
    // Last N parts → last N fields
    // Everything in between joined → second field
    // e.g., "human_dermal_fibroblast-(S)-(+)-Camptothecin-3000-24" with fields ["cellLine", "perturbation", "concentration", "timepoint"]
    // -> cellLine: "human_dermal_fibroblast", perturbation: "(S)-(+)-Camptothecin", concentration: "3000", timepoint: "24"
    const numFromEnd = termFormat.fieldsFromEnd
    result[termFormat.fields[0]] = parts[0]
    const middleParts = parts.slice(1, -numFromEnd)
    result[termFormat.fields[1]] = middleParts.join(termFormat.delimiter)
    const endParts = parts.slice(-numFromEnd)
    endParts.forEach((part, index) => {
      result[termFormat.fields[termFormat.fields.length - numFromEnd + index]] = part
    })
  } else if (termFormat.splitFromEnd && parts.length >= termFormat.fields.length) {
    // Assign fields from the end, join remainder for first field
    // e.g., "N-acetyl-L-leucine-4622" with fields ["perturbation", "batch"]
    // -> perturbation: "N-acetyl-L-leucine", batch: "4622"
    const numFieldsFromEnd = termFormat.fields.length - 1
    const endParts = parts.slice(-numFieldsFromEnd)
    const firstPart = parts.slice(0, -numFieldsFromEnd).join(termFormat.delimiter)

    result[termFormat.fields[0]] = firstPart
    endParts.forEach((part, index) => {
      result[termFormat.fields[index + 1]] = part
    })
  } else {
    // Normal left-to-right assignment
    termFormat.fields.forEach((field, index) => {
      if (index < parts.length) {
        result[field] = parts[index]
      } else if (!termFormat.optional.includes(field)) {
        // Required field is missing
        result[field] = undefined
      }
    })
  }

  // Apply fixed values (e.g., cellLine for single-cell-line datasets like DRUGseqr)
  if (termFormat.fixedValues) {
    for (const [key, value] of Object.entries(termFormat.fixedValues)) {
      result[key] = value
    }
  }

  return result
}

/**
 * Get a specific field from a parsed term, with fallback.
 */
export function getTermField(term: string, field: string, libraryName?: string, fallback = ''): string {
  const parsed = parseTerm(term, libraryName)
  return parsed[field] ?? fallback
}
