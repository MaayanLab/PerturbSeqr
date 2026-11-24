export type CompoundAnnotation = {
  cid?: string | null
  name?: string | null
  source_name?: string | null
  moa?: string | null
  aliases?: string[]
}

export type CompoundLookup = Record<string, CompoundAnnotation>
export type LibraryCompoundLookup = Record<string, CompoundLookup>
export type CompoundContext = {
  label: string
  libraryId?: string | null
  cid?: string | null
  legacyLabel?: string
}

/** Parse an exact CID query, including the prefixes users see in search results. */
export function pubChemCid(value?: string | null): string | null {
  return /^(?:(?:pubchem(?:\s+cid)?|pcid|cid)\s*:\s*)?0*([1-9][0-9]*)$/i.exec(value?.trim() ?? '')?.[1] ?? null
}

function own<T>(lookup: Record<string, T> | undefined, key: string): T | undefined {
  return lookup && Object.hasOwn(lookup, key) ? lookup[key] : undefined
}

export function resolveCompound(context: CompoundContext, scoped: LibraryCompoundLookup, legacy: CompoundLookup) {
  const { label, libraryId, legacyLabel } = context
  const library = libraryId ? own(scoped, libraryId) : undefined
  // Exact source label in this library. An alias shared with another label cannot claim this row.
  const annotation = own(library, label)
  const storedCid = pubChemCid(context.cid)
  const mappedCid = pubChemCid(annotation?.cid)
  const taggedCid = label.includes(':') ? pubChemCid(label) : null
  const identity = storedCid ?? mappedCid ?? taggedCid
  const matching = !storedCid || storedCid === mappedCid ? annotation : undefined
  const fallback = [label, legacyLabel].map(value => value ? own(legacy, value.toLowerCase()) : undefined).find(hit => {
    // Once resolved, only inherit metadata for the same compound. An unresolved
    // library mapping also takes precedence over a guess from a legacy name.
    return hit && (identity ? pubChemCid(hit.cid) === identity : !library)
  })
  const cid = identity ?? pubChemCid(fallback?.cid)
  const name = matching?.name || fallback?.name || label
  return {
    cid,
    name,
    moa: matching?.moa || fallback?.moa || '',
    aliases: [...new Set([label, name, matching?.source_name, ...(matching?.aliases ?? []), ...(fallback?.aliases ?? [])]
      .filter((alias): alias is string => Boolean(alias)))],
    url: cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(label)}`,
  }
}

export function matchesCompoundQuery(compound: ReturnType<typeof resolveCompound>, query: string): boolean {
  const cid = pubChemCid(query)
  if (cid) return compound.cid === cid
  const needle = query.trim().toLowerCase()
  return !!needle && compound.aliases.some(alias => alias.toLowerCase().includes(needle))
}
