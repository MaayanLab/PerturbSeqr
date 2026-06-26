'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { useAddUserGeneSetMutation } from '@/graphql'

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

export function PerturbseqrSingleButton({ genes, description }: { genes?: Genes; description?: string | null }) {
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

export function PerturbseqrPairedButton({ genesUp, genesDown, descriptionUp, descriptionDown }: {
  genesUp?: Genes; genesDown?: Genes; descriptionUp?: string | null; descriptionDown?: string | null
}) {
  const { router, create, loading } = useSubmitGeneSet()
  const up = clean(genesUp)
  const down = clean(genesDown)
  return (
    <SubmitButton
      label="Submit Pair to Perturb-Seqr"
      loading={loading}
      disabled={up.length === 0 || down.length === 0}
      onClick={async () => {
        const [idUp, idDown] = await Promise.all([
          create(up, descriptionUp || 'User Up Gene Set'),
          create(down, descriptionDown || 'User Down Gene Set'),
        ])
        if (idUp && idDown) router.push(`/enrichpair?dataset=${idUp}&dataset=${idDown}`)
      }}
    />
  )
}
