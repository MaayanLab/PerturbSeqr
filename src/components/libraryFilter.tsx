'use client'
import React from 'react'
import libraryConfig from '@/config/libraries.json'

const libraries = Object.values(libraryConfig.libraries) as { displayName: string; category: string }[]
const DRUG_PERTURBATION_LIBRARIES = libraries.filter(l => l.category === 'drug').map(l => l.displayName)
const GENE_PERTURBATION_LIBRARIES = libraries.filter(l => l.category === 'gene').map(l => l.displayName)

/**
 * LibraryFilter component - Displays toggles to filter search by dataset/library
 * Input props:
 *   - selectedLibraries: Array of currently selected library names
 *   - onSelectionChange: Callback function when selection changes
 *   - compact: If true, renders a more compact version for dropdown use
 * Output: Renders checkbox toggles for each available library as a vertical sidebar,
 *         separated into Drug/Chemical and Gene Perturbation sections
 */
export default function LibraryFilter({
  selectedLibraries,
  onSelectionChange,
  compact = false
}: {
  selectedLibraries: string[]
  onSelectionChange: (libraries: string[]) => void
  compact?: boolean
}) {
  const drugLibraries = DRUG_PERTURBATION_LIBRARIES
  const geneLibraries = GENE_PERTURBATION_LIBRARIES

  /**
   * Handle toggle change for a single library
   */
  const handleToggle = (libraryName: string) => {
    if (selectedLibraries.includes(libraryName)) {
      onSelectionChange(selectedLibraries.filter(name => name !== libraryName))
    } else {
      onSelectionChange([...selectedLibraries, libraryName])
    }
  }

  /**
   * Toggle all libraries in a category on or off
   */
  const handleToggleCategory = (categoryLibraries: string[]) => {
    const allSelected = categoryLibraries.every(name => selectedLibraries.includes(name))

    if (allSelected) {
      // Deselect all in this category
      onSelectionChange(selectedLibraries.filter(name => !categoryLibraries.includes(name)))
    } else {
      // Select all in this category
      const newSelection = new Set([...selectedLibraries, ...categoryLibraries])
      onSelectionChange(Array.from(newSelection))
    }
  }

  /**
   * Check if all libraries in a category are selected
   */
  const isCategoryAllSelected = (categoryLibraries: string[]) => {
    return categoryLibraries.length > 0 &&
      categoryLibraries.every(name => selectedLibraries.includes(name))
  }

  /**
   * Render a library checkbox
   */
  const renderLibraryCheckbox = (libraryName: string) => (
    <label key={libraryName} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="checkbox checkbox-xs"
        checked={selectedLibraries.includes(libraryName)}
        onChange={() => handleToggle(libraryName)}
      />
      <span className="text-xs">{libraryName}</span>
    </label>
  )

  /**
   * Render a category section with header and library list
   */
  const renderCategory = (title: string, categoryLibraries: string[]) => {
    if (categoryLibraries.length === 0) return null

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-xs text-base-content/70">{title}</span>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-xs px-1"
            onClick={() => handleToggleCategory(categoryLibraries)}
          >
            {isCategoryAllSelected(categoryLibraries) ? 'None' : 'All'}
          </button>
        </div>
        <div className="flex flex-col gap-1 ml-1">
          {categoryLibraries.map(renderLibraryCheckbox)}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-base-100 h-full ${compact ? 'rounded-lg border' : 'card shadow-2xl'}`}>
      <div className={`flex flex-col gap-3 ${compact ? 'p-3 max-h-80 overflow-y-auto' : 'card-body p-4'}`}>
        {renderCategory('Drug/Chemical Perturbation', drugLibraries)}
        {renderCategory('Gene Perturbation', geneLibraries)}
        {compact && selectedLibraries.length > 0 && (
          <button
            type="button"
            className="btn btn-xs btn-ghost text-xs"
            onClick={() => onSelectionChange([])}
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
