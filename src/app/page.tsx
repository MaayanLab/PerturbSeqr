"use client"
import React from "react";
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
 * Output: Renders input card, library filter, and dataset icons side by side
 */
export default function Home() {
  const [inputSingle, setInputSingle] = React.useState(true)
  // State for selected libraries - passed to enrich page via URL params
  const [selectedLibraries, setSelectedLibraries] = React.useState<string[]>([])

  return (
    <div className="flex flex-col items-center">
      {/* Header with stats */}
      <h1 className="text-2xl font-bold mb-4">
        PerturbSeqr: Search through <Stats bold show_gene_sets />
      </h1>
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
              <InputForm setInputSingle={setInputSingle} selectedLibraries={selectedLibraries} />
            ) : (
              <InputFormUpDown setInputSingle={setInputSingle} selectedLibraries={selectedLibraries} />
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
