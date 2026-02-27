import React from 'react'
import { useGeneSetGenesByIdQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import TermDownloadButton from '@/components/termDownloadButton';
import { parseTerm, getCellDisplay } from '@/utils/parseTerm';
import { preloadDrugLookup, getDrugInfo, getPerturbationUrl, getPerturbationLinkTitle, isGenePerturbationLibrary, getDatasetUrl } from '@/utils/metadataLookup';
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
  const [drugLookupLoaded, setDrugLookupLoaded] = React.useState(false)

  // Preload drug lookup for libraries in the results
  React.useEffect(() => {
    preloadDrugLookup().then(() => {
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
        <table className="table table-sm">
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
              const parsed = term ? parseTerm(term) : parseTerm('')
              const dataset = libraryName
              const direction = parsed.direction || ''
              const perturbation = parsed.perturbation || parsed.raw || ''
              const cellLine = getCellDisplay(parsed) || 'N/A'
              const timepoint = parsed.timepoint || 'N/A'
              const concentration = parsed.concentration || 'N/A'

              // Check if this is a gene or drug perturbation library
              const isGenePert = isGenePerturbationLibrary(libraryName)

              // Drug lookup for MOA and links (only relevant for drug perturbations)
              // Try perturbation name, then NSN code (for DRUGseqr)
              const drugInfo = !isGenePert && drugLookupLoaded
                ? (getDrugInfo(perturbation) || getDrugInfo(parsed.extras[0] || ''))
                : null
              const perturbationUrl = getPerturbationUrl(perturbation, libraryName)
              const perturbationLinkTitle = getPerturbationLinkTitle(libraryName)

              return (
                  <tr key={el?.term}>
                    {/* Dataset column - shows library/dataset name with link to source */}
                    <td className="font-medium max-w-[120px]">
                      {getDatasetUrl(dataset) ? (
                        <a
                          href={getDatasetUrl(dataset)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-neutral hover:link-hover truncate block"
                          title={`View ${dataset} source`}
                        >
                          {dataset}
                        </a>
                      ) : (
                        <span className="truncate block" title={dataset}>{dataset}</span>
                      )}
                    </td>
                    <td>
                    {term}
                  </td>
                  <td className="max-w-[130px]">
                    {/* Perturbation with appropriate link (PubChem for drugs, NCBI Gene for genes) */}
                    <div>
                      <a
                        href={perturbationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-neutral hover:link-hover truncate block"
                        title={perturbation}
                      >
                        {perturbation}
                      </a>
                      {/* Show CID for drug perturbations */}
                      {!isGenePert && drugInfo?.cid && (
                        <div className="text-xs text-gray-500">
                          <span title="PubChem Compound ID">PCID:</span> {drugInfo.cid}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[150px]">
                    {/* MOA with source attribution (only for drug perturbations) */}
                    {!isGenePert && drugInfo?.moa ? (
                      <div className="text-sm">
                        <span className="line-clamp-2" title={drugInfo.moa}>
                          {drugInfo.moa}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="max-w-[100px]">
                    {cellLine && cellLine !== 'N/A' ? (
                      <a
                        className="link link-neutral hover:link-hover cursor-pointer truncate block"
                        title={cellLine}
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
                      <span className="text-gray-400">{cellLine}</span>
                    )}
                  </td>
                  <td className="max-w-[70px]">
                    {timepoint === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={timepoint}>{timepoint}</span>}
                  </td>
                  <td className="max-w-[80px]">
                    {concentration === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={concentration}>{concentration}</span>}
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