import { parseTerm } from './parseTerm'

export type SignatureSummary = {
  id?: string | null
  term?: string | null
  nGeneIds?: number | null
  library?: { name?: string | null } | null
}

type SignatureArm = SignatureSummary & { id: string; term: string; nGeneIds: number }

export type SignaturePair = {
  term: string
  libraryName: string
  up: SignatureArm
  down: SignatureArm
}

export function pairSignatures(signatures: SignatureSummary[]): SignaturePair[] {
  const pairs = new Map<string, { term: string; libraryName: string; up?: SignatureArm; down?: SignatureArm }>()
  for (const signature of signatures) {
    const libraryName = signature.library?.name
    if (!signature.id || !signature.term || !signature.nGeneIds || !libraryName) continue
    const parsed = parseTerm(signature.term)
    if (parsed.direction !== 'up' && parsed.direction !== 'down') continue
    // Pair within a library using the complete label, never the gene-set hash.
    const key = JSON.stringify([libraryName, parsed.raw])
    const pair = pairs.get(key) ?? { term: parsed.raw, libraryName }
    pair[parsed.direction] = { ...signature, id: signature.id, term: signature.term, nGeneIds: signature.nGeneIds }
    pairs.set(key, pair)
  }
  return [...pairs.values()].flatMap(pair => pair.up && pair.down
    ? [{ term: pair.term, libraryName: pair.libraryName, up: pair.up, down: pair.down }]
    : [])
}
