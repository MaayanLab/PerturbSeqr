'use client'
import React from 'react'
import Image from 'next/image'
import useLibraryCatalog from '@/utils/useLibraryCatalog'

export default function DatasetIcons({
  selectedLibraries = [],
  onSelectionChange = () => {},
}: {
  selectedLibraries?: string[]
  onSelectionChange?: (libraries: string[]) => void
}) {
  const { libraries } = useLibraryCatalog()
  const allLibraries = [...libraries].sort((a, b) => a.category === b.category ? a.name.localeCompare(b.name) : a.category === 'drug' ? -1 : 1)
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
    const categoryBg = category === 'drug' ? 'bg-cyan-300 dark:bg-cyan-800' : 'bg-fuchsia-100 dark:bg-fuchsia-900'

    if (!hasAnySelection) {
      return categoryBg
    } else if (isSelected) {
      return `${categoryBg} ring-2 ring-neutral`
    } else {
      return `${categoryBg} opacity-40`
    }
  }

  const renderButton = (library: typeof libraries[number]) => {
    const { name, category } = library
    const configured = library.manifest.presentation
    const logoInfo = configured?.logo
    const size = logoInfo?.width ?? 80
    const label = configured?.shortLabel || name
    return (
      <button
        key={name}
        type="button"
        onClick={() => handleToggle(name)}
        className={`btn btn-ghost p-2 h-auto min-h-0 w-32 flex flex-col items-center justify-center transition-all rounded-lg mx-1 ${getButtonStyle(name, category)}`}
        title={label}
      >
        <div className="w-24 h-24 relative flex items-center justify-center">
          {!logoInfo ? <span className="text-2xl font-semibold" aria-hidden="true">{name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span> : logoInfo.darkSrc ? (
            <>
              <Image src={logoInfo.src} alt={name} width={size} height={size} className="object-contain max-w-full max-h-full dark:hidden" />
              <Image src={logoInfo.darkSrc} alt={name} width={size} height={size} className="object-contain max-w-full max-h-full hidden dark:block" />
            </>
          ) : (
            <Image src={logoInfo.src} alt={name} width={size} height={size} className={`object-contain max-w-full max-h-full ${configured?.logo?.invertInDarkMode === false ? '' : 'dark:invert'}`} unoptimized />
          )}
        </div>
        <span className="mt-1 block max-w-full truncate text-center text-xs normal-case leading-tight">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center mb-5 gap-2">
      {allLibraries.map(renderButton)}
    </div>
  )
}
