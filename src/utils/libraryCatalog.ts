export type LibraryArtifact = {
  id: string; kind: string; label: string; status: string; format?: string;
  bytes?: number; sha256?: string; objectKey?: string; url?: string; s3?: string;
}
export type CatalogLibrary = {
  id: string; slug: string; name: string; category: 'drug' | 'gene'; resourceKey: string;
  description: string; revisionId?: string;
  counts: { geneSets?: number; pairedSignatures?: number; unpairedSignatures?: number; example?: string };
  manifest: {
    legacy?: boolean; sources?: { label: string; url: string }[]; publications?: { label?: string; url: string }[];
    license?: { id: string; url?: string; attribution?: string } | null; processing?: { status?: string; notes?: string };
    presentation?: {
      shortLabel?: string; filterLabel?: string; downloadTitle?: string; downloadSummary?: string;
      downloadSummaryLink?: { label?: string; url: string };
      relatedLinks?: { label?: string; url: string }[];
      logo?: { src: string; darkSrc?: string; invertInDarkMode?: boolean; width?: number };
      termExample?: { term: string; extraFields?: string[]; caption?: string };
    };
  };
  artifacts: LibraryArtifact[];
}
export type LibraryCatalog = { generation?: string; libraries: CatalogLibrary[] }

export function publicS3Location(s3: string) {
  const match = /^s3:\/\/([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\/([^?#\s]+)$/.exec(s3)
  if (!match) throw new Error(`Invalid S3 location: ${s3}`)
  const [, bucket, objectKey] = match
  const parts = objectKey.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`Invalid S3 object key: ${s3}`)
  return { objectKey, url: `https://${bucket}.s3.amazonaws.com/${parts.map(encodeURIComponent).join('/')}` }
}

export const emptyCatalog: LibraryCatalog = { libraries: [] }
let currentCatalog = emptyCatalog
export function rememberLibraryCatalog(catalog: LibraryCatalog) { currentCatalog = catalog }
export function findCatalogLibrary(name: string) {
  return currentCatalog.libraries.find(l => l.name.toLowerCase() === name.toLowerCase() || l.slug === name)
}
export function libraryFilterParam(selected: string[], all: string[]) {
  if (!selected.length) return '__none__'
  return selected.length === all.length && all.every(name => selected.includes(name)) ? '' : selected.join(',')
}
