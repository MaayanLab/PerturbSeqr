'use client'

import React from 'react'
import Image from 'next/image'
import { useApolloClient } from '@apollo/client'
import { IoMdInformationCircleOutline } from 'react-icons/io'
import { TermSearchDocument, type TermSearchQuery } from '@/graphql'
import TermTable from '@/components/termTable'
import Stats from '@/components/stats'
import ShareButton from '@/components/shareButton'
import LibraryFilter from '@/components/libraryFilter'
import DatasetIcons from '@/components/datasetIcons'
import libraryConfig from '@/config/libraries.json'
import useQsState from '@/utils/useQsState'
import { matchesPerturbation, parseTerm } from '@/utils/parseTerm'
import { pairSignatures, type SignatureSummary } from '@/utils/signaturePairs'
import fetchAllNodes from '@/utils/fetchAllNodes'

export type TermSearchWorkflow = {
  label: string
  description: string
  source: 'drug' | 'gene'
  target: 'drug' | 'gene'
  sourceType?: string
  targetType?: string
}
const libraries = Object.values(libraryConfig.libraries)
const libraryNames = {
  all: libraries.map(library => library.displayName),
  drug: libraries.filter(library => library.category === 'drug').map(library => library.displayName),
  gene: libraries.filter(library => library.category === 'gene').map(library => library.displayName),
}
const examples = { all: ['Dexamethasone', 'STAT3', 'HCC515'], drug: ['Dexamethasone', 'Doxorubicin', 'Metformin'], gene: ['TP53', 'STAT3', 'EGFR'] }
const resetFilters = { page: '1', search: '', dataset: '', cellLine: '', moa: '', timepoint: '', concentration: '', direction: '' }

function selectedSources(source: TermSearchWorkflow['source'] | undefined, selection: string | null) {
  const available = libraryNames[source ?? 'all']
  return selection ? available.filter(name => selection.split(',').includes(name)) : available
}

function TermSearchResults({ query, libraries, workflow }: { query: string; libraries: string[]; workflow?: TermSearchWorkflow }) {
  const client = useApolloClient()
  const [result, setResult] = React.useState<SignatureSummary[] | 'loading' | 'error'>('loading')
  const [retry, setRetry] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    setResult('loading')
    // Load every page before pairing or displaying counts; opposite arms can span pages.
    fetchAllNodes(async offset => {
      const { data } = await client.query<TermSearchQuery>({
        query: TermSearchDocument,
        variables: { terms: [query], libraryNames: libraries, first: 10000, offset },
        fetchPolicy: 'no-cache',
      })
      return data.geneSetTermSearch
    }, () => !cancelled).then(matches => {
      if (!cancelled) setResult(workflow ? matches.filter(signature => {
        const parsed = parseTerm(signature.term)
        return matchesPerturbation(parsed, query) && (!workflow.sourceType || parsed.perturbationType === workflow.sourceType)
      }) : matches)
    }).catch(() => { if (!cancelled) setResult('error') })
    return () => { cancelled = true }
  }, [client, query, libraries, workflow, retry])

  const pairs = React.useMemo(() => workflow && Array.isArray(result) ? pairSignatures(result) : undefined, [result, workflow])
  if (result === 'loading') return (
    <div className="text-center p-5" role="status">
      <Image className="rounded mx-auto dark:invert" src="/images/loading.gif" width={150} height={176} alt="Loading..." />
      <p>Searching through <Stats show_gene_sets /> with your search term.</p>
    </div>
  )
  if (result === 'error') return (
    <div className="text-center p-5" role="alert">
      <p className="text-error">Could not load gene sets. Please try again.</p>
      <button type="button" className="btn btn-sm mt-2" onClick={() => setRetry(value => value + 1)}>Retry</button>
    </div>
  )
  const count = pairs?.length ?? result.length
  const enrichmentParams = workflow ? {
    view: 'table', dir: 'up', sort: 'pvalue_mimic', libraries: libraryNames[workflow.target].join(','),
    // Canonical type boundaries exclude OE, KD, unknown, and mixed-type signatures.
    ...(workflow.targetType ? { q: `::${workflow.targetType}::` } : {}),
  } : undefined
  return (
    <div className="self-stretch min-w-0 -mx-8 md:-mx-24 flex flex-col gap-2 my-2">
      <ul className="menu menu-horizontal gap-3 text-base justify-center py-0"><ShareButton /></ul>
      <h2 className="text-lg font-bold">{workflow
        ? <>Perturb-Seqr found {count.toLocaleString()} complete up/down signature pairs for &quot;{query}&quot; in {workflow.source} perturbation libraries.</>
        : <>After rummaging through <Stats show_gene_sets />. Perturb-Seqr <Image className="inline-block rounded dark:invert" src="/images/perturbseqr-logo.png" width={50} height={50} alt="Perturb-Seqr" /> found your search term in {count.toLocaleString()} gene sets.</>}
      </h2>
      {count > 0 ? <TermTable terms={result} pairs={pairs} enrichmentParams={enrichmentParams} /> : (
        <p className="text-center py-8">{workflow ? 'No complete up/down signature pairs found. Try another perturbation name.' : 'No matching gene sets found. Try another search term.'}</p>
      )}
    </div>
  )
}

/** The shared search form, URL state, source selection, and results for Term Search and Matcher. */
export default function TermSearch({ title, description, workflows }: {
  title: string
  description: React.ReactNode
  workflows?: Record<string, TermSearchWorkflow>
}) {
  const defaultMode = Object.keys(workflows ?? {})[0] ?? ''
  const [queryString, setQueryString] = useQsState({ q: '', mode: defaultMode, libraries: '' })
  const query = queryString.q?.trim() ?? ''
  const queryMode = workflows && Object.hasOwn(workflows, queryString.mode ?? '') ? queryString.mode! : defaultMode
  const queryWorkflow = workflows?.[queryMode]
  const [mode, setMode] = React.useState(queryMode)
  const workflow = workflows?.[mode]
  const available = libraryNames[workflow?.source ?? 'all']
  const [rawTerm, setRawTerm] = React.useState(query)
  const queryLibraries = React.useMemo(() => selectedSources(queryWorkflow?.source, queryString.libraries), [queryWorkflow, queryString.libraries])
  const [selectedLibraries, setSelectedLibraries] = React.useState(queryLibraries)
  React.useEffect(() => { setRawTerm(query); setMode(queryMode) }, [query, queryMode])
  React.useEffect(() => { setSelectedLibraries(queryLibraries) }, [queryLibraries])
  const ready = !workflows || !!workflow
  const hasQuery = !!query && ready && mode === queryMode

  function selectionValue(selection: string[]) {
    return selection.length === available.length ? '' : selection.join(',') || '__none__'
  }
  function search(term: string) {
    if (ready && term.trim() && selectedLibraries.length) {
      setQueryString({ ...resetFilters, q: term.trim(), libraries: selectionValue(selectedLibraries), ...(workflows ? { mode } : {}) })
    }
  }
  function selectWorkflow(value: string) {
    const next = workflows?.[value]
    if (!next) return
    if (query && value === queryMode) {
      setRawTerm(query)
      setSelectedLibraries(queryLibraries)
    } else if (workflow?.source !== next.source) {
      setRawTerm('')
      setSelectedLibraries(libraryNames[next.source])
    }
    setMode(value)
  }
  function selectLibraries(selection: string[]) {
    const selected = available.filter(name => selection.includes(name))
    setSelectedLibraries(selected)
    if (hasQuery) setQueryString({ ...resetFilters, libraries: selectionValue(selected) })
  }
  const datasetFilter = ready && (
    <div className="flex flex-col gap-2">
      {workflows && <>
        <h2 className="text-lg font-semibold">Query datasets</h2>
        <p className="text-sm text-base-content/70">Choose the datasets that supply your query signatures.</p>
      </>}
      <LibraryFilter category={workflow?.source} selectedLibraries={selectedLibraries} onSelectionChange={selectLibraries} />
      {!selectedLibraries.length && <p className="text-sm" role="status">Select at least one query dataset.</p>}
    </div>
  )
  const inputLabel = workflows
    ? workflow?.source === 'gene' ? 'Gene perturbation name' : workflow ? 'Drug name' : 'Perturbation name'
    : hasQuery ? 'Term' : 'Search Term(s)'

  return (
    <div className="flex flex-col items-center">
      {!hasQuery && <>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-4xl font-bold">Perturb-Seqr</h1>
          <Image className="dark:invert" src="/images/perturbseqr-logo.png" alt="Perturb-Seqr logo" width={60} height={90} />
        </div>
        <p className="text-center text-base mb-4 max-w-2xl">{description}</p>
      </>}
      <div className={hasQuery ? 'w-full' : ready ? 'w-full max-w-[904px]' : 'w-full max-w-xl'}>
        {!hasQuery && !workflows && <DatasetIcons selectedLibraries={selectedLibraries} onSelectionChange={selectLibraries} />}
        <div className={!hasQuery && ready ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]' : ''}>
          <div className={hasQuery ? 'w-full' : 'card card-body w-full shadow-2xl bg-base-100'}>
            {(!hasQuery || workflows) && <h1 className="text-xl mb-3">{title}</h1>}
            <form className={`flex gap-4 ${hasQuery ? 'flex-row flex-wrap items-end' : 'flex-col'}`} onSubmit={event => {
              event.preventDefault()
              search(rawTerm)
            }}>
              {hasQuery && <button type="button" className="btn btn-sm btn-outline" onClick={() => setQueryString({ ...resetFilters, q: '' })}>← Back</button>}
              {workflows && <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Matching workflow</legend>
                {Object.entries(workflows).map(([value, option]) => (
                  <div key={value} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="matching-workflow" className="radio radio-sm" required checked={mode === value} onChange={() => selectWorkflow(value)} />
                      {option.label}
                    </label>
                    <span className="tooltip tooltip-bottom before:w-72 before:whitespace-normal" data-tip={option.description} tabIndex={0} aria-label={option.description}>
                      <IoMdInformationCircleOutline aria-hidden="true" />
                    </span>
                  </div>
                ))}
              </fieldset>}
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                <label htmlFor="term-search-input" className="label-text text-lg">{inputLabel}</label>
                <input id="term-search-input" type="text" className="input input-bordered w-full" required disabled={!ready}
                  placeholder={!ready ? 'Choose an option above' : examples[workflow?.source ?? 'all'][0]}
                  value={rawTerm} onChange={event => setRawTerm(event.currentTarget.value)} />
              </div>
              <button type="submit" className="btn normal-case" disabled={!ready || !rawTerm.trim() || !selectedLibraries.length}>
                {workflows ? 'Search signatures' : 'Search gene sets'}
              </button>
            </form>
            {ready && <p className="prose mt-3">
              Try an example:{' '}
              {examples[workflow?.source ?? 'all'].map((example, index) => <React.Fragment key={example}>
                {index > 0 && ', '}
                <button type="button" className="font-bold text-sm underline disabled:opacity-50" disabled={!selectedLibraries.length} onClick={() => search(example)}>{example}</button>
              </React.Fragment>)}
            </p>}
            {hasQuery && <details className="mt-3">
              <summary className="btn btn-sm normal-case">Query datasets ({selectedLibraries.length}/{available.length}) ▾</summary>
              <div className="mt-3 max-w-md">{datasetFilter}</div>
            </details>}
          </div>
          {!hasQuery && datasetFilter}
        </div>
      </div>
      {hasQuery && (queryLibraries.length > 0
        ? <TermSearchResults key={`${mode}:${query}:${queryString.libraries}`} query={query} libraries={queryLibraries} workflow={workflow} />
        : <p className="text-center py-8">Select at least one query dataset to find {workflows ? 'signature pairs' : 'gene sets'}.</p>)}
    </div>
  )
}
