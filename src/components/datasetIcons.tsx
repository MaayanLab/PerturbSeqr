'use client'
import React from 'react'
import Image from 'next/image'
import libraryConfig from '@/config/libraries.json'

// Map dataset keys to their logo files
// Some datasets share logos (e.g., L1000-CP and L1000-XPR both use LINCS logo)
const logoMap: Record<string, { src: string; darkSrc?: string; type: 'image' | 'svg' }> = {
  'Tahoe-100M': { src: '/images/tahoe-logo-new.png', type: 'image' },
  'LINCS L1000 CP': { src: '/images/lincs-logo.png', type: 'image' },
  'LINCS L1000 XPR': { src: '/images/lincs-logo.png', type: 'image' },
  'Microarrays CMap': { src: '/images/cmap-logo.svg', type: 'svg' },
  'NIBR DRUG-seq': { src: '/images/nibr-logo.png', type: 'image' },
  'SciPlex': { src: '/images/sciplex-logo.svg', darkSrc: '/images/sciplex-logo-dark.svg', type: 'svg' },
  'DeepCover MoA': { src: '/images/deepcovermoa-logo.png', type: 'image' },
  'GEO-Chem': { src: '/images/geo-logo.svg', type: 'svg' },
  'GEO-Gene': { src: '/images/geo-logo.svg', type: 'svg' },
  'RummaGEO Chem': { src: '/images/rummageo-logo.png', type: 'image' },
  'RummaGEO Gene': { src: '/images/rummageo-logo.png', type: 'image' },
  'Ginkgo Bioworks': { src: '/images/ginkgo-logo.png', type: 'image' },
  'Perturb Atlas': { src: '/images/perturbatlas-logo.png', type: 'image' },
  'Perturb Atlas Mouse': { src: '/images/perturbatlas-logo.png', type: 'image' },
  'Replogle K562 Essential': { src: '/images/replogle-logo.svg', type: 'svg' },
  'Replogle K562 Genome-wide': { src: '/images/replogle-logo.svg', type: 'svg' },
  'Replogle RPE1 Essential': { src: '/images/replogle-logo.svg', type: 'svg' },
  'CM4AI': { src: '/images/cm4ai-logo.png', type: 'image' },
}

// Subtitle overrides for groups with multiple datasets sharing a logo
const groupSubtitles: Record<string, string> = {
  '/images/lincs-logo.png': 'lincs l1000',
  '/images/geo-logo.svg': 'geo',
  '/images/rummageo-logo.png': 'rummageo',
  '/images/perturbatlas-logo.png': 'perturb atl',
  '/images/replogle-logo.svg': 'replogle',
  '/images/nibr-logo.png': 'nibr d-seq',
  '/images/cmap-logo.svg': 'cmap arrays',
  '/images/tahoe-logo-new.png': 'tahoe-100m',
  '/images/sciplex-logo.svg': 'sciplex',
  '/images/deepcovermoa-logo.png': 'deepcover',
  '/images/ginkgo-logo.png': 'ginkgo bio',
  '/images/cm4ai-logo.png': 'cm4ai',
}

// Get all library display names
const allLibraries = Object.values(libraryConfig.libraries).map((l: any) => l.displayName as string)

// Group libraries by their logo (for shared logos like LINCS, GEO, PerturbAtlas, Replogle)
const logoGroups: { logo: string; darkLogo?: string; libraries: string[]; subtitle: string }[] = []
const seenLogos = new Set<string>()

allLibraries.forEach(name => {
  const logoInfo = logoMap[name]
  if (logoInfo && !seenLogos.has(logoInfo.src)) {
    seenLogos.add(logoInfo.src)
    // Find all libraries that share this logo
    const sharedLibraries = allLibraries.filter(lib => logoMap[lib]?.src === logoInfo.src)
    // Use group subtitle override, or the single library name if only one
    const subtitle = groupSubtitles[logoInfo.src] || sharedLibraries[0]
    logoGroups.push({ logo: logoInfo.src, darkLogo: logoInfo.darkSrc, libraries: sharedLibraries, subtitle })
  }
})

export const resourceCount = logoGroups.length

/**
 * DatasetIcons component - Clickable logo filter for datasets
 * Similar to enrichr-kg header icon bar
 * Input props:
 *   - selectedLibraries: Array of currently selected library names
 *   - onSelectionChange: Callback function when selection changes
 * Output: Grid of clickable dataset logos with visual selection state
 */
export default function DatasetIcons({
  selectedLibraries = [],
  onSelectionChange = () => {},
}: {
  selectedLibraries?: string[]
  onSelectionChange?: (libraries: string[]) => void
}) {
  // Check if any library in a group is selected
  const isGroupSelected = (libraries: string[]) => {
    return libraries.some(lib => selectedLibraries.includes(lib))
  }

  // Check if ALL libraries in a group are selected
  const isGroupFullySelected = (libraries: string[]) => {
    return libraries.every(lib => selectedLibraries.includes(lib))
  }

  // Toggle all libraries in a group
  const handleToggleGroup = (libraries: string[]) => {
    const allSelected = isGroupFullySelected(libraries)

    if (allSelected) {
      // Deselect all in this group
      onSelectionChange(selectedLibraries.filter(lib => !libraries.includes(lib)))
    } else {
      // Select all in this group
      const newSelection = new Set([...selectedLibraries, ...libraries])
      onSelectionChange(Array.from(newSelection))
    }
  }

  // Determine button style based on selection state
  const getButtonStyle = (libraries: string[]) => {
    const hasAnySelection = selectedLibraries.length > 0
    const isSelected = isGroupSelected(libraries)

    if (!hasAnySelection) {
      return 'opacity-100' // All enabled when nothing selected
    } else if (isSelected) {
      return 'opacity-100 ring-2 ring-neutral bg-base-200' // Active/selected
    } else {
      return 'opacity-40' // Disabled/dimmed
    }
  }

  return (
    <div className="flex flex-col items-center mb-5">
      <div className="flex flex-row items-center justify-center flex-wrap gap-2">
        {logoGroups.map(({ logo, darkLogo, libraries, subtitle }) => {
          const isSmall = logo === '/images/sciplex-logo.svg' || logo === '/images/lincs-logo.png'
          const size = isSmall ? 50 : 80
          return (
            <button
              key={logo}
              type="button"
              onClick={() => handleToggleGroup(libraries)}
              className={`btn btn-ghost p-2 h-auto min-h-0 w-28 flex flex-col items-center justify-center transition-all rounded-lg mx-1 ${getButtonStyle(libraries)}`}
              title={libraries.join(', ')}
            >
              <div className={`w-20 h-20 relative flex items-center justify-center ${isSmall ? 'bg-white dark:bg-gray-800 rounded-lg p-2' : ''}`}>
                {darkLogo ? (
                  <>
                    <Image src={logo} alt={libraries[0]} width={size} height={size} className="object-contain max-w-full max-h-full dark:hidden" />
                    <Image src={darkLogo} alt={libraries[0]} width={size} height={size} className="object-contain max-w-full max-h-full hidden dark:block" />
                  </>
                ) : (
                  <Image src={logo} alt={libraries[0]} width={size} height={size} className={`object-contain max-w-full max-h-full ${logo === '/images/sciplex-logo.svg' ? '' : 'dark:invert'}`} />
                )}
              </div>
              <span className="text-xs mt-1 leading-tight text-center">{subtitle}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
