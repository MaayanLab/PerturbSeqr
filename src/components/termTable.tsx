import React from 'react'
import { useGeneSetGenesByIdQuery, useGeneSetDetailsByTermQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import TermDownloadButton from '@/components/termDownloadButton';
import { parseTerm, getCellDisplay, formatPerturbationWithType } from '@/utils/parseTerm';
import { preloadDrugLookup, getDrugInfo, getPerturbationUrl, getPerturbationLinkTitle, isGenePerturbationLibrary } from '@/utils/metadataLookup';
import { DatasetCell } from '@/components/DatasetCell';
import SingleGenePerturbationResourceLinks from '@/components/SingleGenePerturbationResourceLinks';
import Image from 'next/image';
import { FaFilter } from 'react-icons/fa';
import libraryConfig from '@/config/libraries.json';
import type { SignaturePair, SignatureSummary } from '@/utils/signaturePairs';
import { PerturbseqrPairedGeneSetSubmissionButton } from '@/components/perturbseqrGeneSetSubmissionButtons';

const pageSize = 10
const drugLibraryNames = Object.values(libraryConfig.libraries).filter((l: any) => l.category === 'drug').map((l: any) => l.displayName as string)
const geneLibraryNames = Object.values(libraryConfig.libraries).filter((l: any) => l.category === 'gene').map((l: any) => l.displayName as string)
const FILTER_SEP = '|'

function parseFilter(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(FILTER_SEP)
}

function FilterDropdown({ label, allValues, filterValues, queryKey, setQs, hasSearch = true }: {
  label: string
  allValues: string[]
  filterValues: string[]
  queryKey: string
  setQs: (updates: Record<string, string>) => void
  hasSearch?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayed = hasSearch && search
    ? allValues.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : allValues

  return (
    <div className="relative" ref={ref}>
      <button
        className={filterValues.length > 0 ? "btn btn-sm bg-gray-400 hover:bg-gray-500 text-gray-800" : "btn btn-sm"}
        onClick={() => setOpen(!open)}
      >
        {label} {filterValues.length > 0 && !filterValues.includes("__none__") ? `(${filterValues.length}/${allValues.length})` : `(${allValues.length})`}
        <FaFilter className={`text-xs ${filterValues.length > 0 ? "" : "opacity-40"}`} />
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-1 bg-base-100 border border-base-300 rounded shadow-lg p-2 min-w-[220px]">
          {hasSearch && (
            <input
              type="text"
              className="input input-bordered input-xs w-full mb-1"
              placeholder={`Search ${label.toLowerCase()}\u2026`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          )}
          <div className="flex gap-1 mb-1">
            <button className="btn btn-xs" onClick={() => setQs({ [queryKey]: "", page: "1" })}>All</button>
            <button className="btn btn-xs" onClick={() => setQs({ [queryKey]: "__none__", page: "1" })}>None</button>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {displayed.map(val => (
              <label key={val} className="flex items-center gap-1 cursor-pointer py-0.5 text-xs">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={filterValues.length === 0 ? true : filterValues.includes(val)}
                  onChange={(e) => {
                    let next: string[]
                    if (filterValues.length === 0) {
                      next = allValues.filter(l => l !== val)
                    } else if (e.target.checked) {
                      next = filterValues.filter(l => l !== "__none__").concat(val)
                    } else {
                      next = filterValues.filter(l => l !== val)
                    }
                    if (next.length >= allValues.length) {
                      setQs({ [queryKey]: "", page: "1" })
                    } else if (next.length === 0) {
                      setQs({ [queryKey]: "__none__", page: "1" })
                    } else {
                      setQs({ [queryKey]: next.join(FILTER_SEP), page: "1" })
                    }
                  }}
                />
                {val}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TermTable({ terms, pairs, enrichmentParams }: { terms: SignatureSummary[]; pairs?: SignaturePair[]; enrichmentParams?: Record<string, string> }) {
  const paired = !!pairs
  const [queryString, setQueryString] = useQsState({ page: '1', search: '', dataset: '', cellLine: '', moa: '', timepoint: '', concentration: '', direction: '' })
  const { page, searchTerm, tableSearch } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.q ?? '', tableSearch: queryString.search || '' }), [queryString])

  const datasetFilter = React.useMemo(() => parseFilter(queryString.dataset), [queryString.dataset])
  const cellLineFilter = React.useMemo(() => parseFilter(queryString.cellLine), [queryString.cellLine])
  const moaFilter = React.useMemo(() => parseFilter(queryString.moa), [queryString.moa])
  const timepointFilter = React.useMemo(() => parseFilter(queryString.timepoint), [queryString.timepoint])
  const concentrationFilter = React.useMemo(() => parseFilter(queryString.concentration), [queryString.concentration])
  const dirFilter = queryString.direction || ''

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [currDataset, setCurrDataset] = React.useState(terms[0].library?.name || '')
  const [showModal, setShowModal] = React.useState(false)
  const [drugLookupLoaded, setDrugLookupLoaded] = React.useState(false)

  React.useEffect(() => {
    preloadDrugLookup().then(() => setDrugLookupLoaded(true))
  }, [terms])

  const tableTerms = React.useMemo(() => pairs
    ? pairs.map(pair => ({ ...pair.up, term: pair.term, _pair: pair }))
    : terms.map(term => ({ ...term, _pair: undefined })), [terms, pairs])

  // Precompute parsed data for all terms (avoids re-parsing in table body)
  const parsedTerms = React.useMemo(() => {
    return tableTerms.map(el => {
      const term = el.term || ''
      const libraryName = el.library?.name || ''
      const parsed = parseTerm(term)
      const isGenePert = isGenePerturbationLibrary(libraryName)
      const perturbation = parsed.perturbation || parsed.raw || ''
      const drugInfo = !isGenePert && drugLookupLoaded
        ? (getDrugInfo(perturbation) || getDrugInfo(parsed.extras[0] || ''))
        : null
      const dir = parsed.direction || ''
      const dirDisplay = dir === 'up' ? 'Up' : (dir === 'down' || dir === 'dn') ? 'Down' : 'N/A'
      return {
        ...el,
        _dataset: libraryName,
        _cellLine: getCellDisplay(parsed) || 'N/A',
        _timepoint: parsed.timepoint || 'N/A',
        _concentration: parsed.concentration || 'N/A',
        _direction: dir,
        _dirDisplay: dirDisplay,
        _moa: (!isGenePert && drugInfo?.moa) ? drugInfo.moa : 'N/A',
        _perturbation: perturbation,
        // Display string with perturbation type appended for gene libraries (e.g. "PRSS36 KO");
        // _perturbation stays raw for the NCBI/PubChem URL and drug lookups.
        _perturbationDisplay: formatPerturbationWithType(perturbation, parsed.perturbationType, isGenePert),
        _isGenePert: isGenePert,
        _drugInfo: drugInfo,
        _parsed: parsed,
        _perturbationUrl: getPerturbationUrl(perturbation, libraryName),
        _perturbationLinkTitle: getPerturbationLinkTitle(libraryName),
      }
    })
  }, [tableTerms, drugLookupLoaded])

  // Extract unique sorted values for each filter dimension
  const allDatasets = React.useMemo(() => Array.from(new Set(parsedTerms.map(t => t._dataset))).sort((a, b) => a.localeCompare(b)), [parsedTerms])
  const allCellLines = React.useMemo(() => Array.from(new Set(parsedTerms.map(t => t._cellLine))).sort((a, b) => a.localeCompare(b)), [parsedTerms])
  const allMoas = React.useMemo(() => Array.from(new Set(parsedTerms.map(t => t._moa))).sort((a, b) => a.localeCompare(b)), [parsedTerms])
  const allTimepoints = React.useMemo(() => Array.from(new Set(parsedTerms.map(t => t._timepoint))).sort((a, b) => a.localeCompare(b)), [parsedTerms])
  const allConcentrations = React.useMemo(() => Array.from(new Set(parsedTerms.map(t => t._concentration))).sort((a, b) => a.localeCompare(b)), [parsedTerms])

  // Apply all filters
  const dataFiltered = React.useMemo(() =>
    parsedTerms.filter(el => {
      if (!el.term?.toLowerCase().includes(tableSearch.toLowerCase())) return false
      if (datasetFilter.length > 0) { if (datasetFilter.includes('__none__')) return false; if (!datasetFilter.includes(el._dataset)) return false }
      if (cellLineFilter.length > 0) { if (cellLineFilter.includes('__none__')) return false; if (!cellLineFilter.includes(el._cellLine)) return false }
      if (moaFilter.length > 0) { if (moaFilter.includes('__none__')) return false; if (!moaFilter.includes(el._moa)) return false }
      if (timepointFilter.length > 0) { if (timepointFilter.includes('__none__')) return false; if (!timepointFilter.includes(el._timepoint)) return false }
      if (concentrationFilter.length > 0) { if (concentrationFilter.includes('__none__')) return false; if (!concentrationFilter.includes(el._concentration)) return false }
      if (!paired && dirFilter === 'up' && el._dirDisplay !== 'Up') return false
      if (!paired && dirFilter === 'down' && el._dirDisplay !== 'Down') return false
      return true
    }),
  [parsedTerms, tableSearch, datasetFilter, cellLineFilter, moaFilter, timepointFilter, concentrationFilter, dirFilter, paired])

  const genesQuery = useGeneSetGenesByIdQuery({
    skip: paired,
    variables: { id: geneSetId }
  })

  // Opposite-direction pair of the viewed term, fetched for the modal's PAIRED tab.
  const pairedTerm = React.useMemo(() => {
    const t = currTerm || ''
    if (t.endsWith(' up')) return `${t.slice(0, -3)} down`
    if (t.endsWith(' down')) return `${t.slice(0, -5)} up`
    if (t.endsWith(' dn')) return `${t.slice(0, -3)} up`
    return ''
  }, [currTerm])
  const pairQuery = useGeneSetDetailsByTermQuery({
    skip: paired || !showModal || !pairedTerm,
    variables: { term: pairedTerm },
  })
  const viewedGenes = genesQuery?.data?.geneSet?.genes.nodes
  const pairGenes = pairQuery?.data?.geneSetByTerm?.genes.nodes

  const anyFilterActive = datasetFilter.length > 0 || cellLineFilter.length > 0 || moaFilter.length > 0 || timepointFilter.length > 0 || concentrationFilter.length > 0 || (!paired && !!dirFilter)

  return (
    <>
      {!paired && <GeneSetModal tabbed geneset={viewedGenes} geneset2={pairGenes ?? []} term={currTerm} dataset={currDataset} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>}
      {/* Filter bar — above the table, matching enrich page layout */}
      <div className="flex flex-col gap-2 mx-5">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <FilterDropdown label="Dataset" allValues={allDatasets} filterValues={datasetFilter} queryKey="dataset" setQs={setQueryString} />
          {!paired && <>
          <div
            id="ptype-select"
            className="join place-content-start place-items-center"
          >
            <div
              className={
                datasetFilter.length > 0 && drugLibraryNames.every(n => datasetFilter.includes(n)) && !geneLibraryNames.some(n => datasetFilter.includes(n))
                  ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                  : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
              }
              onClick={() => {
                const isDrugActive = datasetFilter.length > 0 && drugLibraryNames.every(n => datasetFilter.includes(n)) && !geneLibraryNames.some(n => datasetFilter.includes(n))
                if (isDrugActive) {
                  setQueryString({ dataset: "", page: "1" })
                } else {
                  setQueryString({ dataset: drugLibraryNames.join(FILTER_SEP), page: "1" })
                }
              }}
            >
              DRUG
            </div>
            <div
              className={
                datasetFilter.length > 0 && geneLibraryNames.every(n => datasetFilter.includes(n)) && !drugLibraryNames.some(n => datasetFilter.includes(n))
                  ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                  : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
              }
              onClick={() => {
                const isGeneActive = datasetFilter.length > 0 && geneLibraryNames.every(n => datasetFilter.includes(n)) && !drugLibraryNames.some(n => datasetFilter.includes(n))
                if (isGeneActive) {
                  setQueryString({ dataset: "", page: "1" })
                } else {
                  setQueryString({ dataset: geneLibraryNames.join(FILTER_SEP), page: "1" })
                }
              }}
            >
              GENE
            </div>
          </div>
          <div
            id="dir-select"
            className="join place-content-start place-items-center"
          >
            <div
              className={
                dirFilter === "up"
                  ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                  : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
              }
              onClick={() => setQueryString({ direction: dirFilter === "up" ? "" : "up", page: "1" })}
            >
              UP
            </div>
            <div
              className={
                dirFilter === "down"
                  ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                  : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
              }
              onClick={() => setQueryString({ direction: dirFilter === "down" ? "" : "down", page: "1" })}
            >
              DOWN
            </div>
          </div>
          </>}
          <FilterDropdown label="Cell Line" allValues={allCellLines} filterValues={cellLineFilter} queryKey="cellLine" setQs={setQueryString} />
          <FilterDropdown label="MOA" allValues={allMoas} filterValues={moaFilter} queryKey="moa" setQs={setQueryString} />
          <FilterDropdown label="Timepoint" allValues={allTimepoints} filterValues={timepointFilter} queryKey="timepoint" setQs={setQueryString} />
          <FilterDropdown label="Concentration" allValues={allConcentrations} filterValues={concentrationFilter} queryKey="concentration" setQs={setQueryString} />
        </div>
        {anyFilterActive && (
          <p className="text-sm text-base-content/70">
            Showing {Intl.NumberFormat("en-US", {}).format(dataFiltered.length)} of {Intl.NumberFormat("en-US", {}).format(parsedTerms.length)} results.
          </p>
        )}
      </div>
      <div className='border min-w-0 m-5 mt-1'>
      <div className='flex flex-row flex-wrap place-content-end items-center pt-3 pr-3 gap-2'>
          <div className='join flex flex-row items-center'>
            <span className="label-text text-base">Search:&nbsp;</span>
            <input
              type="text"
              className="input input-bordered"
              value={tableSearch}
              onChange={evt => {
                setQueryString({ page: '1', search: evt.currentTarget.value, q: queryString.q })
              }}
            />
            <div className="tooltip" data-tip="Search results">
              <button
                type="submit"
                className="btn join-item"
              >&#x1F50D;</button>
            </div>
            <div className="tooltip" data-tip="Clear search">
              <button
                type="reset"
                className="btn join-item"
                onClick={evt => {
                  setQueryString({ page: '1', search: '' })
                }}
              >&#x232B;</button>
            </div>
            {!paired && <div className="tooltip" data-tip="Download results">
              <TermDownloadButton dataFiltered={dataFiltered} filterTerm={searchTerm || ""} />
            </div>}
          </div>
        </div>
        <div className='overflow-x-auto'>
        <table className="table table-sm [&_th]:px-2 [&_td]:px-2">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Term</th>
              <th>Perturbation</th>
              <th>MOA</th>
              <th>Cell Line</th>
              <th>Timepoint</th>
              <th>Concentration</th>
              {paired ? <>
                <th>Up Genes</th>
                <th>Down Genes</th>
                <th className="sticky right-0 z-10 min-w-[110px] bg-gray-100 dark:bg-gray-900">Submit</th>
              </> : <>
                <th>Direction</th>
                <th>Gene Set Size</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {paired && dataFiltered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-6">No signature pairs match these filters.</td></tr>
            )}
            {dataFiltered?.slice((page-1) * pageSize, page * pageSize).map(el => {
              if (!el) return null
              const typeSuffix = el._isGenePert && !el._perturbation.includes('|') ? el._perturbationDisplay.slice(el._perturbation.length) : '';
              return (
                  <tr key={el.id}>
                    <DatasetCell dataset={el._dataset} term={el.term} className="font-medium max-w-[120px]" />
                    <td className={paired ? 'min-w-[240px] max-w-[260px] [overflow-wrap:anywhere]' : undefined}>
                    {el.term}
                  </td>
                  <td className={el._isGenePert ? 'w-[17.5rem] min-w-[16.25rem] max-w-[17.5rem]' : 'max-w-[130px]'}>
                    <div className={el._isGenePert ? 'flex items-center gap-2' : undefined}>
                      <a
                        href={el._perturbationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-neutral hover:link-hover flex min-w-0"
                        title={el._perturbationDisplay}
                      >
                        <span className="truncate">{typeSuffix ? el._perturbation : el._perturbationDisplay}</span>
                        <span className="shrink-0 whitespace-pre">{typeSuffix}</span>
                      </a>
                      {el._isGenePert && <SingleGenePerturbationResourceLinks perturbation={el._perturbation} />}
                      {!el._isGenePert && el._drugInfo?.cid && (
                        <div className="text-xs text-gray-500">
                          <span title="PubChem Compound ID">PCID:</span> {el._drugInfo.cid}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[150px]">
                    {!el._isGenePert && el._drugInfo?.moa ? (
                      <div className="text-sm">
                        <span className="line-clamp-2" title={el._drugInfo.moa}>
                          {el._drugInfo.moa}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="max-w-[100px]">
                    {el._cellLine && el._cellLine !== 'N/A' ? (
                      <a
                        className="link link-neutral hover:link-hover cursor-pointer truncate block"
                        title={el._cellLine}
                        onClick={async (evt) => {
                          evt.preventDefault();
                          const res = await fetch("/enrich/depmapcl", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cellLine: el._cellLine }),
                          });
                          const resJson = await res.json();
                          const suggestedCellLines = resJson.filter(
                            (entry: any) => entry.type === "cell_line"
                          );
                          if (suggestedCellLines.length > 0) {
                            window.open(
                              `https://depmap.org${suggestedCellLines[0].url}`,
                              "_blank"
                            );
                          }
                        }}
                      >
                        {el._cellLine}
                      </a>
                    ) : (
                      <span className="text-gray-400">{el._cellLine}</span>
                    )}
                  </td>
                  <td className="max-w-[70px]">
                    {el._timepoint === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={el._timepoint}>{el._timepoint}</span>}
                  </td>
                  <td className="max-w-[80px]">
                    {el._concentration === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={el._concentration}>{el._concentration}</span>}
                  </td>
                  {paired && el._pair ? <>
                    <td>{el._pair.up.nGeneIds}</td>
                    <td>{el._pair.down.nGeneIds}</td>
                    <td className="sticky right-0 z-10 min-w-[110px] bg-gray-100 dark:bg-gray-900">
                      <PerturbseqrPairedGeneSetSubmissionButton
                        referencePair={{ upId: el._pair.up.id, downId: el._pair.down.id }}
                        descriptionUp={`${el._pair.term} up`}
                        descriptionDown={`${el._pair.term} down`}
                        enrichmentParams={enrichmentParams}
                        label="Submit"
                      />
                    </td>
                  </> : <>
                  <td>
                    {el._direction === "up" ? (
                      <Image
                        className="inline-block rounded"
                        src="/images/up.png"
                        width={15}
                        height={15}
                        alt="Up"
                      />
                    ) : el._direction === "down" || el._direction === "dn" ? (
                      <Image
                        className="inline-block rounded"
                        src="/images/down.png"
                        width={15}
                        height={15}
                        alt="Down"
                      />
                    ) : (
                      <Image
                        className="inline-block rounded"
                        src="/images/minus.png"
                        width={15}
                        height={15}
                        alt="Unknown"
                      />
                    )}
                  </td>

                  <td className='w-3/12'>
                    <button
                      className='btn btn-xs btn-outline p-2 h-auto'
                      onClick={evt => {
                        setCurrTerm(el?.term || '')
                        setGeneSetId(el?.id || '')
                        setCurrDataset(el?.library?.name || '')
                        setShowModal(true)
                      }}
                    ><p>View Gene Set ({el?.nGeneIds})</p>
                    </button>
                  </td>
                  </>}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={dataFiltered?.length}
          onChange={newPage => {setQueryString({ page: `${newPage}` })}}
        />
      </div>
    </>
  )
}
