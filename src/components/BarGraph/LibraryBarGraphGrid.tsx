'use client';

import React from 'react';
import { isGenePerturbationLibrary } from '@/utils/metadataLookup';

// Grid wrapper: parent splits into drug-left / gene-right halves; each half is
// its own 2-column subgrid so wide viewports show 4 visible columns total
// (2 drug | 2 gene), collapsing to 1 column on narrow viewports. Within each
// half, cards order themselves by significance via CSS `order` (set in
// LibraryCardBase), so the most-enriched libraries surface first in their
// own half independently.
//
// `renderCard` is provided by the caller (single-set or paired) so this grid
// stays agnostic to which card variant + props are needed per page.
export function LibraryBarGraphGrid({
  activeLibraries,
  renderCard,
}: {
  activeLibraries: string[];
  renderCard: (libraryName: string) => React.ReactNode;
}) {
  if (activeLibraries.length === 0) {
    return (
      <div className="text-sm text-base-content/60 italic py-8 text-center">
        No libraries selected.
      </div>
    );
  }
  const drugLibs = activeLibraries.filter((lib) => !isGenePerturbationLibrary(lib));
  const geneLibs = activeLibraries.filter((lib) =>  isGenePerturbationLibrary(lib));
  const parentCols =
    drugLibs.length > 0 && geneLibs.length > 0 ? 'md:grid-cols-2' : 'md:grid-cols-1';
  const rowCount = Math.max(drugLibs.length, geneLibs.length);
  // Shared content-sized rows keep both categories aligned when headings wrap.
  const sideClass = 'grid min-w-0 grid-cols-1 lg:grid-cols-2 items-stretch gap-3 content-start [grid-auto-rows:minmax(460px,auto)] md:row-span-full md:[grid-template-rows:subgrid]';
  return (
    <div
      className={`grid grid-cols-1 ${parentCols} gap-3 mt-1 md:[grid-template-rows:repeat(var(--library-rows),minmax(460px,auto))] lg:[grid-template-rows:repeat(var(--library-wide-rows),minmax(460px,auto))]`}
      style={{
        '--library-rows': rowCount,
        '--library-wide-rows': Math.ceil(rowCount / 2),
      } as React.CSSProperties}
    >
      {drugLibs.length > 0 && (
        <div className={sideClass}>
          {drugLibs.map((lib) => <React.Fragment key={lib}>{renderCard(lib)}</React.Fragment>)}
        </div>
      )}
      {geneLibs.length > 0 && (
        <div className={sideClass}>
          {geneLibs.map((lib) => <React.Fragment key={lib}>{renderCard(lib)}</React.Fragment>)}
        </div>
      )}
    </div>
  );
}
