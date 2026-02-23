"use client";
import React from "react";
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchGeneInfoQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useGeneSetGenesByIdQuery,
} from "@/graphql";
import ensureArray from "@/utils/ensureArray";
import Loading from "@/components/loading";
import Pagination from "@/components/pagination";
import DownloadButton from "@/components/downloadButton";
import useQsState from "@/utils/useQsState";
import Stats from "@/components/stats";
import Image from "next/image";
import GeneSetModal from "@/components/geneSetModal";
import { FaFilter, FaSortUp } from "react-icons/fa6";
import { IoMdInformationCircleOutline } from "react-icons/io";
import { parseTerm } from "@/utils/parseTerm";
import { preloadMetadata, enrichWithMetadataSync, preloadDrugLookup, getDrugInfo, getPerturbationUrl, getPerturbationLinkTitle, isGenePerturbationLibrary, getDatasetUrl } from "@/utils/metadataLookup";
import { useRouter } from "next/navigation";

const pageSize = 12;

type GeneSetModalT =
  | {
      type: "UserGeneSet";
      description: string;
      genes: string[];
    }
  | {
      type: "GeneSetOverlap";
      id: string;
      description: string;
      genes: string[];
      library?: string;
    }
  | {
      type: "GeneSet";
      id: string;
      description: string;
      library?: string;
    }
  | undefined;

/**
 * EnrichmentResults component - Displays enrichment analysis results
 * Input props:
 *   - userGeneSet: The user's uploaded gene set data
 *   - setModalGeneSet: Function to set the modal gene set for viewing details
 *   - libraryNames: Optional array of library names to filter enrichment (null = all libraries)
 * Output: Renders enrichment results table with pagination and filtering
 */
function EnrichmentResults({
  userGeneSet,
  setModalGeneSet,
  libraryNames,
}: {
  userGeneSet?: FetchUserGeneSetQuery;
  setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>>;
  libraryNames: string[] | null;
}) {
  const genes = React.useMemo(
    () =>
      ensureArray(userGeneSet?.userGeneSet?.genes)
        .filter((gene): gene is string => !!gene)
        .map((gene) => gene.toUpperCase()),
    [userGeneSet]
  );
  const [queryString, setQueryString] = useQsState({
    page: "1",
    q: "",
    dir: "",
    fda: "false",
    consensus: "false",
    moas: "false",
    sort: "pvalue",
    ko: "false",
    topn: "10000",
    pvaluele: "0.05",
  });
  const [rawTerm, setRawTerm] = React.useState("");
  const [topNSlider, setTopNSlider] = React.useState(10000);
  const [pvalueLeSlider, setPvalueLeSlider] = React.useState(0.05);
  const [metadataLoaded, setMetadataLoaded] = React.useState(false);
  const [drugLookupLoaded, setDrugLookupLoaded] = React.useState(false);

  const { page, term, fda, consensus, moas, sort, ko, topN, pvalueLe } =
    React.useMemo(
      () => ({
        page: queryString.page ? +queryString.page : 1,
        term: queryString.q ?? "",
        fda: queryString.fda === "true",
        consensus: queryString.consensus === "true",
        moas: queryString.moas === "true",
        sort: queryString.sort,
        ko: queryString.ko === "true",
        topN: parseInt(queryString?.topn ?? "10000"),
        pvalueLe: parseFloat(queryString?.pvaluele ?? "0.05"),
      }),
      [queryString]
    );
  // Query enrichment results
  const { data: enrichmentResults, error } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: {
      genes,
      filterTerm: term + " " + queryString.dir,
      libraryNames: libraryNames,
      offset: (page - 1) * pageSize,
      first: pageSize,
      filterFda: fda,
      sortBy: sort,
      filterKo: ko,
      topN: topN,
      pvalueLe: pvalueLe,
    },
  });

  console.log(enrichmentResults)

  React.useEffect(() => {
    console.log(term);
    setRawTerm(term);
  }, [term]);

  // Preload metadata and drug lookup for libraries in the filter (if any)
  React.useEffect(() => {
    const loadData = async () => {
      await preloadDrugLookup();
      setDrugLookupLoaded(true);
      if (libraryNames && libraryNames.length > 0) {
        await preloadMetadata(libraryNames);
      }
      setMetadataLoaded(true);
    };
    loadData();
  }, [libraryNames]);

  // Compute column visibility - hide columns that are entirely N/A on current page
  const columnVisibility = React.useMemo(() => {
    const nodes = enrichmentResults?.currentBackground?.enrich?.nodes;
    if (!nodes) return { cellLine: true, timepoint: true, concentration: true };
    let hasCellLine = false, hasTimepoint = false, hasConcentration = false;
    for (const node of nodes) {
      const term = node?.geneSets.nodes[0].term;
      const libraryName = node?.geneSets.nodes[0].library?.name || '';
      const baseParsed = term ? parseTerm(term, libraryName) : {};
      const parsed = metadataLoaded ? enrichWithMetadataSync(baseParsed, libraryName) : baseParsed;
      if (parsed.cellLine && parsed.cellLine !== 'N/A') hasCellLine = true;
      if (parsed.timepoint && parsed.timepoint !== 'N/A') hasTimepoint = true;
      if (parsed.concentration && parsed.concentration !== 'N/A') hasConcentration = true;
      if (hasCellLine && hasTimepoint && hasConcentration) break;
    }
    return { cellLine: hasCellLine, timepoint: hasTimepoint, concentration: hasConcentration };
  }, [enrichmentResults, metadataLoaded]);

  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        {!enrichmentResults?.currentBackground?.enrich && !error ? (
          <>
            Rummaging through <Stats show_gene_sets />.
          </>
        ) : (
          <>
            {consensus ? (
              <>
                After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.geneSetCount || 0)} gene sets.{" "}
                PerturbSeqr{" "}
                <Image
                  className="inline-block rounded dark:invert"
                  src="/images/perturbseqr-logo.png"
                  width={50}
                  height={50}
                  alt="PerturbSeqr"
                ></Image>{" "}
                computed significance for{" "}
                {Intl.NumberFormat("en-US", {}).format(
                  enrichmentResults?.currentBackground?.enrich
                    ?.consensusCount || 0
                )}{" "}
                consensus perturbations.
              </>
            ) : moas ? <>
            After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.geneSetCount || 0)} gene sets.{" "}
                PerturbSeqr{" "}
                <Image
                  className="inline-block rounded dark:invert"
                  src="/images/perturbseqr-logo.png"
                  width={50}
                  height={50}
                  alt="PerturbSeqr"
                ></Image>{" "}
                computed significance for{" "}
                {Intl.NumberFormat("en-US", {}).format(
                  enrichmentResults?.currentBackground?.enrich
                    ?.moasCount || 0
                )}{" "}
                consensus MoAs.</>
            : (
              <>
                After rummaging through {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.geneSetCount || 0)} gene sets.{" "}
                PerturbSeqr{" "}
                <Image
                  className="inline-block rounded dark:invert"
                  src="/images/perturbseqr-logo.png"
                  width={50}
                  height={50}
                  alt="PerturbSeqr"
                ></Image>{" "}
                found{" "}
                {Intl.NumberFormat("en-US", {}).format(
                  enrichmentResults?.currentBackground?.enrich?.totalCount || 0
                )}{" "}
                statistically significant matches.
              </>
            )}
          </>
        )}
      </h2>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-2">
        <button
          onClick={() => {
            if (queryString.fda === "false")
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: "true",
                consensus: queryString.consensus,
                moas: queryString.moas,
                dir: queryString.dir,
                ko: "false",
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: "false",
                dir: queryString.dir,
                consensus: queryString.consensus,
                moas: queryString.moas,
                ko: queryString.ko,
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.fda === "true"
              ? "button btn btn-sm bg-gray-600 hover:bg-gray-800"
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
                q: rawTerm,
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
                q: rawTerm,
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
              ? "button btn btn-sm bg-gray-600 hover:bg-gray-800"
              : "button btn btn-sm"
          }
        >
          Consensus Perturbations
        </button>
        <button
          onClick={() => {
            if (queryString.moas === "false")
              setQueryString({
                page: "1",
                q: rawTerm,
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
                q: rawTerm,
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
              ? "button btn btn-sm bg-gray-600 hover:bg-gray-800"
              : "button btn btn-sm"
          }
        >
          Consensus MoAs
        </button>

        {/* TODO: Implement perturbation type filter by library prefix
            Drug libraries: l1000-cp, l1000-sigs, tahoe-100m, Novartis DRUG-seq, cmap-build02, ginkgo, sciplex, deepcovermoa, geo-chem
            Gene libraries: l1000crispr, perturbatlas, perturbatlasmouse, reploglek562*, reploglerpe1*, geogene
        */}
        <div
          id="ptype-select"
          className="join place-content-start place-items-center mr-4 opacity-50"
        >
          <div
            className="join-item px-3 py-1.5 bg-gray-100 font-bold text-sm dark:bg-gray-900 cursor-not-allowed"
          >
            DRUG
          </div>
          <div
            className="join-item px-3 py-1.5 bg-gray-100 font-bold text-sm dark:bg-gray-900 cursor-not-allowed"
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
              queryString.dir == "up"
                ? "join-item px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-800 font-bold cursor-pointer"
                : "join-item px-3 py-1.5  bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "up")
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "up",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            UP
          </div>
          <div
            className={
              queryString.dir == "down"
                ? "join-item px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-800 font-bold cursor-pointer"
                : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "down")
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "down",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            DOWN
          </div>
        </div>
        {(consensus || moas) ? <div className="inline-flex items-center transition-all accent-gray-600">
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
                  q: rawTerm,
                  dir: queryString.dir,
                  fda: queryString.fda,
                  consensus: queryString.consensus,
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
        </div> : 
        <></>}
        </div>
        <form
          id="search-form"
          className="join flex flex-row place-content-end place-items-center overflow-visible"
          onSubmit={(evt) => {
            evt.preventDefault();
            setQueryString({
              page: "1",
              q: rawTerm,
              fda: queryString.fda,
              consensus: queryString.consensus,
              dir: queryString.dir,
              ko: queryString.ko,
              sort: queryString.sort,
              topn: queryString.topn,
              pvaluele: queryString.pvaluele,
            });
          }}
        >
          <input
            type="text"
            className="input input-bordered join-item"
            value={rawTerm}
            onChange={(evt) => {
              setRawTerm(evt.currentTarget.value);
            }}
          />
          <div className="tooltip" data-tip="Search results">
            <button type="submit" className="btn join-item">
              &#x1F50D;
            </button>
          </div>
          <div className="tooltip" data-tip="Clear search">
            <button
              type="reset"
              className="btn join-item"
              onClick={(evt) => {
                setQueryString({
                  page: "1",
                  q: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  dir: queryString.dir,
                  ko: queryString.ko,
                  sort: queryString.sort,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              }}
            >
              &#x232B;
            </button>
          </div>
          <DownloadButton queryString={queryString}></DownloadButton>
        </form>
      </div>
      <div className="overflow-x-auto -mx-8 md:-mx-24 px-2">
        {consensus || moas ? (
          <>
            <table className="table table-sm">
              <thead>
                <tr className="text-left align-text-bottom">
                  <th>{consensus ? "Perturbation" : "MoA"}</th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Reflecting if there are more significant up or down
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
                      significant up signatures, and the number of significant
                      down signatures,
                      <br /> the number of insignificant up signatures, and the
                      number of insignificant down signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
                          sort: "pvalue_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Up <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Up p-values adjusted using the Benjamini-Hochberg method
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
                          sort: "adj_pvalue_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      AdjPValue
                      <br />
                      Up <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
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
                      Up <FaSortUp />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant down signatures, and the number of significant
                      up signatures,
                      <br /> the number of insignificant down signatures, and
                      the number of insignificant up signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
                          sort: "pvalue_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Down <FaSortUp />
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
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
                          sort: "adj_pvalue_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      AdjPValue
                      <br />
                      Down <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
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
                      Down <FaSortUp />
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
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
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
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          moas: queryString.moas,
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
                {!enrichmentResults?.currentBackground?.enrich && !error ? (
                  <tr>
                    <td colSpan={100}>
                      <Loading />
                    </td>
                  </tr>
                ) : null}
                {(moas
                    ? enrichmentResults?.currentBackground?.enrich?.moas
                    : enrichmentResults?.currentBackground?.enrich?.consensus
                  )?.flatMap(
                  (enrichmentResult, genesetIndex) => {
                    var perturbation = enrichmentResult?.drug;
                    const cid = enrichmentResult?.cid;
                    if (perturbation?.includes(" ") && !moas)
                      perturbation = perturbation + " KO";
                    // Use direct PubChem link if CID available, otherwise search
                    const pubchemUrl = cid
                      ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
                      : `https://pubchem.ncbi.nlm.nih.gov/#query=${perturbation}`;
                    return (
                      <tr key={genesetIndex}>
                        <td>
                          {moas ? <span style={{textTransform: 'capitalize'}}>{perturbation}</span> : !perturbation?.includes("KO") ? (
                            <div>
                              {perturbation}
                              <a
                                className="underline cursor-pointer mx-2"
                                href={pubchemUrl}
                                target="_blank"
                                title={cid ? `PubChem CID: ${cid}` : 'Search PubChem'}
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/drug_vector_art.png"
                                  width={20}
                                  height={20}
                                  alt="PubChem"
                                />
                              </a>
                              {cid && (
                                <div className="text-xs text-gray-500">
                                  <span title="PubChem Compound ID">PCID:</span> {cid}
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              {perturbation}
                              <a
                                className="underline cursor-pointer mx-2"
                                href={`https://maayanlab.cloud/Harmonizome/gene/${perturbation.replace(
                                  " KO",
                                  ""
                                )}`}
                                target="_blank"
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/harmonizome_logo_30x26.png"
                                  width={20}
                                  height={20}
                                  alt="Harmonizome"
                                />
                              </a>
                              <a
                                className="underline cursor-pointer"
                                href={`https://maayanlab.cloud/prismexp/g/${perturbation.replace(
                                  " KO",
                                  ""
                                )}`}
                                target="_blank"
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/prismexp.png"
                                  width={20}
                                  height={20}
                                  alt="PrismEXP"
                                />
                              </a>
                            </>
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
                          {enrichmentResult?.countSignificant} (
                          {enrichmentResult?.countUpSignificant} Up,{" "}
                          {(enrichmentResult?.countSignificant || 0) -
                            (enrichmentResult?.countUpSignificant || 0)}{" "}
                          Down)
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
                    Preclinical compound, drug, or gene targeted by CRISPR KO
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
                <th>Direction</th>
                <th className="relative group">
                  <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Number of signatures for this perturbation contained within
                    the database
                  </div>
                  Signature<br></br>
                  <span className="inline-flex">
                    Count
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th>
                  MoA
                </th>
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
                <th>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "overlap",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    Overlap <FaSortUp />
                  </span>
                </th>
                <th>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "odds_ratio",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    Odds
                    <br />
                    Ratio <FaSortUp />
                  </span>
                </th>
                <th className="relative group">
                  <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    P-value computed using the Fisher&apos;s Exact Test
                  </div>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "pvalue",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    PValue <FaSortUp />
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th className="relative group">
                  <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Adjusted P-value computed using the Benjamini-Hochberg
                    procedure
                  </div>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "adj_pvalue",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    AdjPValue <FaSortUp />
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!enrichmentResults?.currentBackground?.enrich && !error ? (
                <tr>
                  <td colSpan={100}>
                    <Loading />
                  </td>
                </tr>
              ) : null}
              {enrichmentResults?.currentBackground?.enrich?.nodes?.flatMap(
                (enrichmentResult, genesetIndex) => {
                  const term = enrichmentResult?.geneSets.nodes[0].term;
                  const libraryName = enrichmentResult?.geneSets.nodes[0].library?.name || '';

                  // Parse term using the parseTerm utility
                  const baseParsed = term ? parseTerm(term, libraryName) : {};
                  // Enrich with external metadata (e.g., RummaGEO cell line/timepoint)
                  const parsed = metadataLoaded ? enrichWithMetadataSync(baseParsed, libraryName) : baseParsed;
                  const dataset = libraryName || parsed.library || '';
                  const direction = parsed.direction || '';
                  const perturbation = parsed.perturbation || parsed.raw || '';
                  const cellLine = parsed.cellLine || 'N/A';
                  const timepoint = parsed.timepoint || 'N/A';
                  const concentration = parsed.concentration || 'N/A';

                  // Check if this is a gene or drug perturbation library
                  const isGenePert = isGenePerturbationLibrary(libraryName);

                  // Get FDA data from database (via GraphQL)
                  const fdaData = enrichmentResult?.geneSets.nodes[0].geneSetFdaCountsById?.nodes[0];
                  const sigCount = fdaData?.count || 1;
                  const dbMoa = fdaData?.moa || '';
                  const approved = fdaData?.approved || false;

                  // Get additional drug info from JSON lookup (only for drug perturbations)
                  const drugInfo = !isGenePert && drugLookupLoaded
                    ? (getDrugInfo(perturbation) || getDrugInfo(parsed.nsn || ''))
                    : null;
                  const perturbationUrl = getPerturbationUrl(perturbation, libraryName);
                  const perturbationLinkTitle = getPerturbationLinkTitle(libraryName);
                  // Use database MOA first, fallback to JSON lookup (only for drugs)
                  const moa = isGenePert ? '' : (dbMoa || drugInfo?.moa || '');

                  if (!enrichmentResult?.geneSets) return null;
                  return (
                    <tr key={genesetIndex} className="text-left">
                      <td className={"hidden"}>{term}</td>
                      <td className="max-w-[120px]">
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
                      <td className={`max-w-[100px] ${columnVisibility.cellLine ? "" : "hidden"}`}>
                        {cellLine && cellLine !== 'N/A' ? (
                          <a
                            className="link link-neutral hover:link-hover cursor-pointer truncate block"
                            title={cellLine}
                            onClick={async (evt) => {
                              evt.preventDefault();
                              const res = await fetch("enrich/depmapcl", {
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
                      <td className={`max-w-[70px] ${columnVisibility.timepoint ? "" : "hidden"}`}>{timepoint === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={timepoint}>{timepoint}</span>}</td>
                      <td className={`max-w-[80px] ${columnVisibility.concentration ? "" : "hidden"}`}>{concentration === 'N/A' ? <span className="text-gray-400">N/A</span> : <span className="truncate block" title={concentration}>{concentration}</span>}</td>
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
                      <td>{sigCount}</td>
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
                              id: enrichmentResult?.geneSets.nodes[0].id,
                              description: term ?? "",
                              library: libraryName,
                            });
                          }}
                        >
                          {enrichmentResult?.geneSets.nodes[0].nGeneIds}
                        </label>
                      </td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSetOverlap",
                              id: enrichmentResult?.geneSets.nodes[0].id,
                              description: `${
                                userGeneSet?.userGeneSet?.description ||
                                "User gene set"
                              } & ${term || "PerturbSeqr gene set"}`,
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
                }
              )}
            </tbody>
          </table>
        )}
      </div>
      {enrichmentResults?.currentBackground?.enrich ? (
        <div className="w-full flex flex-col items-center">
          {consensus ? (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.enrich?.consensusCount
                  ? enrichmentResults?.currentBackground?.enrich.consensusCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
                  ko: queryString.ko,
                  dir: queryString.dir,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                  fda: queryString.fda,
                });
              }}
            />
          ) : moas ? (<Pagination
            page={page}
            totalCount={
              enrichmentResults?.currentBackground?.enrich?.moasCount
                ? enrichmentResults?.currentBackground?.enrich.moasCount
                : undefined
            }
            pageSize={pageSize}
            onChange={(page) => {
              setQueryString({
                page: `${page}`,
                q: term,
                consensus: queryString.consensus,
                moas: queryString.moas,
                ko: queryString.ko,
                dir: queryString.dir,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
                fda: queryString.fda,
              });
            }}
          />) : (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.enrich?.totalCount
                  ? enrichmentResults?.currentBackground?.enrich.totalCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  moas: queryString.moas,
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
  const { data: overlap } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlap",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlap"
        ? {
            id: props.modalGeneSet.id,
            genes: props.modalGeneSet?.genes,
          }
        : undefined,
  });

  const { data: userGeneSet } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== "UserGeneSet",
    variables:
      props.modalGeneSet?.type === "UserGeneSet"
        ? {
            genes: props.modalGeneSet.genes,
          }
        : undefined,
  });

  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      dataset={props.modalGeneSet?.type === "GeneSet" || props.modalGeneSet?.type === "GeneSetOverlap" ? props.modalGeneSet.library : undefined}
      geneset={
        props.modalGeneSet?.type === "GeneSet"
          ? geneSet?.geneSet?.genes.nodes
          : props.modalGeneSet?.type === "GeneSetOverlap"
          ? overlap?.geneSet?.overlap.nodes
          : props.modalGeneSet?.type === "UserGeneSet"
          ? (userGeneSet?.geneMap2?.nodes)
            ? userGeneSet.geneMap2.nodes.map(({ gene, geneInfo }) => ({
                gene,
                ...geneInfo,
              }))
            : props.modalGeneSet.genes.map((symbol) => ({ symbol }))
          : undefined
      }
      setShowModal={(show) => {
        if (!show) props.setModalGeneSet(undefined);
      }}
    />
  );
}

/**
 * EnrichClientPage - Main enrichment analysis page component
 * Input props:
 *   - searchParams: URL query params containing dataset ID and optional libraries filter
 * Output: Renders enrichment analysis interface
 * State:
 *   - modalGeneSet: Gene set currently shown in modal
 */
export default function EnrichClientPage({
  searchParams,
}: {
  searchParams: {
    dataset: string | string[] | undefined;
    libraries?: string;
  };
}) {
  const dataset = ensureArray(searchParams.dataset)[0];
  // Parse libraries from URL params (comma-separated)
  // null means no filter (use all libraries), array means filter to those libraries
  const libraryNames = React.useMemo(() => {
    if (searchParams.libraries) {
      const libs = searchParams.libraries.split(',').filter(Boolean);
      return libs.length > 0 ? libs : null;
    }
    return null;
  }, [searchParams.libraries]);
  const { data: userGeneSet } = useFetchUserGeneSetQuery({
    skip: !dataset,
    variables: { id: dataset },
  });

  const [modalGeneSet, setModalGeneSet] = React.useState<GeneSetModalT>();
  const router = useRouter();

  const { data: userGeneSetInfo } = useFetchGeneInfoQuery({
      skip: !dataset,
      variables: {genes: userGeneSet?.userGeneSet?.genes?.filter((gene): gene is string => !!gene) || []}
  });

  console.log(userGeneSetInfo)

  const nGenesIncluded = userGeneSetInfo?.geneMap2?.nodes.filter(g => g.geneInfo?.symbol).length
  return (
    <div className="flex flex-col gap-4">
      {/* Input info */}
      <div className="flex flex-row gap-2 alert">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => {
            const params = new URLSearchParams()
            params.set('dataset', dataset)
            if (libraryNames && libraryNames.length > 0) {
              params.set('libraries', libraryNames.join(','))
            }
            router.push(`/?${params.toString()}`)
          }}
        >
          ← Back
        </button>
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={(evt) => {
            setModalGeneSet({
              type: "UserGeneSet",
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter(
                (gene): gene is string => !!gene
              ),
              description: userGeneSet?.userGeneSet?.description || "Gene set",
            });
          }}
        >
          {userGeneSet?.userGeneSet?.description || "Gene set"}
          {userGeneSet ? (
            <> ({nGenesIncluded} of {userGeneSet?.userGeneSet?.genes?.length ?? "?"} submitted genes were mapped to genes in the PerturbSeqr background)</>
          ) : null}
        </label>
        {libraryNames && libraryNames.length > 0 && (
          <span className="text-sm text-base-content/70 ml-2">
            | Filtering: {libraryNames.length} dataset{libraryNames.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <EnrichmentResults
        userGeneSet={userGeneSet}
        setModalGeneSet={setModalGeneSet}
        libraryNames={libraryNames}
      />
      <GeneSetModalWrapper
        modalGeneSet={modalGeneSet}
        setModalGeneSet={setModalGeneSet}
      />
    </div>
  );
}
