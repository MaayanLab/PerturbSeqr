import React from 'react'

// Adapted from Enrichr: https://github.com/MaayanLab/enrichr/blob/d994b0a272fb80297efb747af57da2e3f7d8d24c/src/main/webapp/js/index.js#L1015-L1038
async function getGsfmLink(description: string, genes: string[]) {
    const response = await fetch('https://gsfm.maayanlab.cloud/api/trpc/addList', {
        method: 'POST',
        body: JSON.stringify({ gene_set: genes }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error('GSFM submission failed')
    const results = await response.json()
    const id = results?.result?.data
    if (typeof id !== 'string' || !id) throw new Error('Missing GSFM gene set ID')
    return `https://gsfm.maayanlab.cloud/enrich?model=gsfm-rummagene&description=${encodeURIComponent(description)}&gene_set_id=${encodeURIComponent(id)}&gene_set_library_name=GO_Biological_Process_2025`
}

export default function GsfmGeneSetSubmissionButton({ genes, description }: { genes?: string[]; description?: string | null }) {
    return (
        <button
            className="btn btn-sm btn-outline text-xs"
            type="button"
            onClick={async () => {
                if (!genes?.length) return
                try {
                    const link = await getGsfmLink(description || 'Perturb-Seqr gene set', genes)
                    window.open(link, '_blank')
                } catch {
                    alert('Could not submit the gene set to GSFM. Please try again.')
                }
            }}
        >
            Submit to GSFM
        </button>
    )
}
