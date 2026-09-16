'use client';

import React from 'react';
import Image from 'next/image';
import Loading from '@/components/loading';
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { SortableHeader } from '@/components/SortableHeader';
import { parseTerm, getCellDisplay, formatPerturbationWithType } from '@/utils/parseTerm';
import {
  getDrugInfo,
  getPerturbationUrl,
  isGenePerturbationLibrary,
} from '@/utils/metadataLookup';
import { DatasetCell } from '@/components/DatasetCell';
import LibraryCount from '@/components/LibraryCount';
import SingleGenePerturbationResourceLinks from '@/components/SingleGenePerturbationResourceLinks';

export type GeneSetModalT =
  | { type: 'UserGeneSet'; description: string; genes: string[] }
  | { type: 'GeneSetOverlap'; id: string; description: string; genes: string[]; library?: string }
  | { type: 'GeneSet'; id: string; description: string; library?: string }
  | undefined;

type EnrichNode = {
  geneSetId?: string | null;
  geneSetHash?: string | null;
  libraryCount?: number | null;
  supportingLibraries?: ReadonlyArray<string | null> | null;
  pvalue?: number | null;
  adjPvalue?: number | null;
  oddsRatio?: number | null;
  nOverlap?: number | null;
  geneSets?: {
    nodes: ReadonlyArray<{
      id?: any;
      term?: string | null;
      description?: string | null;
      nGeneIds?: number | null;
      library?: { name?: string | null } | null;
      geneSetFdaCountsById?: {
        nodes: ReadonlyArray<{
          approved?: boolean | null;
          count?: number | null;
          totalCount?: number | null;
          moa?: string | null;
        } | null>;
      } | null;
    } | null>;
  } | null;
} | null;

export function EnrichmentTable({
  nodes,
  loading,
  userGeneSetDescription,
  genes,
  setModalGeneSet,
  setQueryString,
  queryString,
  drugLookupLoaded,
}: {
  nodes: ReadonlyArray<EnrichNode> | undefined;
  loading: boolean;
  userGeneSetDescription?: string;
  genes: string[];
  setModalGeneSet: (m: GeneSetModalT) => void;
  setQueryString: (qs: Record<string, string | null>) => void;
  queryString: Record<string, string | null>;
  drugLookupLoaded: boolean;
}) {
  // Hide cell line / timepoint / concentration columns when entirely N/A.
  const columnVisibility = React.useMemo(() => {
    if (!nodes) return { cellLine: true, timepoint: true, concentration: true };
    let hasCellLine = false, hasTimepoint = false, hasConcentration = false;
    for (const node of nodes) {
      const term = node?.geneSets?.nodes?.[0]?.term;
      const parsed = term ? parseTerm(term) : parseTerm('');
      if (getCellDisplay(parsed)) hasCellLine = true;
      if (parsed.timepoint) hasTimepoint = true;
      if (parsed.concentration) hasConcentration = true;
      if (hasCellLine && hasTimepoint && hasConcentration) break;
    }
    return { cellLine: hasCellLine, timepoint: hasTimepoint, concentration: hasConcentration };
  }, [nodes]);

  return (
    <table className="table table-sm [&_th]:px-2 [&_td]:px-2">
      <thead>
        <tr className="text-left align-text-bottom overflow-visible">
          <th className={'hidden'}>Term</th>
          <th>Dataset</th>
          <th className="relative group">
            <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
              Preclinical compound, drug, or perturbed gene
            </div>
            <span className="inline-flex">
              Perturbation
              <IoMdInformationCircleOutline className="ml-0.5" />
            </span>
          </th>
          <th className={columnVisibility.cellLine ? '' : 'hidden'}>Cell Line</th>
          <th className={columnVisibility.timepoint ? '' : 'hidden'}>
            Time
            <br />
            point
          </th>
          <th className={columnVisibility.concentration ? '' : 'hidden'}>Concentration</th>
          <th>Direction</th>
          <th className="relative group">
            <div className="absolute z-10 left-0 top-10 mb-2 hidden w-72 whitespace-normal bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
              Number of gene set libraries with a significant result for this perturbation.
            </div>
            Supporting<br />
            <span className="inline-flex">
              Libraries
              <IoMdInformationCircleOutline className="ml-0.5" />
            </span>
          </th>
          <th className="relative group">
            <div className="absolute z-10 left-0 top-10 mb-2 hidden w-80 whitespace-normal bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
              Number of signatures with this perturbation, in this gene set library
            </div>
            Library<br />
            <span className="inline-flex">
              Signatures
              <IoMdInformationCircleOutline className="ml-0.5" />
            </span>
          </th>
          <th className="relative group">
            <div className="absolute z-10 left-0 top-10 mb-2 hidden w-80 whitespace-normal bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
              Total number of signatures for this perturbation across all gene set libraries.
            </div>
            Total<br />
            <span className="inline-flex">
              Signatures
              <IoMdInformationCircleOutline className="ml-0.5" />
            </span>
          </th>
          <th>MoA</th>
          <th>
            FDA
            <br />
            Approved
          </th>
          <th>
            Gene
            <br />
            Set
            <br />
            Size
          </th>
          <SortableHeader sortKey="overlap" currentSort={queryString.sort} setQueryString={setQueryString}>
            Overlap
          </SortableHeader>
          <SortableHeader sortKey="odds_ratio" currentSort={queryString.sort} setQueryString={setQueryString}>
            Odds<br />Ratio
          </SortableHeader>
          <SortableHeader
            sortKey="pvalue"
            currentSort={queryString.sort}
            setQueryString={setQueryString}
            tooltipSide="right"
            tooltip={<>P-value computed using the Fisher&apos;s Exact Test</>}
          >
            PValue
          </SortableHeader>
          <SortableHeader
            sortKey="adj_pvalue"
            currentSort={queryString.sort}
            setQueryString={setQueryString}
            tooltipSide="right"
            tooltip="Adjusted P-value computed using the Benjamini-Hochberg procedure"
          >
            AdjPValue
          </SortableHeader>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={100}>
              <Loading />
            </td>
          </tr>
        ) : null}
        {nodes?.flatMap((enrichmentResult) => {
          const term = enrichmentResult?.geneSets?.nodes?.[0]?.term;
          const libraryName = enrichmentResult?.geneSets?.nodes?.[0]?.library?.name || '';

          const parsed = term ? parseTerm(term) : parseTerm('');
          const dataset = libraryName;
          const direction = parsed.direction || '';
          const perturbation = parsed.perturbation || parsed.raw || '';
          const cellLine = getCellDisplay(parsed) || 'N/A';
          const timepoint = parsed.timepoint || 'N/A';
          const concentration = parsed.concentration || 'N/A';

          const isGenePert = isGenePerturbationLibrary(libraryName);
          // Display string with perturbation type appended for gene libraries (e.g. "PRSS36 KO").
          // `perturbation` stays raw — it feeds the NCBI/PubChem URL and drug lookups below.
          const perturbationDisplay = formatPerturbationWithType(perturbation, parsed.perturbationType, isGenePert);
          const typeSuffix = isGenePert && !perturbation.includes('|') ? perturbationDisplay.slice(perturbation.length) : '';

          const fdaData = enrichmentResult?.geneSets?.nodes?.[0]?.geneSetFdaCountsById?.nodes?.[0];
          const sigCount = fdaData?.count ?? 0;
          const dbMoa = fdaData?.moa || '';
          const approved = fdaData?.approved || false;

          const drugInfo =
            !isGenePert && drugLookupLoaded
              ? getDrugInfo(perturbation) || getDrugInfo(parsed.extras[0] || '')
              : null;
          const perturbationUrl = getPerturbationUrl(perturbation, libraryName);
          const moa = isGenePert ? '' : dbMoa || drugInfo?.moa || '';

          if (!enrichmentResult?.geneSets) return null;
          return (
            <tr key={enrichmentResult.geneSetId} className="text-left">
              <td className={'hidden'}>{term}</td>
              <DatasetCell dataset={dataset} term={term} />
              <td className={isGenePert ? 'w-[17.5rem] min-w-[16.25rem] max-w-[17.5rem]' : 'max-w-[130px]'}>
                <div className={isGenePert ? 'flex items-center gap-2' : undefined}>
                  <a
                    href={perturbationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-neutral hover:link-hover flex min-w-0"
                    title={perturbationDisplay}
                  >
                    <span className="truncate">{typeSuffix ? perturbation : perturbationDisplay}</span>
                    <span className="shrink-0 whitespace-pre">{typeSuffix}</span>
                  </a>
                  {isGenePert && <SingleGenePerturbationResourceLinks perturbation={perturbation} />}
                  {!isGenePert && drugInfo?.cid && (
                    <div className="text-xs text-gray-500">
                      <span title="PubChem Compound ID">PCID:</span> {drugInfo.cid}
                    </div>
                  )}
                </div>
              </td>
              <td className={`max-w-[100px] ${columnVisibility.cellLine ? '' : 'hidden'}`}>
                {cellLine && cellLine !== 'N/A' ? (
                  <a
                    className="link link-neutral hover:link-hover cursor-pointer truncate block"
                    title={cellLine}
                    onClick={async (evt) => {
                      evt.preventDefault();
                      const res = await fetch('enrich/depmapcl', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cellLine }),
                      });
                      const resJson = await res.json();
                      const suggestedCellLines = resJson.filter(
                        (entry: any) => entry.type === 'cell_line',
                      );
                      if (suggestedCellLines.length > 0) {
                        window.open(
                          `https://depmap.org${suggestedCellLines[0].url}`,
                          '_blank',
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
              <td className={`max-w-[70px] ${columnVisibility.timepoint ? '' : 'hidden'}`}>
                {timepoint === 'N/A' ? (
                  <span className="text-gray-400">N/A</span>
                ) : (
                  <span className="truncate block" title={timepoint}>{timepoint}</span>
                )}
              </td>
              <td className={`max-w-[80px] ${columnVisibility.concentration ? '' : 'hidden'}`}>
                {concentration === 'N/A' ? (
                  <span className="text-gray-400">N/A</span>
                ) : (
                  <span className="truncate block" title={concentration}>{concentration}</span>
                )}
              </td>
              <td>
                {direction === 'up' ? (
                  <Image
                    className="inline-block rounded"
                    src="/images/up.png"
                    width={15}
                    height={15}
                    alt="Up"
                  />
                ) : direction === 'down' || direction === 'dn' ? (
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
              <td>
                <LibraryCount
                  count={enrichmentResult?.libraryCount}
                  libraries={enrichmentResult?.supportingLibraries}
                />
              </td>
              <td>{sigCount}</td>
              <td>{fdaData?.totalCount ?? 0}</td>
              <td className="max-w-[150px]">
                {moa ? (
                  <div className="text-sm">
                    <span className="line-clamp-2" title={moa}>{moa}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </td>
              <td>{isGenePert ? <span className="text-gray-400">N/A</span> : (approved ? 'Yes' : 'No')}</td>
              <td>
                <label
                  htmlFor="geneSetModal"
                  className="prose underline cursor-pointer"
                  onClick={() => {
                    setModalGeneSet({
                      type: 'GeneSet',
                      id: enrichmentResult?.geneSets?.nodes?.[0]?.id,
                      description: term ?? '',
                      library: libraryName,
                    });
                  }}
                >
                  {enrichmentResult?.geneSets?.nodes?.[0]?.nGeneIds}
                </label>
              </td>
              <td>
                <label
                  htmlFor="geneSetModal"
                  className="prose underline cursor-pointer"
                  onClick={() => {
                    setModalGeneSet({
                      type: 'GeneSetOverlap',
                      id: enrichmentResult?.geneSets?.nodes?.[0]?.id,
                      description: `${userGeneSetDescription || 'User gene set'} & ${term || 'Perturb-Seqr gene set'}`,
                      genes,
                      library: libraryName,
                    });
                  }}
                >
                  {enrichmentResult?.nOverlap}
                </label>
              </td>
              <td>{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
              <td>{enrichmentResult?.pvalue?.toPrecision(3)}</td>
              <td>{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
