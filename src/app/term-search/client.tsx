'use client'
import React from 'react'
import { useTermSearchQuery } from '@/graphql'
import TermTable from '@/components/termTable'
import Image from 'next/image'
import useQsState from '@/utils/useQsState'
import Stats from '@/components/stats'
import LibraryFilter from '@/components/libraryFilter'
import DatasetIcons from '@/components/datasetIcons'
import libraryConfig from '@/config/libraries.json'

// Get all library display names for default selection
const allLibraries = Object.values(libraryConfig.libraries).map((l: any) => l.displayName as string)

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
      <div className="text-center p-5">
        <Image className={'rounded mx-auto dark:invert'} src={'/images/loading.gif'} width={250} height={293} alt={'Loading...'} />
        <p>Searching through <Stats show_gene_sets /> with your search term.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        After rummaging through <Stats show_gene_sets />. PerturbSeqr <Image className="inline-block rounded" src="/images/DR_logo.png" width={50} height={50} alt="PerturbSeqr"></Image> found your search term in {data.geneSetTermSearch?.totalCount} gene sets.
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
  // State for selected libraries on landing page - default to all libraries selected
  const [selectedLibraries, setSelectedLibraries] = React.useState<string[]>(allLibraries)
  // Parse libraries from query string (comma-separated)
  const libraryNames = React.useMemo(() =>
    queryString.libraries ? queryString.libraries.split(',').filter(Boolean) : null,
    [queryString.libraries]
  )
  React.useEffect(() => {setRawTerms(queryString.q ?? '')}, [queryString.q])
  if (!queryString.q) {
    // Initial state: Header, DatasetIcons, Input card, Library filter
    return (
      <div className="flex flex-col items-center">
        {/* Header with stats */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">PerturbSeqr</h1>
          <Image
            className="dark:invert"
            src="/images/perturbseqr-logo.png"
            alt="PerturbSeqr logo"
            width={60}
            height={90}
          />
        </div>
        <p className="text-center text-sm mb-4 max-w-2xl">
          Search through 1,912,262 gene sets created from 10 Connectivity Mapping resources that performed massive single perturbations followed by expression experiments in human cells
        </p>
        {/* Dataset icons filter - centered below header */}
        <DatasetIcons
          selectedLibraries={selectedLibraries}
          onSelectionChange={setSelectedLibraries}
        />
        {/* Input and filter sections in horizontal row */}
        <div className="flex flex-row gap-6 items-stretch justify-center">
          {/* Input card */}
          <div className="card w-[480px] shadow-2xl bg-base-100">
            <div className="card-body">
              <h1 className="text-xl">Query extracted gene set table titles to find matching gene sets</h1>
              <form
                className="flex flex-col items-center gap-2"
                onSubmit={evt => {
                  evt.preventDefault()
                  setQueryString({
                    page: '1',
                    q: rawTerms,
                    libraries: selectedLibraries.length > 0 && selectedLibraries.length < allLibraries.length ? selectedLibraries.join(',') : ''
                  })
                }}
              >
                <span className="label-text text-lg">Search Term(s)</span>
                <input
                  type="text"
                  className="input input-bordered w-full"
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
                Try an example:&nbsp;
                {examples.flatMap((example, i) => [
                  i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
                  <a
                    key={example}
                    className="font-bold text-sm cursor-pointer"
                    onClick={() => {setQueryString({
                      page: '1',
                      q: example,
                      libraries: selectedLibraries.length > 0 && selectedLibraries.length < allLibraries.length ? selectedLibraries.join(',') : ''
                    })}}
                  >{example}</a>
                ])}
              </p>
            </div>
          </div>
          {/* Library filter */}
          <div className="w-[400px]">
            <LibraryFilter
              selectedLibraries={selectedLibraries}
              onSelectionChange={setSelectedLibraries}
            />
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
        <div> Query extracted gene set table titles to find matching gene sets.</div>
        {libraryNames && libraryNames.length > 0 && (
          <div className="text-sm text-base-content/70">
            Filtering: {libraryNames.length} dataset{libraryNames.length > 1 ? 's' : ''}
          </div>
        )}
        </form>
        <p className="prose p-2">
          Try an example:&nbsp;
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
