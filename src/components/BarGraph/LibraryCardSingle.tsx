'use client';

import React from 'react';
import { useEnrichmentQueryQuery } from '@/graphql';
import { type BarRow, buildBarRow } from './BarGraph';
import { LibraryCardBase } from './LibraryCardBase';

const PER_SIDE = 10;

// Single-set per-library card. Two enrichment queries: 
// 1. Filter to up-regulated signatures
// 2. Filter to down-regulated signatures
// to fill both sides of the chart. 
// Enables showing drugs that asymmetrically up- vs down-regulate at a glance.
export function LibraryCardSingle({
  genes,
  libraryName,
  setQueryString,
}: {
  genes: string[];
  libraryName: string;
  setQueryString: (qs: Record<string, string | null>) => void;
}) {
  const baseVars = React.useMemo(() => ({
    genes,
    libraryNames: [libraryName],
    offset: 0,
    first: PER_SIDE,
    filterFda: false,
    filterKo: false,
    sortBy: 'pvalue',
    topN: 10000,
    pvalueLe: 0.05,
  }), [genes, libraryName]);
  const upVariables   = React.useMemo(() => ({ ...baseVars, filterTerm: ' up'   }), [baseVars]);
  const downVariables = React.useMemo(() => ({ ...baseVars, filterTerm: ' down' }), [baseVars]);

  const skip = genes.length === 0;

  const { data: upData,   loading: upLoading,   error: upError }   = useEnrichmentQueryQuery({ skip, variables: upVariables,   fetchPolicy: 'no-cache' });
  const { data: downData, loading: downLoading, error: downError } = useEnrichmentQueryQuery({ skip, variables: downVariables, fetchPolicy: 'no-cache' });

  const toRow = (n: any): BarRow =>
    buildBarRow(n.geneSets?.nodes?.[0]?.term ?? '', n);

  const upRows: BarRow[] = React.useMemo(() => {
    const nodes = upData?.currentBackground?.enrich?.nodes ?? [];
    return nodes.filter((n): n is NonNullable<typeof n> => n != null).map(toRow).filter((r) => r.term);
  }, [upData]);

  const downRows: BarRow[] = React.useMemo(() => {
    const nodes = downData?.currentBackground?.enrich?.nodes ?? [];
    return nodes.filter((n): n is NonNullable<typeof n> => n != null).map(toRow).filter((r) => r.term);
  }, [downData]);

  return (
    <LibraryCardBase
      libraryName={libraryName}
      subtitle={<>Top <strong>up-regulated</strong> right, top <strong>down-regulated</strong> left, sorted by <strong>p-value</strong>. Click to view results in table.</>}
      leftRows={downRows}
      rightRows={upRows}
      leftLabel="Down"
      rightLabel="Up"
      loading={upLoading || downLoading}
      error={!!(upError || downError)}
      totalSignificant={
        (upData?.currentBackground?.enrich?.totalCount ?? 0) +
        (downData?.currentBackground?.enrich?.totalCount ?? 0)
      }
      setQueryString={setQueryString}
    />
  );
}
