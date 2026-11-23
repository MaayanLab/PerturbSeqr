import type { NextApiRequest, NextApiResponse } from 'next'
import { libraryRead } from '@/lib/libraryDatabase'
import path from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { publicS3Location, type CatalogLibrary, type LibraryCatalog } from '@/utils/libraryCatalog'

type ExistingManifest = CatalogLibrary['manifest'] & {
  registration?: string; slug: string; displayName: string; category: CatalogLibrary['category'];
  description: string; resource: { key: string }; distribution?: { gmt?: string; metadata?: string };
  artifacts: Array<Partial<CatalogLibrary['artifacts'][number]> & {kind: string; distribution?: string}>
}

// Before the migration, the same checked-in manifests supply the existing catalog.
let existing: Promise<ExistingManifest[]> | undefined
function existingManifests() {
  return existing ??= (async () => {
    const root = path.join(process.cwd(), 'libraries')
    const entries = await readdir(root, { withFileTypes: true })
    const manifests = await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
      try { return JSON.parse(await readFile(path.join(root, entry.name, 'manifest.json'), 'utf8')) as ExistingManifest }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return null }
    }))
    return manifests.filter((manifest): manifest is ExistingManifest => manifest?.registration === 'existing')
  })()
}

async function legacyCatalog(): Promise<LibraryCatalog> {
  const [manifests, rows] = await Promise.all([existingManifests(), libraryRead(async db =>
    (await db.query<{ id: string; name: string }>('SELECT id,name FROM app_public.gene_set_library')).rows)])
  const libraries = manifests.flatMap(manifest => {
    const row = rows.find(row => row.name === manifest.displayName)
    return row ? [{
      id: row.id, slug: manifest.slug, name: row.name, category: manifest.category, resourceKey: manifest.resource.key,
      description: manifest.description, counts: {}, manifest: {
        legacy: true, sources: manifest.sources, publications: manifest.publications, presentation: manifest.presentation, license: manifest.license,
      }, artifacts: manifest.artifacts.map((artifact, i) => {
        const { kind, label, url, s3, bytes, format } = artifact
        const policy = artifact.distribution ?? manifest.distribution?.[kind === 'gmt' ? 'gmt' : 'metadata']
        const status = policy === 'restricted' ? 'restricted' : artifact.status ?? 'available'
        return { id: `${row.id}-${i}`, kind, label: label || kind, bytes, format,
          ...(status !== 'available' ? { status } : { status: 'external', ...(s3 ? publicS3Location(s3) : { url }) }) }
      }),
    }] : []
  })
  return { libraries }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const catalog = await libraryRead(async db => (await db.query('SELECT app_public.library_catalog() AS catalog')).rows[0].catalog)
      .catch(error => {
        if (error?.code === '42883') return legacyCatalog()
        throw error
      })
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(catalog)
  } catch (error) {
    console.error('Library catalog unavailable', error)
    res.status(503).json({ error: 'Library catalog unavailable' })
  }
}
