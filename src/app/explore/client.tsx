'use client'
import React, { useState, useEffect } from 'react'

// Dataset configuration - IDs must match filenames in public/umap/figures/{id}_UMAP.html
// Sorted alphabetically by name within each category
const DATASETS = {
  drug: [
    { id: 'creeds-chem', name: 'CREEDS Chem', signatures: '1,872' },
    { id: 'deepcovermoa', name: 'DeepCover MoA', signatures: '1,748' },
    { id: 'ginkgo', name: 'Ginkgo Bioworks', signatures: '9,310' },
    { id: 'lincs-l1000-cp', name: 'LINCS L1000 CP', signatures: '156,926' },
    { id: 'cmap-build02', name: 'Microarrays CMAP', signatures: '12,200' },
    { id: 'drugseqr', name: 'NIBR DRUG-seq', signatures: '26,316' },
    { id: 'geo-chem', name: 'RummaGEO Chem', signatures: '1,860' },
    { id: 'sciplex', name: 'SciPlex', signatures: '4,604' },
    { id: 'tahoe-100m', name: 'Tahoe-100M', signatures: '105,404' },
  ],
  gene: [
    { id: 'cm4ai', name: 'CM4AI', signatures: '23,360' },
    { id: 'creeds-gene', name: 'CREEDS Gene', signatures: '4,788' },
    { id: 'lincs-l1000-xpr', name: 'LINCS L1000 XPR', signatures: '65,672' },
    { id: 'perturbatlas-human', name: 'Perturb Atlas Human', signatures: '12,852' },
    { id: 'perturbatlas-mouse', name: 'Perturb Atlas Mouse', signatures: '10,743' },
    { id: 'replogle', name: 'Replogle et al.', signatures: '9,207' },
    { id: 'geo-gene', name: 'RummaGEO Gene', signatures: '4,788' },
  ],
}

export default function ExploreClientPage() {
  const [selectedDataset, setSelectedDataset] = useState<string>(DATASETS.drug[0].id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const htmlPath = `/umap/figures/${selectedDataset}_UMAP.html`

  // Check if the UMAP file exists when dataset changes
  useEffect(() => {
    const checkFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(htmlPath, { method: 'HEAD' })
        if (!response.ok) {
          setError(`UMAP data not available for ${selectedDataset}`)
        }
      } catch {
        setError(`UMAP data not available for ${selectedDataset}`)
      } finally {
        setLoading(false)
      }
    }
    checkFile()
  }, [selectedDataset, htmlPath])

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
            key={selectedDataset}
            src={htmlPath}
            className="w-full h-full border-0"
            title={`${selectedDataset} UMAP`}
          />
        )}
      </div>
    </div>
  )
}
