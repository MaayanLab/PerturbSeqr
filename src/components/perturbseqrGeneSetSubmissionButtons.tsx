'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { useApolloClient } from '@apollo/client'
import { useAddUserGeneSetMutation, GeneSetSymbolsPageDocument, type GeneSetSymbolsPageQuery } from '@/graphql'
import fetchAllNodes from '@/utils/fetchAllNodes'

type Genes = (string | null | undefined)[] | undefined
const clean = (genes: Genes) => (genes ?? []).filter((g): g is string => !!g)

function useSubmitGeneSet() {
  const router = useRouter()
  const [addUserGeneSet, { loading }] = useAddUserGeneSetMutation()
  const create = async (genes: string[], description: string) =>
    (await addUserGeneSet({ variables: { genes, description } })).data?.addUserGeneSet?.userGeneSet?.id
  return { router, create, loading }
}

function SubmitButton({ label, disabled, loading, onClick }: { label: string; disabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button className="btn btn-sm btn-outline text-xs" type="button" disabled={disabled || loading} onClick={onClick}>
      <span className={classNames('loading loading-spinner loading-xs', { hidden: !loading })}></span>
      {label}
    </button>
  )
}

export function PerturbseqrSingleGeneSetSubmissionButton({ genes, description }: { genes?: Genes; description?: string | null }) {
  const { router, create, loading } = useSubmitGeneSet()
  const symbols = clean(genes)
  return (
    <SubmitButton
      label="Submit to Perturb-Seqr"
      loading={loading}
      disabled={symbols.length === 0}
      onClick={async () => {
        const id = await create(symbols, description || 'User Gene Set')
        if (id) router.push(`/enrich?dataset=${id}`)
      }}
    />
  )
}

export function PerturbseqrPairedGeneSetSubmissionButton({
  genesUp, genesDown, descriptionUp, descriptionDown, referencePair, enrichmentParams, label = 'Submit Pair to Perturb-Seqr',
}: {
  genesUp?: Genes; genesDown?: Genes; descriptionUp?: string | null; descriptionDown?: string | null
  referencePair?: { upId: string; downId: string }
  enrichmentParams?: Record<string, string>
  label?: string
}) {
  const client = useApolloClient()
  const { router, create } = useSubmitGeneSet()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const activeRequest = React.useRef(0)
  const up = clean(genesUp)
  const down = clean(genesDown)
  const inputKey = JSON.stringify(referencePair ?? [up, down])
  const params = new URLSearchParams(enrichmentParams).toString()

  React.useEffect(() => {
    setLoading(false)
    setError(false)
    return () => { activeRequest.current += 1 }
  }, [inputKey, descriptionUp, descriptionDown, params])

  async function loadGenes(id: string, isActive: () => boolean) {
    const nodes = await fetchAllNodes(async offset => {
      const { data } = await client.query<GeneSetSymbolsPageQuery>({
        query: GeneSetSymbolsPageDocument,
        variables: { id, first: 1000, offset },
        fetchPolicy: 'no-cache',
      })
      return data.geneSet?.genes
    }, isActive)
    if (!nodes.length) throw new Error('Unable to load signature genes')
    return nodes.map(node => node.symbol)
  }

  async function submitPair() {
    const request = ++activeRequest.current
    const isActive = () => request === activeRequest.current
    setLoading(true)
    setError(false)
    try {
      const [queryUp, queryDown] = referencePair
        ? await Promise.all([loadGenes(referencePair.upId, isActive), loadGenes(referencePair.downId, isActive)])
        : [up, down]
      if (!isActive()) return
      const [idUp, idDown] = await Promise.all([
        create(queryUp, descriptionUp || 'User Up Gene Set'),
        create(queryDown, descriptionDown || 'User Down Gene Set'),
      ])
      if (!isActive()) return
      if (!idUp || !idDown) throw new Error('Unable to save signature inputs')
      router.push(`/enrichpair?dataset=${idUp}&dataset=${idDown}${params ? `&${params}` : ''}`)
    } catch {
      if (isActive()) {
        setError(true)
        setLoading(false)
      }
    }
  }

  return (
    <div>
      <SubmitButton
        label={label}
        loading={loading}
        disabled={referencePair ? !referencePair.upId || !referencePair.downId : !up.length || !down.length}
        onClick={submitPair}
      />
      {error && <p role="alert" className="text-error text-xs mt-1">Could not submit this pair. Please try again.</p>}
    </div>
  )
}
