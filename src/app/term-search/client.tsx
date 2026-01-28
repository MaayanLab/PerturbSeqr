'use client'
import React from 'react'
import { useTermSearchQuery } from '@/graphql'
import TermTable from '@/components/termTable'
import Image from 'next/image'
import useQsState from '@/utils/useQsState'
import Stats from '@/components/stats'
import LibraryFilter from '@/components/libraryFilter'
import DatasetIcons from '@/components/datasetIcons'

/**
 * TermSearchResults component - Displays search results
 * Input props:
 *   - terms: Search term string entered by user
 *   - libraryNames: Optional array of library names to filter by
 * Output: Renders loading state, result count, and TermTable with matching gene sets
 */
export function TermSearchResults({ terms, libraryNames }: { terms: string, libraryNames: string[] | null }) {
  const { data } = useTermSearchQuery({
    variables: {
      terms,
      first: 10000,
      libraryNames: libraryNames && libraryNames.length > 0 ? libraryNames : null
    }
  })
  if (!data) {
    return (
      <>
        <Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'} />
        <p>Searching through <Stats show_gene_sets /> with your search term.</p>
      </>
    )
  }
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        After rummaging through <Stats show_gene_sets />. PerturbSeek <Image className="inline-block rounded" src="/images/DR_logo.png" width={50} height={50} alt="PerturbSeek"></Image> found your search term in {data.geneSetTermSearch?.totalCount} gene sets.
      </h2>
      {data.geneSetTermSearch?.nodes && data.geneSetTermSearch?.nodes.length > 0 ? <TermTable terms={data.geneSetTermSearch?.nodes}></TermTable> : null}
    </div>
  )
}

const examples = [
  'Dexamethasone',
  'STAT3',
  'HCC515',
]

/**
 * TermSearchClientPage - Main term search page component
 * Input props:
 *   - searchParams: Optional URL query params (page, q for search query)
 * Output: Renders search form and search results
 * State:
 *   - queryString: URL query state (page, q)
 *   - rawTerms: Current input field value
 */
export default function TermSearchClientPage(props: { searchParams?: { page?: string, q?: string, libraries?: string } }) {
  const [queryString, setQueryString] = useQsState({
    page: props.searchParams?.page ?? '1',
    q: props.searchParams?.q ?? '',
    libraries: props.searchParams?.libraries ?? ''
  })
  const [rawTerms, setRawTerms] = React.useState('')
  // State for selected libraries on landing page - empty array means all libraries (no filter)
  const [selectedLibraries, setSelectedLibraries] = React.useState<string[]>([])
  // Parse libraries from query string (comma-separated)
  const libraryNames = React.useMemo(() =>
    queryString.libraries ? queryString.libraries.split(',').filter(Boolean) : null,
    [queryString.libraries]
  )
  React.useEffect(() => {setRawTerms(queryString.q ?? '')}, [queryString.q])
  if (!queryString.q) {
    // Initial state: Input card, Library filter, Dataset icons, Info section
    return (
      <div className="flex justify-center">
        <div className="flex flex-row gap-4 items-start">
          {/* Input card */}
          <div className="card max-w-xs shadow-2xl bg-base-100 flex-shrink-0">
            <div className="card-body">
              <h1 className="text-xl">Query extracted gene set table titles to find relevant gene sets</h1>
              <form
                className="flex flex-col items-center gap-2"
                onSubmit={evt => {
                  evt.preventDefault()
                  setQueryString({
                    page: '1',
                    q: rawTerms,
                    libraries: selectedLibraries.length > 0 ? selectedLibraries.join(',') : ''
                  })
                }}
              >
                <span className="label-text text-lg">Search Term(s)</span>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="U2OS"
                  value={rawTerms}
                  onChange={evt => {
                    setRawTerms(evt.currentTarget.value)
                  }}
                />
                <button
                  type="submit"
                  className="btn normal-case"
                >Search gene sets</button>
              </form>
              <p className="prose">
                try an example:&nbsp;
                {examples.flatMap((example, i) => [
                  i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
                  <a
                    key={example}
                    className="font-bold text-sm cursor-pointer"
                    onClick={() => {setQueryString({
                      page: '1',
                      q: example,
                      libraries: selectedLibraries.length > 0 ? selectedLibraries.join(',') : ''
                    })}}
                  >{example}</a>
                ])}
              </p>
            </div>
          </div>
          {/* Library filter */}
          <LibraryFilter
            selectedLibraries={selectedLibraries}
            onSelectionChange={setSelectedLibraries}
          />
          {/* Dataset icons */}
          <DatasetIcons />
          {/* Info section */}
          <div className="text-center p-10">
            <h3 className="text-xl font-bold p-2 pt-0">
              Signatures Search
            </h3>
            <div className='inline-flex'>
              <Image className={'rounded'} src={'/images/DR.gif'} width={225} height={225} alt={'PerturbSeek'} unoptimized></Image>
            </div>
            <React.Suspense fallback={<div className="text-center p-5"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'}/> </div>}>
            <h1 className="text-2xl font-bold">
              <span className="whitespace-nowrap"> Search through <Stats bold show_gene_sets /></span>
            </h1>
            <div className="mt-3">
              <p className="font-semibold">Datasets:</p>
              <p className="text-sm max-w-xs">L1000-Sigs, Tahoe-100M, L1000-CP, DRUGseqr, PerturbAtlas, CMAP, PerturbAtlas-Mouse, L1000-CRISPR, Ginkgo, SciPlex, Replogle-K562, DeepCoverMOA, GEO-Gene, GEO-Chem</p>
            </div>
            </React.Suspense>
          </div>
        </div>
      </div>
    )
  } else {
    // Results state: simple inline form, table takes center stage (matches L2S2)
    return (
      <>
      <div className='flex-col'>
        <form
          className="flex flex-row items-center gap-4"
          onSubmit={evt => {
            evt.preventDefault()
            setQueryString({ page: '1', q: rawTerms, libraries: queryString.libraries })
          }}
        >
          <span className="label-text text-lg">Term</span>
          <input
            type="text"
            className="input input-bordered"
            placeholder="neuron"
            value={rawTerms}
            onChange={evt => {
              setRawTerms(evt.currentTarget.value)
            }}
          />
          <button
            type="submit"
            className="btn normal-case"
          >Search gene sets</button>
        <div> Query extracted gene set table titles to find relevant gene sets.</div>
        {libraryNames && libraryNames.length > 0 && (
          <div className="text-sm text-base-content/70">
            Filtering: {libraryNames.length} dataset{libraryNames.length > 1 ? 's' : ''}
          </div>
        )}
        </form>
        <p className="prose p-2">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setQueryString({ page: '1', q: example, libraries: queryString.libraries })}}
            >{example}</a>
          ])}
        </p>
        </div>
        {queryString.q ? <TermSearchResults terms={queryString.q} libraryNames={libraryNames} /> : null}
      </>
    )
  }
}
