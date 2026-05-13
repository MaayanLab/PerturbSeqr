'use client';

import React from 'react';
import Image from 'next/image';
import { BarGraph, type BarRow } from './BarGraph';
import { isGenePerturbationLibrary } from '@/utils/metadataLookup';

// Shared base for LibraryCardSingle and LibraryCardPaired.
// Both share layout; they differ only in their queries.
export function LibraryCardBase({
  libraryName,
  subtitle,
  leftRows,
  rightRows,
  leftLabel,
  rightLabel,
  loading,
  error,
  totalSignificant,
  setQueryString,
}: {
  libraryName: string;
  subtitle: React.ReactNode;
  leftRows: BarRow[];
  rightRows: BarRow[];
  leftLabel: string;
  rightLabel: string;
  loading: boolean;
  error: boolean;
  totalSignificant: number;
  setQueryString: (qs: Record<string, string | null>) => void;
}) {
  // Rank libraries by the geometric mean of the top 10 adjusted p-values,
  // pooled across mimicker and reverser sides. Equivalently, the mean of
  // -log10(adjPvalue) over the 10 pooled rows with the smallest adj_p.
  //
  // adjPvalue is BH-corrected within each library. It normalizes for
  // library size, so a small library with strong hits competes fairly
  // with a giant one. Pooling across sides treats both directions equally
  // so a directional library does not skew the rank. NEGLOG_CAP handles
  // self-matches where p = 0 yields Infinity.
  const NEGLOG_CAP = 50;
  const score = React.useMemo(() => {
    const top = [...leftRows, ...rightRows]
      .map((r) => Math.min(-Math.log10(r.adjPvalue ?? r.pvalue), NEGLOG_CAP))
      .sort((a, b) => b - a)
      .slice(0, 10);
    if (top.length === 0) return 0;
    return top.reduce((a, b) => a + b, 0) / top.length;
  }, [leftRows, rightRows]);

  const noResults = !loading && !error && leftRows.length === 0 && rightRows.length === 0;
  let order = 0;
  if (error) order = 2;
  else if (noResults) order = 1;
  else if (!loading) order = -Math.round(score * 1000);

  const goToTable = () =>
    setQueryString({ view: 'table', libraries: libraryName, page: '1' });

  const isGene = isGenePerturbationLibrary(libraryName);

  return (
    <div
      className="card bg-base-100 shadow-md border border-base-300 cursor-pointer hover:shadow-lg transition-shadow"
      style={{ order }}
      onClick={goToTable}
    >
      <div className="card-body p-3">
        <h3 className="text-base font-semibold select-none text-slate-700 flex items-center gap-1.5">
          {libraryName}
          <Image
            src={isGene ? '/images/gene_icon_l2s2.png' : '/images/drug_vector_art.png'}
            alt={isGene ? 'gene perturbation' : 'drug perturbation'}
            width={28} height={28}
            className="inline-block object-contain"
          />
        </h3>
        <p className="text-xs text-base-content/50 mb-2 select-none [&_strong]:text-base-content">
          {subtitle}
        </p>
        {/* Fixed-height content area so drug and gene subgrids share row
            heights and stay aligned. Bar charts sit at the top right below
            the subtitle. Empty states (loading, error, no enriched terms)
            center inside the remaining space. */}
        <div className="min-h-[340px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Image
                src="/images/loading.gif"
                alt="Loading…"
                width={100}
                height={117}
                className="rounded dark:invert"
                unoptimized
              />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-sm text-error">
              Error loading {libraryName}
            </div>
          ) : noResults ? (
            <div className="flex-1 flex items-center justify-center text-sm text-base-content/60 italic">
              No enriched terms
            </div>
          ) : (
            <BarGraph
              leftRows={leftRows}
              rightRows={rightRows}
              options={{
                leftLabel,
                rightLabel,
                // Gene-perturbation libraries use orange/purple to distinguish from
                // drug-perturbation libraries' default red/blue.
                ...(isGene && {
                  leftMaxColor: '#f97316',  // orange-500
                  rightMaxColor: '#a855f7', // purple-500
                }),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
