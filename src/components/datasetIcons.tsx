'use client'
import React from 'react'
import Image from 'next/image'
import libraryConfig from '@/config/libraries.json'

// Map dataset keys to their logo files
const logoMap: Record<string, { src: string; darkSrc?: string; type: 'image' | 'svg' }> = {
  'Tahoe-100M': { src: '/images/tahoe-logo-new.png', type: 'image' },
  'LINCS L1000 CP': { src: '/images/cmap-logo.svg', type: 'svg' },
  'LINCS L1000 XPR': { src: '/images/cmap-logo.svg', type: 'svg' },
  'Microarrays CMap': { src: '/images/broad-logo.png', type: 'image' },
  'NIBR DRUG-seq': { src: '/images/nibr-logo.png', type: 'image' },
  'SciPlex': { src: '/images/sciplex-logo.svg', darkSrc: '/images/sciplex-logo-dark.svg', type: 'svg' },
  'DeepCover MoA': { src: '/images/deepcovermoa-logo.png', type: 'image' },
  'CREEDS Chem': { src: '/images/creeds-logo.png', type: 'image' },
  'CREEDS Gene': { src: '/images/creeds-logo.png', type: 'image' },
  'RummaGEO Chem': { src: '/images/rummageo-logo.png', type: 'image' },
  'RummaGEO Gene': { src: '/images/rummageo-logo.png', type: 'image' },
  'Ginkgo Bioworks': { src: '/images/ginkgo-logo.png', type: 'image' },
  'Perturb Atlas': { src: '/images/perturbatlas-logo.png', type: 'image' },
  'Perturb Atlas Mouse': { src: '/images/perturbatlas-logo.png', type: 'image' },
  'Replogle et al.': { src: '/images/replogle-logo.svg', type: 'svg' },
}

// Short display labels for buttons
const shortLabels: Record<string, string> = {
  'LINCS L1000 CP': 'L1000 CP',
  'LINCS L1000 XPR': 'L1000 XPR',
  'Microarrays CMap': 'CMap Arrays',
  'NIBR DRUG-seq': 'NIBR DR-seq',
  'DeepCover MoA': 'DeepCover',
  'Ginkgo Bioworks': 'Ginkgo DR-seq',
  'Perturb Atlas Mouse': 'PA Mouse',
  'Replogle et al.': 'Replogle',
}

// Custom logo sizes per library (matches original groupSubtitle sizing)
const customSizes: Record<string, number> = {
  'RummaGEO Chem': 60,
  'RummaGEO Gene': 60,
  'Microarrays CMap': 100,
  'SciPlex': 75,
  'NIBR DRUG-seq': 100,
}
const defaultSize = 80

// Build per-library entries from config, sorted alphabetically by display name
const allLibraries = Object.values(libraryConfig.libraries).map((l: any) => ({
  name: l.displayName as string,
  category: l.category as 'drug' | 'gene',
})).sort((a, b) => a.name.localeCompare(b.name))

// Export counts for use in subtitle
export const resourceCount = new Set(allLibraries.map(l => logoMap[l.name]?.src).filter(Boolean)).size
export const libraryCount = allLibraries.length
export const drugLibraryCount = allLibraries.filter(l => l.category === 'drug').length
export const geneLibraryCount = allLibraries.filter(l => l.category === 'gene').length

export default function DatasetIcons({
  selectedLibraries = [],
  onSelectionChange = () => {},
}: {
  selectedLibraries?: string[]
  onSelectionChange?: (libraries: string[]) => void
}) {
  const handleToggle = (name: string) => {
    if (selectedLibraries.includes(name)) {
      onSelectionChange(selectedLibraries.filter(lib => lib !== name))
    } else {
      onSelectionChange([...selectedLibraries, name])
    }
  }

  const getButtonStyle = (name: string, category: 'drug' | 'gene') => {
    const hasAnySelection = selectedLibraries.length > 0
    const isSelected = selectedLibraries.includes(name)
    const categoryBg = category === 'drug' ? 'bg-cyan-200 dark:bg-cyan-900' : 'bg-fuchsia-200 dark:bg-fuchsia-900'

    if (!hasAnySelection) {
      return categoryBg
    } else if (isSelected) {
      return `${categoryBg} ring-2 ring-neutral`
    } else {
      return `${categoryBg} opacity-40`
    }
  }

  const renderButton = ({ name, category }: { name: string; category: 'drug' | 'gene' }) => {
    const logoInfo = logoMap[name]
    if (!logoInfo) return null
    const size = customSizes[name] || defaultSize
    const label = shortLabels[name] || name
    return (
      <button
        key={name}
        type="button"
        onClick={() => handleToggle(name)}
        className={`btn btn-ghost p-2 h-auto min-h-0 w-32 flex flex-col items-center justify-center transition-all rounded-lg mx-1 ${getButtonStyle(name, category)}`}
        title={name}
      >
        <div className="w-24 h-24 relative flex items-center justify-center">
          {logoInfo.darkSrc ? (
            <>
              <Image src={logoInfo.src} alt={name} width={size} height={size} className="object-contain max-w-full max-h-full dark:hidden" />
              <Image src={logoInfo.darkSrc} alt={name} width={size} height={size} className="object-contain max-w-full max-h-full hidden dark:block" />
            </>
          ) : (
            <Image src={logoInfo.src} alt={name} width={size} height={size} className={`object-contain max-w-full max-h-full ${name === 'SciPlex' ? '' : 'dark:invert'}`} unoptimized={logoInfo.type === 'svg'} />
          )}
        </div>
        <span className="text-xs mt-1 leading-tight text-center whitespace-nowrap">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center mb-5 gap-2">
      {allLibraries.map(renderButton)}
    </div>
  )
}
