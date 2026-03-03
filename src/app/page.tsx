"use client"
import React, { Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import Image from "next/image";
import InputForm from "./inputForm";
import InputFormUpDown from "./inputFormUpDown";
import LibraryFilter from "@/components/libraryFilter";
import DatasetIcons, { resourceCount, libraryCount, drugLibraryCount, geneLibraryCount } from "@/components/datasetIcons";
import Stats from "@/components/stats";
import libraryConfig from '@/config/libraries.json';

// Get all library display names for default selection
const allLibraries = Object.values(libraryConfig.libraries).map((l: any) => l.displayName as string);

/**
 * Home page component - Gene set input with library filter
 * State:
 *   - inputSingle: Toggle between single gene set and up/down input modes
 *   - selectedLibraries: Array of selected library names for filtering enrichment results
 * Output: Renders input card, library filter, and dataset icons side by side
 */
function HomeContent() {
  const searchParams = useSearchParams()
  const datasetIds = searchParams?.getAll('dataset') ?? []
  const librariesParam = searchParams?.get('libraries') ?? null

  const [inputSingle, setInputSingle] = React.useState(datasetIds.length !== 2)
  // State for selected libraries - passed to enrich page via URL params
  // Default to all libraries selected, or restore from URL params when returning from results
  const [selectedLibraries, setSelectedLibraries] = React.useState<string[]>(() => {
    if (librariesParam) {
      const libs = librariesParam.split(',').filter(Boolean)
      return libs.length > 0 ? libs : allLibraries
    }
    return allLibraries
  })

  return (
    <div className="flex flex-col items-center">
      {/* Header with stats */}
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-4xl font-bold">Perturb-Seqr</h1>
        <Image
          className="dark:invert"
          src="/images/perturbseqr-logo.png"
          alt="Perturb-Seqr logo"
          width={60}
          height={90}
        />
      </div>
      <p className="text-center text-base mb-4 max-w-2xl">
        Search through <Stats show_gene_sets bold /> created from {resourceCount} Connectivity Mapping resources organized into {libraryCount} gene set libraries, {drugLibraryCount} drug perturbation and {geneLibraryCount} gene perturbation followed by expression.
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
            {inputSingle ? (
              <InputForm
                setInputSingle={setInputSingle}
                selectedLibraries={selectedLibraries}
                initialDatasetId={datasetIds.length === 1 ? datasetIds[0] : undefined}
              />
            ) : (
              <InputFormUpDown
                setInputSingle={setInputSingle}
                selectedLibraries={selectedLibraries}
                initialDatasetUpId={datasetIds.length >= 2 ? datasetIds[0] : undefined}
                initialDatasetDownId={datasetIds.length >= 2 ? datasetIds[1] : undefined}
              />
            )}
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
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
