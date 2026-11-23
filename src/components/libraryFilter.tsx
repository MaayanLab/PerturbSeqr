'use client'
import React from 'react'
import useLibraryCatalog from '@/utils/useLibraryCatalog'
import { useAllLibrariesQuery } from '@/graphql'


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
  compact = false,
  category,
}: {
  selectedLibraries: string[]
  onSelectionChange: (libraries: string[]) => void
  compact?: boolean
  category?: 'drug' | 'gene'
}) {
  const { drugNames, geneNames, libraries, filterLabels } = useLibraryCatalog()
  const drugLibraries = category === 'gene' ? [] : drugNames
  const geneLibraries = category === 'drug' ? [] : geneNames

  const { data: libraryData } = useAllLibrariesQuery()
  const signatureCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    libraryData?.geneSetLibraries?.nodes.forEach(node => {
      counts[node.name] = node.geneSetsByLibraryId.totalCount
    })
    libraries.forEach(library => {
      // Legacy revisions can gain signatures after the migration snapshot.
      if (library.counts.geneSets != null && (!library.manifest.legacy || counts[library.name] == null)) {
        counts[library.name] = library.counts.geneSets
      }
    })
    return counts
  }, [libraryData, libraries])

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
  const renderLibraryCheckbox = (libraryName: string) => {
    const count = signatureCounts[libraryName]
    const label = filterLabels.get(libraryName) ?? libraryName
    return (
      <label key={libraryName} className="flex min-w-0 items-center gap-2 cursor-pointer" title={label}>
        <input
          type="checkbox"
          className="checkbox checkbox-sm shrink-0"
          checked={selectedLibraries.includes(libraryName)}
          onChange={() => handleToggle(libraryName)}
        />
        <span className="flex min-w-0 items-baseline text-sm">
          <span className="truncate">{label}</span>
          {count != null && <span className="ml-1 shrink-0 whitespace-nowrap text-xs text-base-content/50">({count.toLocaleString()} signatures)</span>}
        </span>
      </label>
    )
  }

  /**
   * Render a category section with header and library list
   */
  const renderCategory = (title: string, categoryLibraries: string[]) => {
    if (categoryLibraries.length === 0) return null
    const categoryTotal = categoryLibraries.reduce((sum, name) => sum + (signatureCounts[name] ?? 0), 0)

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base text-base-content">
            {title}
            {categoryTotal > 0 && <span className="text-xs font-normal text-base-content/50 ml-1">({categoryTotal.toLocaleString()})</span>}
          </span>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-xs px-1"
            onClick={() => handleToggleCategory(categoryLibraries)}
          >
            {isCategoryAllSelected(categoryLibraries) ? 'None' : 'All'}
          </button>
        </div>
        <div className="flex flex-col gap-2 ml-1">
          {categoryLibraries.map(renderLibraryCheckbox)}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-base-100 h-full ${compact ? 'rounded-lg border' : 'card shadow-2xl'}`}>
      <div className={`flex flex-col gap-4 h-full ${compact ? 'p-3 max-h-80 overflow-y-auto' : 'card-body p-4'}`}>
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
