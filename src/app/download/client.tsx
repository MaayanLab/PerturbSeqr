'use client'
import React from 'react'
import { useAllLibrariesQuery } from '@/graphql'
import useLibraryCatalog from '@/utils/useLibraryCatalog'
import { publicS3Location, type CatalogLibrary, type LibraryArtifact } from '@/utils/libraryCatalog'
import sharedDownloads from '../../../libraries/shared-downloads.json'
import DownloadLink from './downloadLink'
import TermExample from './termExample'

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function SourceLink({ url, label }: { url: string; label: string }) {
  return <a className="link link-neutral" href={url} target="_blank" rel="noopener noreferrer">{label}</a>
}

function ArtifactLink({ artifact, label = artifact.label }: { artifact: LibraryArtifact; label?: string }) {
  const url = artifact.status === 'external' ? artifact.url
    : artifact.status === 'public' ? `/api/library-artifact/${artifact.id}` : undefined
  if (!url) return <span className="text-gray-400">{label}</span>
  if (artifact.status === 'external' && !artifact.objectKey) return <SourceLink url={url} label={label} />
  const size = artifact.kind === 'gmt' && artifact.bytes ? formatSize(artifact.bytes) : undefined
  return <DownloadLink url={url} label={label} objectKey={artifact.objectKey} size={size} />
}

function ArtifactList({ artifacts }: { artifacts: LibraryArtifact[] }) {
  return <>{artifacts.map((artifact, i) => (
    <React.Fragment key={artifact.id}>{i > 0 && ', '}<ArtifactLink artifact={artifact} /></React.Fragment>
  ))}</>
}

const cardClass = 'bg-base-100 shadow-sm border rounded-lg px-3 py-2'
const titleClass = 'font-medium text-sm leading-tight [overflow-wrap:anywhere]'
const summaryClass = 'text-xs text-gray-500 leading-tight'
const linksClass = 'text-xs leading-tight mt-1'

function CatalogCard({ library, liveCount }: { library: CatalogLibrary; liveCount?: number }) {
  const { presentation, license, legacy, publications = [], sources = [], processing } = library.manifest
  const example = presentation?.termExample
  const count = (legacy ? liveCount : undefined) ?? library.counts.geneSets
  const pairs = legacy ? undefined : library.counts.pairedSignatures
  const gmt = library.artifacts.find(artifact => artifact.kind === 'gmt')
  const full = library.artifacts.filter(artifact => artifact.kind === 'full_signatures')
  const metadata = library.artifacts.filter(artifact => artifact.kind.endsWith('_metadata'))
  const other = library.artifacts.filter(artifact => !['gmt', 'full_signatures'].includes(artifact.kind) && !artifact.kind.endsWith('_metadata'))
  const licensed = gmt?.status === 'restricted'
  const summary = licensed ? undefined : presentation?.downloadSummary ?? library.description
  const summaryLink = presentation?.downloadSummaryLink
  const related = presentation?.relatedLinks ?? []
  const sourceLinks = [...publications.map((link, i) => ({ ...link, label: link.label || (publications.length === 1 ? 'Publication' : `Publication ${i + 1}`) })), ...sources]

  return (
    <div className={cardClass}>
      <h3 className={titleClass}>{presentation?.downloadTitle || library.name}</h3>
      <p className={summaryClass}>
        {count == null ? '…' : `${count.toLocaleString()} signatures`}
        {pairs != null && ` · ${pairs.toLocaleString()} complete pairs`}
        {summary && <> · {summaryLink?.label && summary.startsWith(summaryLink.label)
          ? <><SourceLink url={summaryLink.url} label={summaryLink.label} />{summary.slice(summaryLink.label.length)}</>
          : summary}</>}
      </p>
      <div className={linksClass}>
        {sourceLinks.map((link, i) => (
          <React.Fragment key={link.url}>{i > 0 && ' · '}<SourceLink url={link.url} label={link.label} /></React.Fragment>
        ))}
        {sourceLinks.length > 0 && <br />}
        {gmt ? <ArtifactLink artifact={gmt} label="Gene Matrix Transposed" /> : <span className="text-gray-400">Gene Matrix Transposed</span>}
        <br />
        {full.some(artifact => ['public', 'external'].includes(artifact.status))
          ? <>Full Signatures: <ArtifactList artifacts={full} /></>
          : <span className="text-gray-400">Full Signatures</span>}
        {metadata.length > 0 && <><br />Metadata: <ArtifactList artifacts={metadata} /></>}
        {other.length > 0 && <><br /><ArtifactList artifacts={other} /></>}
      </div>
      {(licensed || license || related.length > 0 || processing?.status === 'awaiting-details') && (
        <p className="text-xs italic text-gray-400 leading-tight">
          {licensed && library.description}
          {licensed && license && ' · '}
          {license && (license.url ? <SourceLink url={license.url} label={license.id} /> : license.id)}
          {license?.attribution && ` · ${license.attribution}`}
          {related.length > 0 && <>{(licensed || license) && ' · '}See also {related.map((link, i) => (
            <React.Fragment key={link.url}>{i > 0 && ', '}<SourceLink url={link.url} label={link.label || 'Source'} /></React.Fragment>
          ))}</>}
          {processing?.status === 'awaiting-details' && <> · Processing details awaiting confirmation.</>}
        </p>
      )}
      <TermExample term={example?.term || library.counts.example} gene={library.category === 'gene'} extraFields={example?.extraFields} caption={example?.caption} />
    </div>
  )
}

const metadataLabels: Record<string, string> = {
  drug_metadata: 'Drug metadata', cell_line_metadata: 'Cell line metadata', gene_target_metadata: 'Gene metadata',
  signature_metadata: 'Signature metadata', sample_metadata: 'Signature metadata',
}

export default function DownloadClientPage() {
  const { libraries, error } = useLibraryCatalog()
  const { data } = useAllLibrariesQuery()
  const counts = Object.fromEntries(data?.geneSetLibraries?.nodes.map(n => [n.name, n.geneSetsByLibraryId.totalCount]) ?? [])
  const sorted = [...libraries].sort((a, b) => (a.manifest.presentation?.downloadTitle || a.name)
    .localeCompare(b.manifest.presentation?.downloadTitle || b.name))
  return (
    <div className="prose max-w-none">
      <p className="text-sm font-bold mb-4">
        GMT downloads contain both up- and down-regulated gene sets in a single compressed .gmt.gz file
      </p>

      {error && <p role="status">The live library catalog is temporarily unavailable.</p>}
      {(['drug', 'gene'] as const).map(category => (
        <React.Fragment key={category}>
          <h3 className="text-lg font-medium mt-4 mb-2">{category === 'drug' ? 'Drug/Chemical' : 'Gene'} Perturbation Datasets</h3>
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
            {sorted.filter(library => library.category === category).map(library => (
              <CatalogCard key={library.id} library={library} liveCount={counts[library.name]} />
            ))}
          </div>
        </React.Fragment>
      ))}

      <h3 className="text-lg font-medium mt-4 mb-2">Metadata</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {sharedDownloads.map(({ title, description, artifact }) => (
          <div key={title} className={cardClass}>
            <h3 className={titleClass}>{title}</h3>
            <p className={summaryClass}>{metadataLabels[artifact.kind]} · {description}</p>
            <div className={linksClass}>
              <ArtifactLink artifact={{ ...artifact, id: title, status: 'external', ...(artifact.s3 ? publicS3Location(artifact.s3) : {}) }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm mt-4">
        Developed in <a className="link link-neutral" href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
    </div>
  )
}
