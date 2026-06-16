import { getDatasetUrl, getGeoUrl } from '@/utils/metadataLookup'
import { getGeoAccessions } from '@/utils/parseTerm'

/**
 * Renders the "Dataset" `<td>` shared by the enrichment / term-search result tables.
 *
 * For RummaGEO rows the dataset name is replaced by the GEO study accession(s) parsed from the
 * term, each linked to the GEO accession viewer (a comma-joined SubSeries+SuperSeries pair shows
 * both links). 
 * 
 * All other datasets keep the existing name + source-URL link.
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
  const isRummaGeo = dataset.toLowerCase().startsWith('rummageo')
  const accessions = isRummaGeo && term ? getGeoAccessions(term) : []

  if (accessions.length > 0) {
    return (
      <td className={className}>
        <div>
          {accessions.map((acc, i) => (
            <span key={acc}>
              {i > 0 && ', '}
              <a
                href={getGeoUrl(acc)}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-neutral hover:link-hover"
                title={`View ${acc} on GEO`}
              >
                {acc}
              </a>
            </span>
          ))}
        </div>
        <div className="text-xs text-gray-500 truncate" title={dataset}>{dataset.replace(/^RummaGEO/i, 'RGEO')}</div>
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
