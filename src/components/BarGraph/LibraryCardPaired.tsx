'use client';

import React from 'react';
import { usePairEnrichmentQueryQuery } from '@/graphql';
import { type BarRow, buildBarRow } from './BarGraph';
import { LibraryCardBase } from './LibraryCardBase';

const PER_SIDE = 10;

// Paired (up + down) per-library card. Two paired-enrichment queries:
// 1. Sort by pvalue_mimic
// 2. Sort by pvalue_reverse
// to fill both sides of the chart.
export function LibraryCardPaired({
  genesUp,
  genesDown,
  libraryName,
  setQueryString,
}: {
  genesUp: string[];
  genesDown: string[];
  libraryName: string;
  setQueryString: (qs: Record<string, string | null>) => void;
}) {
  const baseVars = React.useMemo(() => ({
    genesUp,
    genesDown,
    libraryNames: [libraryName],
    offset: 0,
    first: PER_SIDE,
    filterTerm: '',
    filterFda: false,
    filterKo: false,
    topN: 10000,
    pvalueLe: 0.05,
  }), [genesUp, genesDown, libraryName]);
  const mimVariables = React.useMemo(() => ({ ...baseVars, sortBy: 'pvalue_mimic'   }), [baseVars]);
  const revVariables = React.useMemo(() => ({ ...baseVars, sortBy: 'pvalue_reverse' }), [baseVars]);

  const skip = genesUp.length === 0 || genesDown.length === 0;

  const { data: mimData, loading: mimLoading, error: mimError } = usePairEnrichmentQueryQuery({ skip, variables: mimVariables, fetchPolicy: 'no-cache' });
  const { data: revData, loading: revLoading, error: revError } = usePairEnrichmentQueryQuery({ skip, variables: revVariables, fetchPolicy: 'no-cache' });

  // Each paired-enrichment node carries both mimicker and reverser stats;
  // pluck the relevant side per row.
  const mimickerRows: BarRow[] = React.useMemo(() => {
    const nodes = mimData?.currentBackground?.pairedEnrich?.nodes ?? [];
    return nodes
      .filter((n): n is NonNullable<typeof n> => n != null)
      .map((n) => buildBarRow(n.geneSet?.nodes?.[0]?.term ?? '', {
        pvalue: n.pvalueMimic, adjPvalue: n.adjPvalueMimic,
        oddsRatio: n.oddsRatioMimic, nOverlap: n.mimickerOverlap,
      }))
      .filter((r) => r.term);
  }, [mimData]);

  const reverserRows: BarRow[] = React.useMemo(() => {
    const nodes = revData?.currentBackground?.pairedEnrich?.nodes ?? [];
    return nodes
      .filter((n): n is NonNullable<typeof n> => n != null)
      .map((n) => buildBarRow(n.geneSet?.nodes?.[0]?.term ?? '', {
        pvalue: n.pvalueReverse, adjPvalue: n.adjPvalueReverse,
        oddsRatio: n.oddsRatioReverse, nOverlap: n.reverserOverlap,
      }))
      .filter((r) => r.term);
  }, [revData]);

  return (
    <LibraryCardBase
      libraryName={libraryName}
      subtitle={<>Top <strong>mimickers</strong> right, top <strong>reversers</strong> left, sorted by <strong>p-value</strong>. Click to view results in table.</>}
      leftRows={reverserRows}
      rightRows={mimickerRows}
      leftLabel="Reversers"
      rightLabel="Mimickers"
      loading={mimLoading || revLoading}
      error={!!(mimError || revError)}
      totalSignificant={
        (mimData?.currentBackground?.pairedEnrich?.totalCount ?? 0) +
        (revData?.currentBackground?.pairedEnrich?.totalCount ?? 0)
      }
      setQueryString={setQueryString}
    />
  );
}
