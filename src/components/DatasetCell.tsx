import { getDatasetUrl, getGeoUrl, getEnaUrl } from '@/utils/metadataLookup'
import { getGeoAccessions, getSraStudyAccessions } from '@/utils/parseTerm'

/**
 * Renders the "Dataset" `<td>` shared by the enrichment / term-search result tables.
 *
 * When a dataset's terms carry a source study accession, the dataset name is replaced by that
 * accession linked to its archive: RummaGEO/CREEDS → GEO (GSE/GDS), PerturbAtlas → ENA (SRP/ERP/DRP).
 * A comma-joined RummaGEO pair shows both links. All other datasets keep the name + source-URL link.
 */
export function DatasetCell({
  dataset,
  term,
  className = 'max-w-[120px]',
}: {
  dataset: string
  term?: string | null
  className?: string
}) {
  const d = dataset.toLowerCase()
  const links = !term
    ? []
    : d.startsWith('rummageo') || d.startsWith('creeds')
      ? getGeoAccessions(term).map((acc) => ({ acc, url: getGeoUrl(acc) }))
      : d.startsWith('perturb')
        ? getSraStudyAccessions(term).map((acc) => ({ acc, url: getEnaUrl(acc) }))
        : []

  if (links.length > 0) {
    // Short subtitle (column is ~120px): RummaGEO→RGEO, Perturb Atlas→PAtlas, CREEDS as-is.
    const subtitle = dataset.replace(/^RummaGEO/i, 'RGEO').replace(/^Perturb Atlas/i, 'PAtlas')
    return (
      <td className={className}>
        <div>
          {links.map(({ acc, url }, i) => (
            <span key={acc}>
              {i > 0 && ', '}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-neutral hover:link-hover"
                title={`View ${acc}`}
              >
                {acc}
              </a>
            </span>
          ))}
        </div>
        <div className="text-xs text-gray-500 truncate" title={dataset}>{subtitle}</div>
      </td>
    )
  }

  const url = getDatasetUrl(dataset)
  return (
    <td className={className}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-neutral hover:link-hover truncate block"
          title={`View ${dataset} source`}
        >
          {dataset}
        </a>
      ) : (
        <span className="truncate block" title={dataset}>{dataset}</span>
      )}
    </td>
  )
}
