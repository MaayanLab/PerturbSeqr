"use client"
import React from "react";
import Image from 'next/image';
import InputForm from "./inputForm";
import InputFormUpDown from "./inputFormUpDown";
import LibraryFilter from "@/components/libraryFilter";
import DatasetIcons from "@/components/datasetIcons";
import Stats from "@/components/stats";

/**
 * Home page component - Gene set input with library filter
 * State:
 *   - inputSingle: Toggle between single gene set and up/down input modes
 *   - selectedLibraries: Array of selected library names for filtering enrichment results
 * Output: Renders input card and library filter side by side, with info section below
 */
export default function Home() {
  const [inputSingle, setInputSingle] = React.useState(true)
  // State for selected libraries - passed to enrich page via URL params
  const [selectedLibraries, setSelectedLibraries] = React.useState<string[]>([])

  return (
    <div className="flex justify-center">
      {/* All three sections in one horizontal row */}
      <div className="flex flex-row gap-4 items-start">
        {/* Input card */}
        <div className="card max-w-xs shadow-2xl bg-base-100 flex-shrink-0">
          <div className="card-body">
            {inputSingle ? (
              <InputForm setInputSingle={setInputSingle} selectedLibraries={selectedLibraries} />
            ) : (
              <InputFormUpDown setInputSingle={setInputSingle} selectedLibraries={selectedLibraries} />
            )}
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
}
