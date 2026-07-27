import { NextResponse } from 'next/server'

const GENESHOT_URL = 'https://maayanlab.cloud/geneshot/api/associate'
const GENE_COUNT = 100

type GeneShotResponse = {
  association?: Record<string, { simScore?: number | null }>
}

async function fetchAssociations(gene: string) {
  const response = await fetch(GENESHOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gene_list: [gene], similarity: 'coexpression' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`GeneShot returned ${response.status}`)

  // GeneShot serializes missing scores as NaN, which is not valid JSON.
  const text = (await response.text()).replace(/:\s*NaN(?=\s*[,}])/g, ': null')
  const data = JSON.parse(text) as GeneShotResponse
  if (!data.association) throw new Error('GeneShot returned an invalid response')

  return Object.entries(data.association)
    .filter(([, result]) => typeof result.simScore === 'number' && Number.isFinite(result.simScore))
    .sort(([, a], [, b]) => b.simScore! - a.simScore!)
    .map(([symbol]) => symbol)
}

export async function GET(request: Request) {
  const gene = new URL(request.url).searchParams.get('gene')?.trim()
  if (!gene) {
    return NextResponse.json({ error: 'Provide a gene symbol.' }, { status: 400 })
  }

  try {
    const uppercaseGene = gene.toUpperCase()
    // Perturb-Seqr uppercases symbols, while GeneShot preserves "orf" casing.
    const candidates = [...new Set([uppercaseGene.replace(/ORF/g, 'orf'), gene])]
    let queryGene = candidates[0]
    let correlatedGenes: string[] = []
    for (const candidate of candidates) {
      queryGene = candidate
      correlatedGenes = await fetchAssociations(queryGene)
      if (correlatedGenes.length >= GENE_COUNT - 1) break
    }

    if (correlatedGenes.length < GENE_COUNT - 1) {
      return NextResponse.json(
        { error: `${gene} was not found in the ARCHS4 correlation matrix.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      queryGene,
      genes: [queryGene, ...correlatedGenes.slice(0, GENE_COUNT - 1)],
    })
  } catch (error) {
    console.error('GeneShot coexpression request failed', error)
    return NextResponse.json(
      { error: 'ARCHS4 correlations are unavailable.' },
      { status: 502 }
    )
  }
}
