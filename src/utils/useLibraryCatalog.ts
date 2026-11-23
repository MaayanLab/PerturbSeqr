'use client'
import React from 'react'
import useSWR from 'swr'
import { emptyCatalog, LibraryCatalog, rememberLibraryCatalog } from './libraryCatalog'

export default function useLibraryCatalog() {
  const { data, error } = useSWR<LibraryCatalog>('/api/library-catalog', async url => {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Could not load library catalog')
    const catalog = await response.json() as LibraryCatalog
    rememberLibraryCatalog(catalog)
    return catalog
  }, { fallbackData: emptyCatalog, refreshInterval: 60000 })
  const libraries = data?.libraries ?? emptyCatalog.libraries
  return {
    catalog: data, libraries, error,
    names: libraries.map(l => l.name),
    drugNames: libraries.filter(l => l.category === 'drug').map(l => l.name),
    geneNames: libraries.filter(l => l.category === 'gene').map(l => l.name),
    resourceCount: new Set(libraries.map(l => l.resourceKey)).size,
    libraryCount: libraries.length,
    drugLibraryCount: libraries.filter(l => l.category === 'drug').length,
    geneLibraryCount: libraries.filter(l => l.category === 'gene').length,
  }
}

// null denotes "all", so newly published libraries join the default selection automatically.
export function useLibrarySelection(initial: string[] | null = null): [string[], (names: string[]) => void] {
  const { names } = useLibraryCatalog()
  const [selection, setSelection] = React.useState<string[] | null>(initial)
  return [selection ?? names, selected => setSelection(selected.length === names.length && names.every(n => selected.includes(n)) ? null : selected)]
}
