'use client'
import React, { useState, useEffect } from 'react'

// Dataset configuration - matches generate_umap.py LIBRARIES
const DATASETS = {
  drug: [
    { id: 'sciplex', name: 'SciPlex', signatures: '4,604' },
    { id: 'nibr-drug-seq', name: 'NIBR DRUG-seq', signatures: '26,316' },
    { id: 'deepcover-moa', name: 'DeepCover MoA', signatures: '1,748' },
    { id: 'ginkgo-bioworks', name: 'Ginkgo Bioworks', signatures: '9,310' },
    { id: 'lincs-l1000-cp', name: 'LINCS L1000 CP', signatures: '156,926' },
    { id: 'geo-chem', name: 'GEO-Chem', signatures: '810' },
    { id: 'tahoe-100m', name: 'Tahoe-100M', signatures: '37,800' },
    { id: 'microarrays-cmap', name: 'Microarrays CMap', signatures: '12,200' },
  ],
  gene: [
    { id: 'lincs-l1000-xpr', name: 'LINCS L1000 XPR', signatures: '281,890' },
    { id: 'perturb-atlas', name: 'Perturb Atlas', signatures: '12,852' },
    { id: 'perturb-atlas-mouse', name: 'Perturb Atlas Mouse', signatures: '10,743' },
    { id: 'geo-gene', name: 'GEO-Gene', signatures: '1,477' },
    { id: 'replogle-perturb-seq-k562-essential', name: 'Replogle K562 Essential', signatures: '2,383' },
    { id: 'replogle-perturb-seq-k562-genomewide', name: 'Replogle K562 Genome-wide', signatures: '4,110' },
    { id: 'replogle-perturb-seq-rpe1-essential', name: 'Replogle RPE1 Essential', signatures: '2,714' },
  ],
}

export default function ExploreClientPage() {
  const [selectedDataset, setSelectedDataset] = useState<string>('sciplex')
  const [direction, setDirection] = useState<'up' | 'dn'>('up')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const htmlPath = `/umap/figures/${selectedDataset}_${direction}_UMAP.html`

  // Check if the UMAP file exists when dataset/direction changes
  useEffect(() => {
    const checkFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(htmlPath, { method: 'HEAD' })
        if (!response.ok) {
          setError(`UMAP data not available for ${selectedDataset} (${direction})`)
        }
      } catch {
        setError(`UMAP data not available for ${selectedDataset} (${direction})`)
      } finally {
        setLoading(false)
      }
    }
    checkFile()
  }, [selectedDataset, direction, htmlPath])

  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold mb-4">Dataset Exploration</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Dataset</label>
          <select
            className="select select-bordered select-sm w-64"
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
          >
            <optgroup label="Drug Perturbations">
              {DATASETS.drug.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.signatures})</option>
              ))}
            </optgroup>
            <optgroup label="Gene Perturbations">
              {DATASETS.gene.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.signatures})</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Direction</label>
          <div className="btn-group">
            <button
              className={`btn btn-sm ${direction === 'up' ? 'btn-active' : ''}`}
              onClick={() => setDirection('up')}
            >
              Up-regulated
            </button>
            <button
              className={`btn btn-sm ${direction === 'dn' ? 'btn-active' : ''}`}
              onClick={() => setDirection('dn')}
            >
              Down-regulated
            </button>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="relative bg-white rounded-lg shadow-sm border" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {!error && !loading && (
          <iframe
            key={`${selectedDataset}-${direction}`}
            src={htmlPath}
            className="w-full h-full border-0"
            title={`${selectedDataset} ${direction} UMAP`}
          />
        )}
      </div>
    </div>
  )
}
