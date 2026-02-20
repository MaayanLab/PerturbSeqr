'use client'
import React from 'react'

// MinIO base URL for GMT downloads
const MINIO_BASE = process.env.NEXT_PUBLIC_MINIO_URL || 'https://s3.perturbseqr.k8s.dev.maayanlab.cloud'

// Dataset type definition
type Dataset = {
  title: string
  value: string
  info: React.ReactNode
  publicationUrl: string
  publicationUrl2?: string
  sourceUrl?: string
  sourceLabel?: string
  gmtUrl?: string
  fullSignaturesUrl?: string
  note?: string
  noteLinkText?: string
  noteUrl?: string
}

// Drug/Chemical Perturbation Datasets
const drugPerturbationDatasets: Dataset[] = [
  {
    title: 'L1000-CP (Chemical Perturbations)',
    value: '156,926 signatures',
    info: 'Pruned, top 250 by CD coefficient',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/gmts/lincs-l1000-cp.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
  },
  {
    title: 'Tahoe 100M',
    value: '105,404 signatures',
    info: <><a href="https://huggingface.co/datasets/tahoebio/Tahoe-100M/viewer/pseudobulk_differential_expression" target="_blank" rel="noopener noreferrer" className="link link-neutral">Pseudobulk DESeq2</a>, padj ≤ 0.05, top 100 by log2FC, per-concentration</>,
    publicationUrl: 'https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3',
    sourceUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M',
    sourceLabel: 'Hugging Face',
    gmtUrl: `${MINIO_BASE}/gmts/tahoe-100m.gmt.gz`,
  },
  {
    title: 'Novartis/DRUG-seq U2OS MoABox Dataset',
    value: '26,316 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35508359/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/nibr-drug-seq.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'DRUGseqr',
    noteUrl: 'https://drugseqr.maayanlab.cloud/download',
  },
  {
    title: 'CMAP Build 02',
    value: '12,200 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/17008526/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/microarrays-cmap.gmt.gz`,
  },
  {
    title: 'Ginkgo Bioworks',
    value: '9,310 signatures',
    info: '',
    publicationUrl: 'https://www.ginkgobioworks.com/',
    sourceUrl: 'https://huggingface.co/ginkgo-datapoints',
    sourceLabel: 'Hugging Face',
    note: 'Data used under license',
  },
  {
    title: 'Sci-Plex Drug Perturbations',
    value: '4,604 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/31806696/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/sciplex.gmt.gz`,
  },
  {
    title: 'DeepCoverMOA',
    value: '1,748 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/36593396/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/deepcover-moa.gmt.gz`,
  },
  {
    title: 'GEO Small Molecules',
    value: '693 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/23193258/',
    publicationUrl2: 'https://pubmed.ncbi.nlm.nih.gov/11752295/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/geo-chem.gmt.gz`,
  },
  {
    title: 'RummaGEO Drug Perturbations',
    value: '5,345 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/rummageo-chem.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'RummaGEO',
    noteUrl: 'https://rummageo.com',
  },
]

// Gene Perturbation Datasets
const genePerturbationDatasets: Dataset[] = [
  {
    title: 'PerturbAtlas Gene Perturbations',
    value: '12,852 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/perturb-atlas.gmt.gz`,
  },
  {
    title: 'PerturbAtlas Mouse Gene Perturbations',
    value: '10,743 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/perturb-atlas-mouse.gmt.gz`,
  },
  {
    title: 'L1000-XPR (Gene Knockouts)',
    value: '281,890 signatures',
    info: 'Last Updated Jul 1 2021',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/gmts/lincs-l1000-xpr.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
  },
  {
    title: 'Replogle et al. K562 Genome-wide Perturb-seq',
    value: '4,110 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/replogle-k562-gwps.gmt.gz`,
  },
  {
    title: 'Replogle et al. RPE1 Essential Perturb-seq',
    value: '2,714 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/replogle-rpe1-essential.gmt.gz`,
  },
  {
    title: 'Replogle et al. K562 Essential Perturb-seq',
    value: '2,383 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/replogle-k562-essential.gmt.gz`,
  },
  {
    title: 'GEO Gene Perturbations',
    value: '1,477 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/23193258/',
    publicationUrl2: 'https://pubmed.ncbi.nlm.nih.gov/11752295/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/geo-gene.gmt.gz`,
  },
  {
    title: 'RummaGEO Gene Perturbations',
    value: '7,960 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/gmts/rummageo-gene.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'RummaGEO',
    noteUrl: 'https://rummageo.com',
  },
  {
    title: 'CM4AI',
    value: '11,739 perturbed genes',
    info: '',
    publicationUrl: '',
    sourceUrl: 'https://cm4ai.org',
    sourceLabel: 'CM4AI',
    gmtUrl: `${MINIO_BASE}/gmts/cm4ai.gmt.gz`,
    fullSignaturesUrl: 'https://figshare.com/s/ee85bb1880921326249b',
  },
]

// Metadata datasets (external links only)
const metadataDatasets: Dataset[] = [
  {
    title: 'Drug Repurposing Hub',
    value: 'Drug metadata',
    info: 'Broad Institute drug annotations',
    publicationUrl: '',
    sourceUrl: 'https://repo-hub.broadinstitute.org/repurposing#download-data',
    sourceLabel: 'Link',
  },
  {
    title: 'LINCS Metadata',
    value: 'Signature metadata',
    info: 'L1000 experiment annotations',
    publicationUrl: '',
    sourceUrl: 'https://maayanlab.cloud/sigcom-lincs/#/Download',
    sourceLabel: 'Link',
  },
  {
    title: 'Tahoe 100M Metadata',
    value: 'Drug metadata',
    info: 'Tahoe drug annotations',
    publicationUrl: '',
    sourceUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M#drug-metadata',
    sourceLabel: 'Link',
  },
  {
    title: 'Novartis DRUG-seq Metadata',
    value: 'Drug metadata',
    info: 'DRUG-seq drug annotations',
    publicationUrl: '',
    sourceUrl: 'https://drugseqr.maayanlab.cloud/download',
    sourceLabel: 'Link',
  },
  {
    title: 'RummaGEO Metadata',
    value: 'Signature metadata',
    info: 'RummaGEO experiment annotations',
    publicationUrl: '',
    sourceUrl: 'https://rummageo.com',
    sourceLabel: 'Link',
  },
]

// Dataset card component
function DatasetCard({ dataset, showDownloads = true }: { dataset: Dataset, showDownloads?: boolean }) {
  return (
    <div className="bg-base-100 shadow-sm border rounded-lg px-3 py-2">
      <h3 className="font-medium text-sm leading-tight">{dataset.title}</h3>
      <p className="text-xs text-gray-500 leading-tight">{dataset.value}{dataset.info && <> · {dataset.info}</>}</p>
      <div className="text-xs leading-tight mt-1">
        {dataset.publicationUrl ? (
          dataset.publicationUrl2 ? (
            <>
              Publication: <a href={dataset.publicationUrl} target="_blank" rel="noopener noreferrer" className="link link-neutral">[1]</a>
              {' '}<a href={dataset.publicationUrl2} target="_blank" rel="noopener noreferrer" className="link link-neutral">[2]</a>
              {' · '}
            </>
          ) : (
            <>
              <a href={dataset.publicationUrl} target="_blank" rel="noopener noreferrer" className="link link-neutral">Publication</a>
              {' · '}
            </>
          )
        ) : null}
        {dataset.sourceUrl ? (
          <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="link link-neutral">{dataset.sourceLabel || 'Source'}</a>
        ) : (
          <span className="text-gray-400">Source</span>
        )}
        {showDownloads && (
          <>
            {' · '}
            {dataset.gmtUrl ? (
              <a href={dataset.gmtUrl} download className="link link-neutral">Gene Matrix Transposed</a>
            ) : (
              <span className="text-gray-400">Gene Matrix Transposed</span>
            )}
            {' · '}
            {dataset.fullSignaturesUrl ? (
              <a href={dataset.fullSignaturesUrl} target="_blank" rel="noopener noreferrer" className="link link-neutral">Full Signatures</a>
            ) : (
              <span className="text-gray-400">Full Signatures</span>
            )}
          </>
        )}
      </div>
      {dataset.note && (
        <p className="text-xs italic text-gray-400 leading-tight">
          {dataset.note}
          {dataset.noteLinkText && dataset.noteUrl && (
            <a href={dataset.noteUrl} target="_blank" rel="noopener noreferrer" className="link link-neutral">{dataset.noteLinkText}</a>
          )}
        </p>
      )}
    </div>
  )
}

export default function DownloadClientPage() {
  return (
    <div className="prose max-w-none">
      <p className="text-sm font-bold mb-4">
        GMT downloads contain both up- and down-regulated gene sets in a single compressed .gmt.gz file
      </p>

      <h3 className="text-lg font-medium mt-4 mb-2">Drug/Chemical Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {drugPerturbationDatasets.map(dataset => (
          <DatasetCard key={dataset.title} dataset={dataset} />
        ))}
      </div>

      <h3 className="text-lg font-medium mt-4 mb-2">Gene Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {genePerturbationDatasets.map(dataset => (
          <DatasetCard key={dataset.title} dataset={dataset} />
        ))}
      </div>

      <h3 className="text-lg font-medium mt-4 mb-2">Metadata</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {metadataDatasets.map(dataset => (
          <DatasetCard key={dataset.title} dataset={dataset} showDownloads={false} />
        ))}
      </div>

      <p className="text-sm mt-4">
        Developed in <a className='link link-neutral' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
    </div>
  )
}
