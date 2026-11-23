import { Fragment } from 'react'

const fields = ['Perturbation', 'Cell Line', 'Cell Type', 'Timepoint', 'Concentration', 'Pert. Type', 'Method']
const fieldColors = ['#2563eb', '#059669', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#be185d']
const extraColors = ['#6d28d9', '#9333ea', '#a855f7', '#c026d3']

export default function TermExample({ term, gene, extraFields = [], caption }: {
  term?: string; gene: boolean; extraFields?: string[]; caption?: string;
}) {
  const match = term?.match(/^(.*) (up|down)$/)
  if (!match) return null
  const [, body, direction] = match
  const standardCount = gene ? 7 : 5
  const parts = body.split('::').map((value, i) => {
    const standard = i < standardCount
    const extra = i - standardCount
    return {
      value, standard,
      label: standard ? fields[i] : extraFields[extra] ?? `Extra ${extra + 1}`,
      color: standard ? fieldColors[i] : extraColors[extra % extraColors.length],
    }
  })
  return (
    <div className="mt-1.5 pt-1.5 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-1">Signature Term Format</p>
      <div className="font-mono text-xs leading-relaxed mb-1 break-all">
        {parts.map(({ value, color }, i) => (
          <Fragment key={i}>
            <span className="font-bold" style={{ color }}>{value || '\u00a0'}</span>
            {i < parts.length - 1 && <span className="text-gray-400">::</span>}
          </Fragment>
        ))}
        {' '}<span className="font-bold text-gray-600">{direction}</span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {parts.map(({ label, standard, color }, i) => (
          <span key={i} className="text-xs" style={{ color }}>{standard ? '●' : '○'} {label}</span>
        ))}
        <span className="text-xs text-gray-600">● Direction</span>
      </div>
      {caption && <div className="text-xs text-gray-500 italic mt-1">{caption}</div>}
    </div>
  )
}
