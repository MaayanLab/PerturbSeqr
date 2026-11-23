import type { NextApiRequest, NextApiResponse } from 'next'
import { libraryRead } from '@/lib/libraryDatabase'
import type { CompoundAnnotation, CompoundLookup, LibraryCompoundLookup } from '@/utils/drugAnnotations'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const rows = await libraryRead(async db => (await db.query<{
      library_id: string; label: string; cid: string | null; metadata: CompoundAnnotation
    }>(`
      SELECT l.id AS library_id, c.label, c.cid, c.metadata
      FROM app_public.library_compound c
      JOIN app_public.gene_set_library l ON l.active_revision_id = c.revision_id
    `)).rows)
    const lookup: LibraryCompoundLookup = Object.create(null)
    for (const { library_id, label, cid, metadata } of rows) {
      const library: CompoundLookup = lookup[library_id] ??= Object.create(null)
      const { name, source_name, moa, aliases } = metadata
      library[label] = { cid, name, source_name, moa, aliases }
    }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(lookup)
  } catch (error) {
    console.error('Library annotations unavailable', error)
    res.status(503).json({ error: 'Library annotations unavailable' })
  }
}
