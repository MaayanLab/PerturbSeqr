"use client";
import React from "react";
import {
  FetchUserGeneSetQuery,
  usePairEnrichmentQueryQuery,
  useFetchGeneInfoQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useGeneSetGenesByIdQuery,
} from "@/graphql";
import ensureArray from "@/utils/ensureArray";
import Loading from "@/components/loading";
import Pagination from "@/components/pagination";
import DownloadButtonPair from "@/components/downloadButtonPair";
import useQsState from "@/utils/useQsState";
import Stats from "@/components/stats";
import Image from "next/image";
import GeneSetModal from "@/components/geneSetModal";
import SignaturesModal from "@/components/signaturesModal";
import type { ContributingSignature } from "@/components/signaturesModal";
import { FaFilter, FaSortUp } from "react-icons/fa6";
import { IoMdInformationCircleOutline } from "react-icons/io";
import { parseTerm, getCellDisplay, formatPerturbationWithType } from "@/utils/parseTerm";
import { preloadDrugLookup, getDrugInfo, getPerturbationUrl, getPerturbationLinkTitle, isGenePerturbationLibrary } from "@/utils/metadataLookup";
import { DatasetCell } from "@/components/DatasetCell";
import { useRouter } from "next/navigation";
import libraryConfig from "@/config/libraries.json";
import { LibraryBarGraphGrid, LibraryCardPaired } from "@/components/BarGraph";
import ShareButton from "@/components/shareButton";
import { SortableHeader } from "@/components/SortableHeader";
import LibraryCount from "@/components/LibraryCount";
import SingleGenePerturbationResourceLinks from "@/components/SingleGenePerturbationResourceLinks";

const allLibraryDisplayNames = Object.values(libraryConfig.libraries).map((l: any) => l.displayName as string);
const drugLibraryNames = Object.values(libraryConfig.libraries).filter((l: any) => l.category === 'drug').map((l: any) => l.displayName as string);
const geneLibraryNames = Object.values(libraryConfig.libraries).filter((l: any) => l.category === 'gene').map((l: any) => l.displayName as string);

import { DEFAULT_CONSENSUS_TOP_N_SIGNATURES, DEFAULT_PVALUE_CUTOFF, RESULTS_PER_PAGE } from '@/constants/enrichment';

const pageSize = RESULTS_PER_PAGE;

type GeneSetModalT =
  | {
      type: "UserGeneSets";
      description: string;
      genesUp: string[];
      genesDown: string[];
    }
  | {
      type: "GeneSetOverlapMimicker";
      idUp: string;
      idDown: string;
      description: string;
      genesUp: string[];
      genesDown: string[];
      library?: string;
    }
    | {
      type: "GeneSetOverlapReverser";
      idUp: string;
      idDown: string;
      description: string;
      genesUp: string[];
      genesDown: string[];
      library?: string;
    }
  | {
      type: "GeneSet";
      id: string;
      description: string;
      library?: string;
    }
  | undefined;

function EnrichmentResults({
  userGeneSetUp,
  userGeneSetDown,
  setModalGeneSet,
  datasetUp,
  datasetDown,
  libraryNames,
}: {
  userGeneSetUp?: FetchUserGeneSetQuery;
  userGeneSetDown?: FetchUserGeneSetQuery;
  setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>>;
  datasetUp: string;
  datasetDown: string;
  libraryNames: string[] | null;
}) {

  
  const genesUp = React.useMemo(
    () =>
      ensureArray(userGeneSetUp?.userGeneSet?.genes)
        .filter((gene): gene is string => !!gene)
        .map((gene) => gene.toUpperCase()),
    [userGeneSetUp]
  );

  const genesDown = React.useMemo(
    () =>
      ensureArray(userGeneSetDown?.userGeneSet?.genes)
        .filter((gene): gene is string => !!gene)
        .map((gene) => gene.toUpperCase()),
    [userGeneSetDown]
  );

  const [queryString, setQueryString] = useQsState({
    page: "1",
    q: "",
    dir: "",
    fda: "false",
    consensus: "false",
    moas: "false",
    sort: "pvalue_mimic",
    ko: "false",
    topn: String(DEFAULT_CONSENSUS_TOP_N_SIGNATURES),
    pvaluele: String(DEFAULT_PVALUE_CUTOFF),
    libraries: "",
    view: "",
  });
  const [rawTerm, setRawTerm] = React.useState("");
  const [topNSlider, setTopNSlider] = React.useState(DEFAULT_CONSENSUS_TOP_N_SIGNATURES);
  const [pvalueLeSlider, setPvalueLeSlider] = React.useState(DEFAULT_PVALUE_CUTOFF);
  const [drugLookupLoaded, setDrugLookupLoaded] = React.useState(false);
  const [datasetDropdownOpen, setDatasetDropdownOpen] = React.useState(false);
  const [sigModalData, setSigModalData] = React.useState<{ signatures: ContributingSignature[]; drug: string } | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { page, term, fda, consensus, moas, sort, ko, topN, pvalueLe, datasetFilter, view } =
    React.useMemo(
      () => ({
        page: queryString.page ? +queryString.page : 1,
        term: queryString.q ?? "",
        fda: queryString.fda === "true",
        consensus: queryString.consensus === "true",
        moas: queryString.moas === "true",
        sort: queryString.sort,
        ko: queryString.ko === "true",
        topN: parseInt(queryString?.topn ?? String(DEFAULT_CONSENSUS_TOP_N_SIGNATURES)),
        pvalueLe: parseFloat(queryString?.pvaluele ?? String(DEFAULT_PVALUE_CUTOFF)),
        datasetFilter: queryString.libraries ? queryString.libraries.split(",").filter(Boolean) : [] as string[],
        view: (queryString.view === "table" ? "table" : "chart") as "chart" | "table",
      }),
      [queryString]
    );

  const activeFilters: string[] = [];
  if (datasetFilter.length > 0 && !datasetFilter.includes("__none__"))
    activeFilters.push(`${datasetFilter.length} dataset${datasetFilter.length > 1 ? "s" : ""}`);
  if (fda) activeFilters.push("FDA approved");
  if (queryString.dir === "up") activeFilters.push("mimickers");
  if (queryString.dir === "down") activeFilters.push("reversers");
  const filterClause =
    activeFilters.length === 0
      ? ""
      : ` that pass the ${activeFilters.length === 1 ? `${activeFilters[0]} filter` : `${activeFilters.join(", ")} filters`}`;

  // Libraries to render cards for. The sentinel "__none__" means the user
  // explicitly cleared the Dataset filter — render no cards. Otherwise fall
  // back to all libraries.
  const chartLibraries = React.useMemo(() => {
    if (datasetFilter.includes("__none__")) return [];
    if (datasetFilter.length > 0) return datasetFilter;
    return libraryNames ?? allLibraryDisplayNames;
  }, [datasetFilter, libraryNames]);
  // Query enrichment results
  const { data: enrichmentResults, error } = usePairEnrichmentQueryQuery({
    skip: genesUp.length === 0 || genesDown.length === 0,
    variables: {
      genesUp,
      genesDown,
      filterTerm: term + " " + queryString.dir,
      libraryNames: datasetFilter.length > 0 ? datasetFilter : libraryNames,
      offset: (page - 1) * pageSize,
      first: pageSize,
      filterFda: fda,
      sortBy: sort,
      filterKo: ko,
      topN: topN,
      pvalueLe: pvalueLe,
    },
  });


  // Close dataset dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDatasetDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Preload drug lookup at component mount
  React.useEffect(() => {
    preloadDrugLookup().then(() => setDrugLookupLoaded(true));
  }, []);

  // Compute column visibility - hide columns that are entirely N/A on current page
  const columnVisibility = React.useMemo(() => {
    const nodes = enrichmentResults?.currentBackground?.pairedEnrich?.nodes;
    if (!nodes) return { cellLine: true, timepoint: true, concentration: true };
    let hasCellLine = false, hasTimepoint = false, hasConcentration = false;
    for (const node of nodes) {
      const term = node?.geneSet?.nodes[0]?.term;
      const parsed = term ? parseTerm(term) : parseTerm('');
      if (getCellDisplay(parsed)) hasCellLine = true;
      if (parsed.timepoint) hasTimepoint = true;
      if (parsed.concentration) hasConcentration = true;
      if (hasCellLine && hasTimepoint && hasConcentration) break;
    }
    return { cellLine: hasCellLine, timepoint: hasTimepoint, concentration: hasConcentration };
  }, [enrichmentResults]);

  return (
    <div className="flex flex-col gap-1 mt-1">
      <ul className="menu menu-horizontal gap-3 text-base justify-center py-0">
        <li>
          <a
            className={view === "chart" ? "active" : ""}
            onClick={() => setQueryString({ view: "chart" })}
          >
            Bar Graphs
          </a>
        </li>
        <li>
          <a
            className={view === "table" ? "active" : ""}
            onClick={() => setQueryString({ view: "table" })}
          >
            Table
          </a>
        </li>
        <ShareButton />
      </ul>
      <h2 className="text-lg font-bold">
         {!enrichmentResults?.currentBackground?.pairedEnrich && !error ? (
                  <>
                    Rummaging through <Stats show_gene_sets />.
                  </>
                ) : (
                  <>
                    {consensus ? (
                      <>
                        After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.pairedEnrich?.geneSetCount || 0)} gene set pairs.{" "}
                        <Image
                          className="inline-block rounded"
                          src="/images/perturbseqr-logo.png"
                          width={50}
                          height={100}
                          alt="Perturb-Seqr"
                        ></Image>{" "}
                        computed significance for{" "}
                        {Intl.NumberFormat("en-US", {}).format(
                          enrichmentResults?.currentBackground?.pairedEnrich
                            ?.consensusCount || 0
                        )}{" "}
                        consensus perturbations.
                      </>
                    ) : moas ? <>
                    After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.pairedEnrich?.geneSetCount || 0)} gene set pairs.{" "}
                        <Image
                          className="inline-block rounded"
                          src="/images/perturbseqr-logo.png"
                          width={50}
                          height={100}
                          alt="Perturb-Seqr"
                        ></Image>{" "}
                        computed significance for{" "}
                        {Intl.NumberFormat("en-US", {}).format(
                          enrichmentResults?.currentBackground?.pairedEnrich
                            ?.moasCount || 0
                        )}{" "}
                        consensus MoAs.</>
                    : (
                      <>
                        After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.pairedEnrich?.geneSetCount || 0)} gene set pairs.{" "}
                        <Image
                          className="inline-block rounded"
                          src="/images/perturbseqr-logo.png"
                          width={50}
                          height={100}
                          alt="Perturb-Seqr"
                        ></Image>{" "}
                        found{" "}
                        {Intl.NumberFormat("en-US", {}).format(
                          enrichmentResults?.currentBackground?.pairedEnrich?.totalCount || 0
                        )}{" "}
                        statistically significant matches{filterClause}.
                      </>
                    )}
                  </>
                )}
      </h2>
      {view === "chart" && (
        <p className="text-sm text-base-content/70 mt-1">
          Sorting library cards by geometric mean of top 10 adjusted p-values across mimicker and reverser hits.
          Bars within each chart are colored and scaled by p-value.
        </p>
      )}
      {datasetFilter.includes("__none__") && (
        <p className="text-sm text-base-content/70 mt-1">
          No datasets selected. Use the Dataset column filter to select datasets.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-2">
        <div className="relative" ref={dropdownRef}>
          <button
            className={
              datasetFilter.length > 0
                ? "button btn btn-sm bg-gray-400 hover:bg-gray-500 text-gray-800"
                : "button btn btn-sm"
            }
            onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
          >
            Dataset {datasetFilter.length > 0 && !datasetFilter.includes("__none__") ? `(${datasetFilter.length})` : ""}
            <FaFilter className={`text-xs ${datasetFilter.length > 0 ? "" : "opacity-40"}`} />
          </button>
          {datasetDropdownOpen && (
            <div className="absolute z-30 left-0 top-full mt-1 bg-base-100 border border-base-300 rounded shadow-lg p-2 min-w-[220px] max-h-[400px] overflow-y-auto">
              <div className="flex gap-1 mb-1">
                <button
                  className="btn btn-xs"
                  onClick={() => setQueryString({ libraries: "", page: "1", view })}
                >All</button>
                <button
                  className="btn btn-xs"
                  onClick={() => setQueryString({ libraries: "__none__", page: "1", view })}
                >None</button>
              </div>
              {allLibraryDisplayNames.map((lib) => (
                <label key={lib} className="flex items-center gap-1 cursor-pointer py-0.5 text-xs">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={datasetFilter.length === 0 ? true : datasetFilter.includes(lib)}
                    onChange={(e) => {
                      let next: string[];
                      if (datasetFilter.length === 0) {
                        next = allLibraryDisplayNames.filter((l) => l !== lib);
                      } else if (e.target.checked) {
                        next = datasetFilter.filter((l) => l !== "__none__").concat(lib);
                      } else {
                        next = datasetFilter.filter((l) => l !== lib);
                      }
                      if (next.length >= allLibraryDisplayNames.length) {
                        setQueryString({ libraries: "", page: "1", view });
                      } else if (next.length === 0) {
                        setQueryString({ libraries: "__none__", page: "1", view });
                      } else {
                        setQueryString({ libraries: next.join(","), page: "1", view });
                      }
                    }}
                  />
                  {lib}
                </label>
              ))}
            </div>
          )}
        </div>

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
              const isDrugActive = datasetFilter.length > 0 && drugLibraryNames.every(n => datasetFilter.includes(n)) && !geneLibraryNames.some(n => datasetFilter.includes(n));
              if (isDrugActive) {
                setQueryString({ libraries: "", page: "1", view });
              } else {
                setQueryString({ libraries: drugLibraryNames.join(","), page: "1", view });
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
              const isGeneActive = datasetFilter.length > 0 && geneLibraryNames.every(n => datasetFilter.includes(n)) && !drugLibraryNames.some(n => datasetFilter.includes(n));
              if (isGeneActive) {
                setQueryString({ libraries: "", page: "1", view });
              } else {
                setQueryString({ libraries: geneLibraryNames.join(","), page: "1", view });
              }
            }}
          >
            GENE
          </div>
        </div>

        {view === "table" && (<>
        <div
          id="dir-select"
          className="join place-content-start place-items-center"
        >
          <div
            className={
              queryString.dir == "up"
                ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                : "join-item px-3 py-1.5  bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "up")
                setQueryString({
                  page: "1",
                  q: queryString.q,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
                  sort: "pvalue_mimic",
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: queryString.q,
                  dir: "up",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
                  sort: "pvalue_mimic",
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            MIMICKERS
          </div>
          <div
            className={
              queryString.dir == "down"
                ? "join-item px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold cursor-pointer"
                : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "down")
                setQueryString({
                  page: "1",
                  q: queryString.q,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
                  sort: "pvalue_reverse",
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: queryString.q,
                  dir: "down",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
                  sort: "pvalue_reverse",
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            REVERSERS
          </div>
        </div>

        <button
          onClick={() => {
            if (queryString.fda === "false")
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: "true",
                consensus: queryString.consensus,
                dir: queryString.dir,
                ko: "false",
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: "false",
                dir: queryString.dir,
                consensus: queryString.consensus,
                ko: queryString.ko,
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.fda === "true"
              ? "button btn btn-sm bg-gray-400 hover:bg-gray-500 text-gray-800"
              : "button btn btn-sm"
          }
        >
          Approved
        </button>

        <button
          onClick={() => {
            if (queryString.consensus === "false")
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: queryString.fda,
                consensus: "true",
                moas: "false",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: queryString.fda,
                consensus: "false",
                moas: "false",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.consensus === "true"
              ? "hidden button btn btn-sm bg-gray-400 hover:bg-gray-500 text-gray-800"
              : "hidden button btn btn-sm"
          }
        >
          Consensus Perturbations
        </button>
        <button
          onClick={() => {
            if (queryString.moas === "false")
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: queryString.fda,
                consensus: "false",
                moas: "true",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: queryString.q,
                fda: queryString.fda,
                consensus: "false",
                moas: "false",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.moas === "true"
              ? "hidden button btn btn-sm bg-gray-400 hover:bg-gray-500 text-gray-800"
              : "hidden button btn btn-sm"
          }
        >
          Consensus MoAs
        </button>
        {(consensus || moas) ? (
          <div className="inline-flex items-center transition-all accent-gray-600">
            <label
              className="text-sm font-bold mr-3 tooltip inline-flex"
              htmlFor="default-range"
              data-tip="Significant signatures to use when computing consensus scores (ranked by p-value)"
            >
              Top N Significant Sigs{" "}
              <IoMdInformationCircleOutline className="ml-0.5" />
            </label>
            <div className="tooltip" data-tip={topNSlider.toString()}>
              <input
                id="default-range"
                type="range"
                value={topNSlider}
                onChange={(evt) => setTopNSlider(Number(evt.target.value))}
                max={50000}
                min={500}
                step={500}
                className="w-52 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              ></input>
            </div>

            <div className="tooltip ml-2" data-tip="Apply Threshold">
              <button
                className="btn btn-sm bg-transparent p-2"
                onClick={() => {
                  setQueryString({
                    page: "1",
                    q: queryString.q,
                    dir: queryString.dir,
                    fda: queryString.fda,
                    consensus: queryString.consensus,
                    moas: queryString.moas,
                    sort: queryString.sort,
                    ko: queryString.ko,
                    topn: topNSlider.toString(),
                    pvaluele: queryString.pvaluele,
                  });
                }}
              >
                <FaFilter />
              </button>
            </div>
          </div>
        ) : <></>}
        </>)}
        </div>
        {view === "table" && (<>
        <form
          id="search-form"
          className="join flex flex-row place-content-end place-items-center overflow-visible"
          onSubmit={(evt) => {
            evt.preventDefault();
            const trimmed = rawTerm.trim();
            if (!trimmed) return;
            const existing = term ? term.split(",").map(s => s.trim()).filter(Boolean) : [];
            if (!existing.includes(trimmed)) {
              existing.push(trimmed);
            }
            setQueryString({
              page: "1",
              q: existing.join(","),
            });
            setRawTerm("");
          }}
        >
          <input
            type="text"
            className="input input-bordered join-item"
            placeholder="Filter by cell line, drug, gene..."
            value={rawTerm}
            onChange={(evt) => {
              setRawTerm(evt.currentTarget.value);
            }}
          />
          <div className="tooltip" data-tip="Add filter">
            <button type="submit" className="btn join-item">
              &#x1F50D;
            </button>
          </div>
          <DownloadButtonPair queryString={queryString} datasetDown={datasetDown} datasetUp={datasetUp}></DownloadButtonPair>
        </form>
        <div className="border border-base-300 rounded-lg p-3 mt-2 min-h-[2.75rem] bg-base-200/50">
          {term ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-base-content/50 mr-1">Active filters:</span>
              {term.split(",").map(s => s.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="badge badge-neutral gap-1">
                  {tag}
                  <button
                    className="cursor-pointer hover:text-primary-content/70"
                    onClick={() => {
                      const next = term.split(",").map(s => s.trim()).filter(t => t !== tag).join(",");
                      setQueryString({ page: "1", q: next });
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <button
                className="badge badge-ghost badge-sm cursor-pointer"
                onClick={() => {
                  setQueryString({ page: "1", q: "" });
                  setRawTerm("");
                }}
              >
                Clear all
              </button>
            </div>
          ) : (
            <span className="text-xs text-base-content/40">No active filters. Use the search bar to filter by cell line, drug, gene, etc.</span>
          )}
        </div>
        </>)}
      </div>
      {view === "chart" && (
        !enrichmentResults?.currentBackground?.pairedEnrich && !error ? (
          <Loading />
        ) : (
          <LibraryBarGraphGrid
            activeLibraries={chartLibraries}
            renderCard={(lib) => (
              <LibraryCardPaired
                genesUp={genesUp} genesDown={genesDown}
                libraryName={lib} setQueryString={setQueryString}
              />
            )}
          />
        )
      )}
      {view === "table" && (<>
      <div className="overflow-x-auto -mx-8 md:-mx-24 px-2">
        {consensus || moas ? (
          <>
            <table className="table table-sm">
              <thead>
                <tr className="text-left align-text-bottom">
                  <th>Perturbation</th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Reflecting if there are more significant mimicker or reverser
                      signatures
                    </div>
                    <span className="inline-flex">
                      Direction
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    Sig
                    <br />
                    Signatures
                  </th>
                  <th>
                    Insig
                    <br />
                    Signatures
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant mimicker signatures, and the number of significant
                      reverser signatures,
                      <br /> the number of insignificant mimicker signatures, and the
                      number of insignificant reverser signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Mimicker <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Mimicker p-values adjusted using the Benjamini-Hochberg method
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "adj_pvalue_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      AdjPValue
                      <br />
                      Mimicker <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio
                      <br />
                      Mimicker <FaSortUp />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant reverser signatures, and the number of significant
                      mimicker signatures,
                      <br /> the number of insignificant reverser signatures, and
                      the number of insignificant mimicker signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Reverser <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Down p-values adjusted using the Benjamini-Hochberg method
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "adj_pvalue_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      AdjPValue
                      <br />
                      Reverser <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio
                      <br />
                      Reverser <FaSortUp />
                    </span>
                  </th>
                  <th className={(moas || ko) ? "hidden" : ""}>
                    FDA
                    <br />
                    Approved
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio <FaSortUp />
                    </span>
                  </th>
                  <th className="relative group hidden">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant signatures and insignificant signatures for
                      the given perturbation,
                      <br /> as well as the total number of significant and
                      insignificant signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: queryString.q,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group hidden">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      P-values adjusted using the Benjamini-Hochberg method
                    </div>
                    <span className="inline-flex">
                      AdjPValue
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!enrichmentResults?.currentBackground?.pairedEnrich && !error ? (
                  <tr>
                    <td colSpan={100}>
                      <Loading />
                    </td>
                  </tr>
                ) : null}
                {(moas
                    ? enrichmentResults?.currentBackground?.pairedEnrich?.moas
                    : enrichmentResults?.currentBackground?.pairedEnrich?.consensus
                  )?.flatMap(
                  (enrichmentResult, genesetIndex) => {
                    var perturbation = enrichmentResult?.drug;
                    const cid = enrichmentResult?.cid;
                    const libs = enrichmentResult?.libraries?.filter(Boolean) as string[] || [];
                    // Determine if gene perturbation by checking if ALL contributing libraries are gene category
                    const isGeneKO = libs.length > 0 && libs.every(lib => geneLibraryNames.includes(lib));
                    if (isGeneKO && !moas)
                      perturbation = perturbation + " KO";
                    // Get drug info for CID display (only for non-KO perturbations)
                    const consensusDrugInfo = !isGeneKO && !moas && drugLookupLoaded ? getDrugInfo(perturbation || '') : null;
                    return (
                      <tr key={genesetIndex}>
                        <td>
                        {moas ? <span style={{textTransform: 'capitalize'}}>{perturbation}</span> : !isGeneKO ? (
                            <div>
                              <div>
                                {perturbation}
                                <a
                                  className="underline cursor-pointer mx-2"
                                  href={`https://pubchem.ncbi.nlm.nih.gov/#query=${perturbation}`}
                                  target="_blank"
                                >
                                  <Image
                                    className="inline-block rounded"
                                    src="/images/drug_vector_art.png"
                                    width={20}
                                    height={20}
                                    alt="PubChem"
                                  />
                                </a>
                              </div>
                              {/* Show CID for drug perturbations */}
                              {consensusDrugInfo?.cid && (
                                <div className="text-xs text-gray-500">
                                  <span title="PubChem Compound ID">PCID:</span> {consensusDrugInfo.cid}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {perturbation}
                              <SingleGenePerturbationResourceLinks perturbation={enrichmentResult?.drug} />
                            </span>
                          )}
                        </td>
                        <td>
                          {(enrichmentResult?.pvalueUp || 0) <
                          (enrichmentResult?.pvalueDown || 0) ? (
                            <Image
                              className="inline-block rounded"
                              src="/images/up.png"
                              width={15}
                              height={15}
                              alt="Up"
                            />
                          ) : (enrichmentResult?.pvalueUp || 0) >
                            (enrichmentResult?.pvalueDown || 0) ? (
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
                              alt="Equal"
                            />
                          )}
                        </td>
                        <td>
                          <button
                            className="link link-hover text-blue-500"
                            onClick={() => {
                              setSigModalData({
                                signatures: (enrichmentResult?.contributingSignatures as ContributingSignature[]) || [],
                                drug: enrichmentResult?.drug || "",
                              });
                            }}
                          >
                            {enrichmentResult?.countSignificant} (
                            {enrichmentResult?.countUpSignificant} Up,{" "}
                            {(enrichmentResult?.countSignificant || 0) -
                              (enrichmentResult?.countUpSignificant || 0)}{" "}
                            Down)
                          </button>
                        </td>
                        <td>{enrichmentResult?.countInsignificant}</td>
                        <td>{enrichmentResult?.pvalueUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.adjPvalueUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.oddsRatioUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.pvalueDown?.toPrecision(3)}</td>
                        <td>
                          {enrichmentResult?.adjPvalueDown?.toPrecision(3)}
                        </td>
                        <td>
                          {enrichmentResult?.oddsRatioDown?.toPrecision(3)}
                        </td>
                        {(!moas && !ko) && <td>{enrichmentResult?.approved ? "Yes" : "No"}</td>}
                        <td>{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                        <td className="hidden">
                          {enrichmentResult?.pvalue?.toPrecision(3)}
                        </td>
                        <td className="hidden">
                          {enrichmentResult?.adjPvalue?.toPrecision(3)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr className="text-left align-text-bottom overflow-visible">
                <th className={"hidden"}>Term</th>
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
                <th className={columnVisibility.cellLine ? "" : "hidden"}>Cell Line</th>
                <th className={columnVisibility.timepoint ? "" : "hidden"}>
                  Time
                  <br />
                  point
                </th>
                <th className={columnVisibility.concentration ? "" : "hidden"}>Concentration</th>
                {/* <th>Direction</th> */}
                <th className="relative group">
                  <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Number of signatures with this perturbation, in this gene set library
                  </div>
                  Signature<br></br>
                  <span className="inline-flex">
                    Count
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th className="relative group">
                  <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Number of gene set libraries with a significant result for this perturbation.
                  </div>
                  Library<br />
                  <span className="inline-flex">
                    Count
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
                  Size Up
                </th>
                <th>
                  Gene
                  <br />
                  Set
                  <br />
                  Size Down
                </th>
                <th>
                  Mimicker<br />Overlap 
                </th>
                <SortableHeader sortKey="odds_ratio_mimic" currentSort={queryString.sort} setQueryString={setQueryString}>
                  Odds<br />Ratio<br />Mimicker
                </SortableHeader>
                <SortableHeader
                  sortKey="pvalue_mimic"
                  currentSort={queryString.sort}
                  setQueryString={setQueryString}
                  tooltipSide="right"
                  tooltip={<>P-value computed using the Fisher&apos;s Exact Test</>}
                >
                  PValue<br />Mimicker
                </SortableHeader>
                <SortableHeader
                  sortKey="adj_pvalue_mimic"
                  currentSort={queryString.sort}
                  setQueryString={setQueryString}
                  tooltipSide="right"
                  tooltip="Adjusted P-value computed using the Benjamini-Hochberg procedure"
                >
                  AdjPValue<br />Mimicker
                </SortableHeader>
                <th>
                  Reverser<br/>Overlap
                </th>
                <SortableHeader sortKey="odds_ratio_reverse" currentSort={queryString.sort} setQueryString={setQueryString}>
                  Odds<br />Ratio<br />Reverser
                </SortableHeader>
                <SortableHeader
                  sortKey="pvalue_reverse"
                  currentSort={queryString.sort}
                  setQueryString={setQueryString}
                  tooltipSide="right"
                  tooltip={<>P-value computed using the Fisher&apos;s Exact Test</>}
                >
                  PValue<br />Reverser
                </SortableHeader>
                <SortableHeader
                  sortKey="adj_pvalue_reverse"
                  currentSort={queryString.sort}
                  setQueryString={setQueryString}
                  tooltipSide="right"
                  tooltip="Adjusted P-value computed using the Benjamini-Hochberg procedure"
                >
                  AdjPValue<br />Reverser
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {!enrichmentResults?.currentBackground?.pairedEnrich && !error ? (
                <tr>
                  <td colSpan={100}>
                    <Loading />
                  </td>
                </tr>
              ) : null}
              {enrichmentResults?.currentBackground?.pairedEnrich?.nodes?.flatMap(
                (enrichmentResult, genesetIndex) => {
                  const term = enrichmentResult?.geneSet?.nodes[0]?.term;
                  const geneSetUp =  enrichmentResult?.geneSet?.nodes.filter((x) => x.term.endsWith(" up"))[0]
                  const geneSetDown =  enrichmentResult?.geneSet?.nodes.filter((x) => x.term.endsWith(" down"))[0]
                  const libraryName = geneSetUp?.library?.name || geneSetDown?.library?.name || '';

                  const parsed = term ? parseTerm(term) : parseTerm('');

                  const cellLine = getCellDisplay(parsed) || 'N/A';
                  const timepoint = parsed.timepoint || 'N/A';
                  const concentration = parsed.concentration || 'N/A';
                  const perturbation = parsed.perturbation || parsed.raw || '';

                  // Check if this is a gene or drug perturbation library
                  const isGenePert = isGenePerturbationLibrary(libraryName);
                  // Display string with perturbation type appended for gene libraries (e.g. "PRSS36 KO");
                  // `perturbation` stays raw for the NCBI/PubChem URL and drug lookups.
                  const perturbationDisplay = formatPerturbationWithType(perturbation, parsed.perturbationType, isGenePert);

                  // Get FDA data from database
                  const fdaData = enrichmentResult?.geneSet?.nodes[0].geneSetFdaCountsById?.nodes[0];
                  const count = fdaData?.count ?? 0;
                  const approved = fdaData?.approved || false;
                  const dbMoa = fdaData?.moa || '';

                  // Get additional drug info from JSON lookup (only for drug perturbations)
                  const drugInfo = !isGenePert && drugLookupLoaded
                    ? (getDrugInfo(perturbation) || getDrugInfo(parsed.extras[0] || ''))
                    : null;
                  const perturbationUrl = getPerturbationUrl(perturbation, libraryName);
                  const perturbationLinkTitle = getPerturbationLinkTitle(libraryName);
                  // Use database MOA first, fallback to JSON lookup (only for drugs)
                  const moa = isGenePert ? '' : (dbMoa || drugInfo?.moa || '');

                  if (!enrichmentResult?.geneSet) return null;
                  const dataset = libraryName || '';

                  return (
                    <tr key={genesetIndex} className="text-left">
                      <td className={"hidden"}>{term}</td>
                      <DatasetCell dataset={dataset} term={term} />
                      <td className={isGenePert ? 'max-w-[240px]' : 'max-w-[130px]'}>
                        {/* Perturbation with appropriate link (PubChem for drugs, NCBI Gene for genes) */}
                        <div className={isGenePert ? 'flex items-center gap-2' : undefined}>
                          <a
                            href={perturbationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-neutral hover:link-hover truncate block min-w-0"
                            title={perturbationDisplay}
                          >
                            {perturbationDisplay}
                          </a>
                          {isGenePert && <SingleGenePerturbationResourceLinks perturbation={perturbation} />}
                          {/* Show CID for drug perturbations */}
                          {!isGenePert && drugInfo?.cid && (
                            <div className="text-xs text-gray-500">
                              <span title="PubChem Compound ID">PCID:</span> {drugInfo.cid}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`max-w-[100px] ${columnVisibility.cellLine ? "" : "hidden"}`}>
                        {cellLine && cellLine !== 'N/A' ? (
                          <a
                            className="underline cursor-pointer truncate block"
                            title={cellLine}
                            onClick={async (evt) => {
                              evt.preventDefault();
                              const res = await fetch("enrich/depmapcl", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  cellLine: cellLine,
                                }),
                              });

                              const resJson = await res.json();
                              const suggestedCellLines = resJson.filter(
                                (entry: any) => entry.type == "cell_line"
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
                      <td className={`max-w-[70px] ${columnVisibility.timepoint ? "" : "hidden"}`}>{timepoint === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={timepoint}>{timepoint}</span>}</td>
                      <td className={`max-w-[80px] ${columnVisibility.concentration ? "" : "hidden"}`}>{concentration === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={concentration}>{concentration}</span>}</td>
                      <td>{count}</td>
                      <td>
                        <LibraryCount
                          count={enrichmentResult?.libraryCount}
                          libraries={enrichmentResult?.supportingLibraries}
                        />
                      </td>
                      <td className="max-w-[150px]">
                        {/* MOA with source attribution */}
                        {moa ? (
                          <div className="text-sm">
                            <span className="line-clamp-2" title={moa}>
                              {moa}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td>{approved ? "Yes" : "No"}</td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSet",
                              id: geneSetUp?.id,
                              description: geneSetUp?.term ?? "",
                              library: libraryName,
                            });
                          }}
                        >
                          {geneSetUp?.nGeneIds}
                        </label>
                      </td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSet",
                              id: geneSetDown?.id,
                              description: geneSetDown?.term ?? "",
                              library: libraryName,
                            });
                          }}
                        >
                          {geneSetDown?.nGeneIds}
                        </label>
                      </td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSetOverlapMimicker",
                              idUp: geneSetUp?.id,
                              idDown: geneSetDown?.id,
                              description: `${
                                userGeneSetUp?.userGeneSet?.description ||
                                "User up gs"
                              } ∩ ${term || "Perturb-Seqr up gs"} + ${
                                userGeneSetDown?.userGeneSet?.description ||
                                "User down gs"
                              } ∩ ${term || "Perturb-Seqr down gs"}`,
                              genesUp:  genesUp,
                              genesDown:  genesDown,
                              library: libraryName,
                            });
                          }}
                        >
                          {enrichmentResult?.mimickerOverlap}
                        </label>
                      </td>
                      <td>{enrichmentResult?.oddsRatioMimic?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.pvalueMimic?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.adjPvalueMimic?.toPrecision(3)}</td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSetOverlapReverser",
                              idUp: geneSetUp?.id,
                              idDown: geneSetDown?.id,
                              description: `${
                                userGeneSetUp?.userGeneSet?.description ||
                                "User up gs"
                              } ∩ ${term || "Perturb-Seqr down gs"} + ${
                                userGeneSetDown?.userGeneSet?.description ||
                                "User down gs"
                              } ∩ ${term || "Perturb-Seqr up gs"}`,
                              genesUp:  genesUp,
                              genesDown:  genesDown,
                              library: libraryName,
                            });
                          }}
                        >
                          {enrichmentResult?.reverserOverlap}
                        </label>
                      </td>
                      <td>{enrichmentResult?.oddsRatioReverse?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.pvalueReverse?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.adjPvalueReverse?.toPrecision(3)}</td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        )}
      </div>
      {enrichmentResults?.currentBackground?.pairedEnrich ? (
        <div className="w-full flex flex-col items-center">
          {consensus ? (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.pairedEnrich?.consensusCount
                  ? enrichmentResults?.currentBackground?.pairedEnrich.consensusCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  ko: queryString.ko,
                  dir: queryString.dir,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                  fda: queryString.fda,
                });
              }}
            />
          ) : (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.pairedEnrich?.totalCount
                  ? enrichmentResults?.currentBackground?.pairedEnrich.totalCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  ko: queryString.ko,
                  dir: queryString.dir,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                  fda: queryString.fda,
                });
              }}
            />
          )}
        </div>
      ) : null}
      </>)}
      <SignaturesModal
        signatures={sigModalData?.signatures}
        drug={sigModalData?.drug || ""}
        showModal={!!sigModalData}
        setShowModal={(show) => { if (!show) setSigModalData(null); }}
      />
    </div>
  );
}

function GeneSetModalWrapper(props: {
  modalGeneSet: GeneSetModalT;
  setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>>;
}) {
  const { data: geneSet } = useGeneSetGenesByIdQuery({
    skip: props.modalGeneSet?.type !== "GeneSet",
    variables:
      props.modalGeneSet?.type === "GeneSet"
        ? {
            id: props.modalGeneSet.id,
          }
        : undefined,
  });
  const { data: overlapUpUp } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlapMimicker",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlapMimicker"
        ? {
            id: props.modalGeneSet.idUp,
            genes: props.modalGeneSet?.genesUp,
          }
        : undefined,
  });
  const { data: overlapDownDown } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlapMimicker",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlapMimicker"
        ? {
            id: props.modalGeneSet.idDown,
            genes: props.modalGeneSet?.genesDown,
          }
        : undefined,
  });
  const { data: overlapUpDown } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlapReverser",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlapReverser"
        ? {
            id: props.modalGeneSet.idUp,
            genes: props.modalGeneSet?.genesDown,
          }
        : undefined,
  });
  const { data: overlapDownUp } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlapReverser",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlapReverser"
        ? {
            id: props.modalGeneSet.idDown,
            genes: props.modalGeneSet?.genesUp,
          }
        : undefined,
  });
  const { data: userGeneSetUp } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== "UserGeneSets",
    variables:
      props.modalGeneSet?.type === "UserGeneSets"
        ? {
            genes: props.modalGeneSet.genesUp,
          }
        : undefined,
  });
  const { data: userGeneSetDown } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== "UserGeneSets",
    variables:
      props.modalGeneSet?.type === "UserGeneSets"
        ? {
            genes: props.modalGeneSet.genesDown,
          }
        : undefined,
  });
  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      dataset={props.modalGeneSet?.type !== "UserGeneSets" ? props.modalGeneSet?.library : undefined}
      geneset={
        props.modalGeneSet?.type === "GeneSet"
          ? geneSet?.geneSet?.genes.nodes
          : props.modalGeneSet?.type === "GeneSetOverlapMimicker"
          ? overlapUpUp?.geneSet?.overlap.nodes.concat(overlapDownDown?.geneSet?.overlap.nodes ?? [])
          : props.modalGeneSet?.type === "GeneSetOverlapReverser"
          ? overlapUpDown?.geneSet?.overlap.nodes.concat(overlapDownUp?.geneSet?.overlap.nodes ?? [])
          : props.modalGeneSet?.type === "UserGeneSets"
          ? userGeneSetUp?.geneMap2?.nodes
            ? userGeneSetUp.geneMap2.nodes.map(({ gene, geneInfo }) => ({
                gene,
                ...geneInfo,
              }))
            : props.modalGeneSet.genesUp.map((symbol) => ({ symbol }))
          : undefined
      }
      geneset2={
        props.modalGeneSet?.type === "UserGeneSets"
          ? userGeneSetDown?.geneMap2?.nodes
            ? userGeneSetDown.geneMap2.nodes.map(({ gene, geneInfo }) => ({
                gene,
                ...geneInfo,
              }))
            : props.modalGeneSet.genesUp.map((symbol) => ({ symbol }))
          : undefined
      }
      setShowModal={(show) => {
        if (!show) props.setModalGeneSet(undefined);
      }}
    />
  );
}

export default function EnrichClientPage({
  searchParams,
}: {
  searchParams: {
    dataset: string | string[] | undefined;
    libraries?: string;
  };
}) {
  const datasetUp = ensureArray(searchParams.dataset)[0];
  const datasetDown = ensureArray(searchParams.dataset)[1];

  // Parse libraries from URL params (comma-separated)
  // null means no filter (use all libraries), array means filter to those libraries
  const libraryNames = React.useMemo(() => {
    if (searchParams.libraries) {
      const libs = searchParams.libraries.split(',').filter(Boolean);
      return libs.length > 0 ? libs : null;
    }
    return null;
  }, [searchParams.libraries]);

  const { data: userGeneSetUp } = useFetchUserGeneSetQuery({
    skip: !datasetUp,
    variables: { id: datasetUp },
  });

  const { data: userGeneSetDown } = useFetchUserGeneSetQuery({
    skip: !datasetDown,
    variables: { id: datasetDown },
  });
  const [modalGeneSet, setModalGeneSet] = React.useState<GeneSetModalT>();
  const router = useRouter();

  const allGenes = userGeneSetDown?.userGeneSet?.genes?.filter((gene): gene is string => !!gene).concat(
    userGeneSetUp?.userGeneSet?.genes?.filter((gene): gene is string => !!gene) || []
  )

    const { data: userGeneSetInfo } = useFetchGeneInfoQuery({
        skip: !datasetDown,
        variables: {genes: allGenes || []}
    });

    const nGenesIncluded = userGeneSetInfo?.geneMap2?.nodes.filter(g => g.geneInfo?.symbol).length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-2 alert">
        <button
          className="btn btn-sm btn-outline"
          title="Return to input form with your current gene set and library selections"
          onClick={() => {
            const params = new URLSearchParams()
            params.append('dataset', datasetUp)
            params.append('dataset', datasetDown)
            if (libraryNames && libraryNames.length > 0) {
              params.set('libraries', libraryNames.join(','))
            }
            router.push(`/?${params.toString()}`)
          }}
        >
          ← Recompute
        </button>
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={(evt) => {
            setModalGeneSet({
              type: "UserGeneSets",
              genesUp: (userGeneSetUp?.userGeneSet?.genes ?? []).filter(
                (gene): gene is string => !!gene
              ),
              genesDown: (userGeneSetDown?.userGeneSet?.genes ?? []).filter(
                (gene): gene is string => !!gene
              ),
              description: userGeneSetUp?.userGeneSet?.description + " & " + userGeneSetDown?.userGeneSet?.description || "Up & Down Gene Sets",
            });
          }}
        >
          {(userGeneSetUp && userGeneSetDown) ? (userGeneSetUp?.userGeneSet?.description + " & " + userGeneSetDown?.userGeneSet?.description) : "Up & Down Gene Sets"}
          {userGeneSetUp ? (
            <> ({nGenesIncluded} of {(userGeneSetUp?.userGeneSet?.genes?.length || 0) + (userGeneSetDown?.userGeneSet?.genes?.length || 0)} submitted genes were mapped to genes in the Perturb-Seqr background)</>
          ) : null}
        </label>
      </div>
      {libraryNames && libraryNames.length > 0 && (
        <span className="text-sm text-base-content/70 ml-2">
          | Filtering: {libraryNames.length} dataset{libraryNames.length > 1 ? 's' : ''}
        </span>
      )}
      <EnrichmentResults
        userGeneSetUp={userGeneSetUp}
        userGeneSetDown={userGeneSetDown}
        setModalGeneSet={setModalGeneSet}
        datasetUp={datasetUp}
        datasetDown={datasetDown}
        libraryNames={libraryNames}
      />
      <GeneSetModalWrapper
        modalGeneSet={modalGeneSet}
        setModalGeneSet={setModalGeneSet}
      />
    </div>
  );
}
