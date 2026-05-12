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
  const noResults = !loading && !error && leftRows.length === 0 && rightRows.length === 0;
  let order = 0;
  if (error) order = 2;
  else if (noResults) order = 1;
  else if (!loading) order = -totalSignificant;

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
        {loading ? (
          <div className="text-sm text-base-content/60 py-4 text-center">Loading…</div>
        ) : error ? (
          <div className="text-sm text-error py-4 text-center">Error loading {libraryName}</div>
        ) : noResults ? (
          <div className="text-sm text-base-content/60 py-4 text-center italic">No enriched terms</div>
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
  );
}
