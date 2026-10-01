'use client'

import TermSearch, { type TermSearchWorkflow } from '@/components/termSearch'
import Stats from '@/components/stats'

const workflows: Record<string, TermSearchWorkflow> = {
  'drug-drug': {
    label: 'Similar drugs for a drug',
    description: 'Find similar drugs for an existing drug based on signature similarity.',
    source: 'drug', target: 'drug',
  },
  'gene-drug': {
    label: 'Drugs mimicking a knockout',
    description: "Find drugs most similar to a gene knockout's expression signature.",
    source: 'gene', sourceType: 'KO', target: 'drug',
  },
  'drug-gene': {
    label: 'Likely targets of a drug',
    description: 'Find likely drug targets by matching gene expression signatures of drugs and gene knockouts.',
    source: 'drug', target: 'gene', targetType: 'KO',
  },
}

export default function MatcherClientPage() {
  return <TermSearch title="Matcher" workflows={workflows} description={<>
    Use Perturb-Seqr&apos;s corpus of <Stats show_gene_sets bold /> from drug and gene perturbations as query signatures to find similar drugs or likely targets.
  </>} />
}
