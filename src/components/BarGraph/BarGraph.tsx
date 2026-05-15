'use client';

// Butterfly bar chart for two ranked lists of enrichment results.
// Used by:
//   - /enrichpair  → left = reversers, right = mimickers
//   - /enrich      → left = down-regulated, right = up-regulated
// One shared x-axis across both halves so bar length and color reflect
// −log10(p) rather than per-side ranking.
//
// Using visx (https://airbnb.io/visx/) — React wrappers around d3 primitives.
// visx for scales, layout, shapes, and tooltips, but d3-interpolate is imported directly
// for color interpolation.
//
// No butterfly example in the visx gallery; closest reference is
// https://airbnb.io/visx/bargroup-horizontal (horizontal grouped bars).

import React from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { Text } from '@visx/text';
import { scaleLinear, scaleBand } from '@visx/scale';
import { interpolateRgb } from 'd3-interpolate';
import {
  useTooltip,
  TooltipWithBounds,
  defaultStyles as defaultTooltipStyles,
} from '@visx/tooltip';
import { parseTerm, formatPerturbationWithType } from '@/utils/parseTerm';

export interface BarRow {
  term: string;
  pvalue: number;
  // Optional parameters — tooltip-only, skipped when absent.
  adjPvalue?: number;
  oddsRatio?: number;
  nOverlap?: number;
  cellLine?: string;
  timepoint?: string;
  concentration?: string;
}

export type BarSide = 'left' | 'right';

export interface BarGraphOptions {
  height?: number;
  barsPerSide?: number;
  leftLabel?: string;
  rightLabel?: string;
  leftMinColor?: string;
  leftMaxColor?: string;
  rightMinColor?: string;
  rightMaxColor?: string;
  minBarWidth?: number;
  fontSize?: number;
  centerPadding?: number;
  axisStrokeColor?: string;
  headerHeight?: number;
  headerFontSize?: number;
}

const DEFAULTS = {
  height: 300,
  barsPerSide: 10,
  leftLabel: 'Left',
  rightLabel: 'Right',
  leftMinColor: '#d1d5db',  // gray-300
  leftMaxColor: '#ef4444',  // red-500
  rightMinColor: '#d1d5db', // gray-300
  rightMaxColor: '#3b82f6', // blue-500
  minBarWidth: 20,
  fontSize: 12,       // caption (text-xs)
  centerPadding: 4,
  axisStrokeColor: '#9ca3af', // gray-400
  headerHeight: 28,
  headerFontSize: 14, // secondary (text-sm)
};

// Returns -log10(p). When the user's input gene set exactly matches a
// term's gene set in the library, the backend reports p = 0. That becomes
// Infinity here. The shared scale below drops infinities from its domain
// and uses clamp: true. The outlier renders as a full-width bar. The rest
// of the chart stays undistorted.
function neglog(p: number): number {
  return -Math.log10(p);
}

// Tooltip row helpers
const metaRow = (label: string, value: string | undefined) =>
  value ? <div>{label}: {value}</div> : null;
const statRow = (label: string, value: number | undefined, fmt: (n: number) => string) =>
  value != null ? <div>{label}: {fmt(value)}</div> : null;

export interface EnrichStats {
  pvalue?: number | null;
  adjPvalue?: number | null;
  oddsRatio?: number | null;
  nOverlap?: number | null;
}
export function buildBarRow(fullTerm: string, stats: EnrichStats, isGeneLibrary = false): BarRow {
  const parsed = parseTerm(fullTerm);
  const perturbation = parsed.perturbation || parsed.raw || fullTerm;
  return {
    // Bar label: gene name with perturbation type appended for gene libraries (e.g. "PRSS36 KO").
    term: formatPerturbationWithType(perturbation, parsed.perturbationType, isGeneLibrary),
    pvalue: stats.pvalue ?? 1,
    adjPvalue: stats.adjPvalue ?? undefined,
    oddsRatio: stats.oddsRatio ?? undefined,
    nOverlap: stats.nOverlap ?? undefined,
    cellLine: parsed.cellLine || undefined,
    timepoint: parsed.timepoint || undefined,
    concentration: parsed.concentration || undefined,
  };
}

// Called from:
//   - LibraryCardSingle (single-set /enrich)    → labels "Down" / "Up"
//   - LibraryCardPaired (paired /enrichpair)    → labels "Reversers" / "Mimickers"
//
// Example:
//   <BarGraph
//     leftRows={downRows}      // BarRow[], top-10 down-regulated hits
//     rightRows={upRows}       // BarRow[], top-10 up-regulated hits
//     options={{
//       leftLabel:    'Down',
//       rightLabel:   'Up',
//       ...
//     }}
//   />
export function BarGraph({ leftRows, rightRows, options }: {
  leftRows: BarRow[]; rightRows: BarRow[]; options?: BarGraphOptions;
}) {
  const opts = { ...DEFAULTS, ...options };
  if (!leftRows.length && !rightRows.length) return null;
  return (
    <ParentSize debounceTime={0}>
      {({ width }) => width > 0
        // Render once measured.
        ? <BarGraphInner width={width} leftRows={leftRows} rightRows={rightRows} opts={opts} />
        : null}
    </ParentSize>
  );
}

// SVG output from measured width, rows, merged options.
function BarGraphInner({
  width,
  leftRows,
  rightRows,
  opts,
}: {
  width: number;
  leftRows: BarRow[];
  rightRows: BarRow[];
  opts: typeof DEFAULTS & BarGraphOptions;
}) {
  const lefts = leftRows.slice(0, opts.barsPerSide);
  const rights = rightRows.slice(0, opts.barsPerSide);

  const leftVals  = lefts.map(r => neglog(r.pvalue));
  const rightVals = rights.map(r => neglog(r.pvalue));

  // Rank-N left pairs with rank-N right at the same y.
  const totalRanks = Math.max(lefts.length, rights.length);
  const barsBlockHeight = (opts.height / opts.barsPerSide) * totalRanks;
  const svgHeight = opts.headerHeight + barsBlockHeight;
  const centerX = width / 2;
  const halfWidth = Math.max(0, centerX - opts.centerPadding);

  // Shared x-axis across both halves. Bar length and color track −log10(p)
  // magnitude, not per-side ranking. Infinity values from self-matches are
  // excluded from the domain so they don't compress the rest of the data.
  // When self-matches are present, the finite scale caps at 90% so they
  // remain visibly longer than every finite hit. Otherwise the finite scale
  // uses the full halfWidth.
  const allVals = [...leftVals, ...rightVals];
  const finiteVals = allVals.filter(Number.isFinite);
  const allMin = finiteVals.length ? Math.min(...finiteVals) : 0;
  const allMax = finiteVals.length ? Math.max(...finiteVals) : 1;
  const hasInfinity = allVals.length !== finiteVals.length;
  const finiteMaxWidth = hasInfinity ? halfWidth * 0.9 : halfWidth;

  const xShared = scaleLinear<number>({
    domain: [allMin, allMax],
    range: [opts.minBarWidth, finiteMaxWidth],
    clamp: true,
  });
  const y = scaleBand<number>({
    domain: Array.from({ length: totalRanks }, (_, i) => i),
    range: [0, barsBlockHeight],
    padding: 0.2,
  });

  const colorFor = (min: string, max: string) => (v: number) => {
    // Non-finite v from a self-match. Or a zero-range domain. Render max color.
    if (!Number.isFinite(v) || allMax === allMin) return interpolateRgb(min, max)(1);
    return interpolateRgb(min, max)((v - allMin) / (allMax - allMin));
  };
  const colorLeft  = colorFor(opts.leftMinColor,  opts.leftMaxColor);
  const colorRight = colorFor(opts.rightMinColor, opts.rightMaxColor);

  // Latin glyphs ≈ 0.55× fontSize wide; truncate term to fit available half-width.
  const maxChars = Math.max(4, Math.floor((halfWidth - 8) / (opts.fontSize * 0.55)));
  const truncate = (s: string) =>
    s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip }
    = useTooltip<{ row: BarRow; side: BarSide }>();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // TooltipWithBounds wants coords relative to its positioned ancestor (the wrapper div).
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, row: BarRow, side: BarSide) => {
    const r = wrapperRef.current!.getBoundingClientRect();
    showTooltip({
      tooltipData: { row, side },
      tooltipLeft: e.clientX - r.left,
      tooltipTop: e.clientY - r.top,
    });
  };

  // One ranked row's faded backing bar + opaque (or gray, if !sig) top bar + label.
  const renderSide = (row: BarRow, value: number, side: BarSide) => {
    const isLeft = side === 'left';
    // Self-matches bypass the scale and take the full halfWidth.
    const w = Number.isFinite(value) ? xShared(value) : halfWidth;
    const color = isLeft ? colorLeft(value) : colorRight(value);
    const sig = row.pvalue < 0.05;
    const x0 = isLeft ? centerX - w : centerX;
    const h = y.bandwidth();
    return (
      <>
        <Bar x={x0} width={w} height={h} fill={color} opacity={0.3} />
        <Bar x={x0} width={w} height={h} fill={sig ? color : '#d3d3d3'}
          onMouseMove={(e) => handleMouseMove(e, row, side)} onMouseLeave={hideTooltip} />
        <Text x={isLeft ? centerX - 4 : centerX + 4} y={h / 2} dy="0.35em"
          fontSize={opts.fontSize} textAnchor={isLeft ? 'end' : undefined} pointerEvents="none">
          {truncate(row.term)}
        </Text>
      </>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <svg width={width} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
        {/* Column headers — one centered above each half */}
        {[
          { x: centerX / 2,                   label: opts.leftLabel  },
          { x: centerX + (width - centerX)/2, label: opts.rightLabel },
        ].map(({ x, label }) => (
          <text key={label} x={x} y={opts.headerHeight - 8}
            textAnchor="middle" fontSize={opts.headerFontSize} fontWeight={500}>
            {label}
          </text>
        ))}

        {/* Center axis */}
        <line x1={centerX} y1={opts.headerHeight} x2={centerX} y2={svgHeight}
          stroke={opts.axisStrokeColor} strokeWidth={1} />

        {/* Per-rank rows: left bar on left, right bar on right */}
        {Array.from({ length: totalRanks }, (_, i) => (
          <Group key={`row-${i}`} top={opts.headerHeight + (y(i) ?? 0)}>
            {lefts[i]  && renderSide(lefts[i]!,  leftVals[i],  'left')}
            {rights[i] && renderSide(rights[i]!, rightVals[i], 'right')}
          </Group>
        ))}
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft}
          style={{ ...defaultTooltipStyles, fontSize: 12, lineHeight: 1.4 }}>
          <strong>{tooltipData.row.term}</strong>
          {metaRow('cell line',     tooltipData.row.cellLine)}
          {metaRow('timepoint',     tooltipData.row.timepoint)}
          {metaRow('concentration', tooltipData.row.concentration)}
          <div className="text-xs uppercase tracking-wide opacity-70">
            {tooltipData.side === 'left' ? opts.leftLabel : opts.rightLabel}
          </div>
          <hr style={{ margin: '6px 0', borderColor: 'rgba(0,0,0,0.15)' }} />
          {statRow('p-value',      tooltipData.row.pvalue,    (n) => n.toPrecision(4))}
          {statRow('adj. p-value', tooltipData.row.adjPvalue, (n) => n.toPrecision(4))}
          {statRow('odds ratio',   tooltipData.row.oddsRatio, (n) => n.toFixed(2))}
          {statRow('overlap',      tooltipData.row.nOverlap,  String)}
        </TooltipWithBounds>
      )}
    </div>
  );
}
