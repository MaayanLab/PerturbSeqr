'use client'

import TermSearch from '@/components/termSearch'
import Stats from '@/components/stats'
import useLibraryCatalog from '@/utils/useLibraryCatalog'

export default function TermSearchClientPage() {
  const { resourceCount, libraryCount, drugLibraryCount, geneLibraryCount } = useLibraryCatalog()
  return <TermSearch title="Query extracted gene set table titles to find matching gene sets" description={<>
    Search through <Stats show_gene_sets bold /> created from <b>{resourceCount}</b> Connectivity Mapping resources organized into <b>{libraryCount}</b> gene set libraries, <b>{drugLibraryCount}</b> drug perturbation and <b>{geneLibraryCount}</b> gene perturbation followed by expression.
  </>} />
}
