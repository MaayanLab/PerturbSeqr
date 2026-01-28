'use client'
import React from 'react'
import libraryConfig from '@/config/libraries.json'

const allLibraries = Object.values(libraryConfig.libraries).map((l: any) => l.displayName as string)

/**
 * DatasetIcons component - Displays icons/names for each dataset
 * Output: Grid of dataset names (to be replaced with icons later)
 */
export default function DatasetIcons() {
  return (
    <div className="card shadow-2xl bg-base-100 flex-shrink-0 h-fit">
      <div className="card-body p-3">
        <h3 className="font-bold text-center text-sm mb-2">TODO: ADD LOGOS</h3>
        <div className="grid grid-cols-3 gap-1">
          {allLibraries.map((name) => (
            <div
              key={name}
              className="text-xs text-black text-center p-1"
              title={name}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
