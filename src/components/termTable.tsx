import React from 'react'
import { useGeneSetGenesByIdQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import TermDownloadButton from '@/components/termDownloadButton';
import { parseTerm } from '@/utils/parseTerm';
import { preloadMetadata, enrichWithMetadataSync, preloadDrugLookup, getDrugInfo, getPerturbationUrl, getPerturbationLinkTitle, getDrugMoaSource, isGenePerturbationLibrary } from '@/utils/metadataLookup';
import Image from 'next/image';


const pageSize = 10

export default function TermTable({ terms }: { terms: { __typename?: "GeneSet" | undefined; term?: string | null | undefined; id?: any; nGeneIds?: number | null | undefined; library?: { name?: string | null } | null }[] }) {
  const [queryString, setQueryString] = useQsState({ page: '1', f: '' })
  const { page, searchTerm, tableSearch } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.q ?? '', tableSearch: queryString.f || '' }), [queryString])

  const dataFiltered = React.useMemo(() =>
    terms.filter(el => {
      return (el?.term?.toLowerCase().includes(tableSearch.toLowerCase()))
    }),
  [terms, tableSearch])

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [currDataset, setCurrDataset] = React.useState(terms[0].library?.name || '')
  const [showModal, setShowModal] = React.useState(false)
  const [metadataLoaded, setMetadataLoaded] = React.useState(false)

  const [drugLookupLoaded, setDrugLookupLoaded] = React.useState(false)

  // Preload metadata and drug lookup for libraries in the results
  React.useEffect(() => {
    const libraryNames = Array.from(new Set(terms.map(t => t.library?.name).filter(Boolean))) as string[]
    Promise.all([
      preloadMetadata(libraryNames),
      preloadDrugLookup()
    ]).then(() => {
      setMetadataLoaded(true)
      setDrugLookupLoaded(true)
    })
  }, [terms])

  const genesQuery = useGeneSetGenesByIdQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.geneSet?.genes.nodes} term={currTerm} dataset={currDataset} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <div className='border m-5 mt-1'>

      <div className='join flex flex-row place-content-end items-center pt-3 pr-3'>
          <span className="label-text text-base">Search:&nbsp;</span>
          <input
            type="text"
            className="input input-bordered"
            value={tableSearch}
            onChange={evt => {
              setQueryString({ page: '1', f: evt.currentTarget.value, q: queryString.q })
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
                setQueryString({ page: '1', f: '' })
              }}
            >&#x232B;</button>
          </div>
          <div className="tooltip" data-tip="Download results">
            <TermDownloadButton dataFiltered={dataFiltered} filterTerm={searchTerm || ""} />
          </div>
        </div>
        <table className="table table-xs">
          <thead>
            <tr>
              {/* Dataset column - extracted from term prefix before colon */}
              <th>Dataset</th>
              <th>Term</th>
              <th>Perturbation</th>
              <th>MOA</th>
              <th>Cell Line</th>
              <th>Timepoint</th>
              <th>Concentration</th>
              <th>Direction</th>
              <th>Gene Set Size</th>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.slice((page-1) * pageSize, page * pageSize).map(el => {
              if (!el) return null
              const term = el.term
              const libraryName = el.library?.name || ''
              // Parse term using the parseTerm utility
              const baseParsed = term ? parseTerm(term, libraryName) : {}
              // Enrich with external metadata (e.g., RummaGEO cell line/timepoint)
              const parsed = metadataLoaded ? enrichWithMetadataSync(baseParsed, libraryName) : baseParsed
              const dataset = libraryName || parsed.library || ''
              const direction = parsed.direction || ''
              const perturbation = parsed.perturbation || parsed.raw || ''
              const cellLine = parsed.cellLine || ''
              const timepoint = parsed.timepoint || ''
              const concentration = parsed.concentration || ''

              // Check if this is a gene or drug perturbation library
              const isGenePert = isGenePerturbationLibrary(libraryName)

              // Drug lookup for MOA and links (only relevant for drug perturbations)
              // Try perturbation name, then NSN code (for DRUGseqr)
              const drugInfo = !isGenePert && drugLookupLoaded
                ? (getDrugInfo(perturbation) || getDrugInfo(parsed.nsn || ''))
                : null
              const perturbationUrl = getPerturbationUrl(perturbation, libraryName)
              const perturbationLinkTitle = getPerturbationLinkTitle(libraryName)
              const moaSource = drugInfo?.moa ? getDrugMoaSource(perturbation) || getDrugMoaSource(parsed.nsn || '') : null

              return (
                  <tr key={el?.term}>
                    {/* Dataset column - shows library/dataset name */}
                    <td className="font-medium">
                      {dataset}
                    </td>
                    <td>
                    {term}
                  </td>
                  <td>
                    {/* Perturbation with appropriate link (PubChem for drugs, NCBI Gene for genes) */}
                    <div>
                      <a
                        href={perturbationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary hover:link-hover"
                        title={perturbationLinkTitle}
                      >
                        {perturbation}
                      </a>
                      {/* Show CID for drug perturbations */}
                      {!isGenePert && drugInfo?.cid && (
                        <div className="text-xs text-gray-500">
                          PubChem CID: {drugInfo.cid}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[200px]">
                    {/* MOA with source attribution (only for drug perturbations) */}
                    {!isGenePert && drugInfo?.moa ? (
                      <div className="text-sm">
                        <span className="line-clamp-2" title={drugInfo.moa}>
                          {drugInfo.moa}
                        </span>
                        {moaSource && (
                          <a
                            href={moaSource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-gray-700 block mt-0.5"
                          >
                            Source: {moaSource.name}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td>
                    {cellLine ? (
                      <a
                        className="link link-primary hover:link-hover cursor-pointer"
                        title="View on DepMap"
                        onClick={async (evt) => {
                          evt.preventDefault();
                          const res = await fetch("/enrich/depmapcl", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cellLine }),
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
                        {cellLine}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {timepoint}
                  </td>
                  <td>
                    {concentration}
                  </td>
                  <td>
                    {direction === "up" ? (
                      <Image
                        className="inline-block rounded"
                        src="/images/up.png"
                        width={15}
                        height={15}
                        alt="Up"
                      />
                    ) : direction === "down" || direction === "dn" ? (
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
                      data-te-toggle="modal"
                      data-te-target="#geneSetModal"
                      data-te-ripple-init
                      data-te-ripple-color="light"
                      onClick={evt => {
                        setCurrTerm(el?.term || '')
                        setGeneSetId(el?.id || '')
                        setCurrDataset(el?.library?.name || '')
                        setShowModal(true)
                      }}
                    ><p>View Gene Set ({el?.nGeneIds})</p>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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