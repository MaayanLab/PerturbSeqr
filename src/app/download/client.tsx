'use client'
import React from 'react'

// MinIO base URL for GMT downloads
const MINIO_BASE = process.env.NEXT_PUBLIC_MINIO_URL || 'https://s3.perturbseqr.k8s.dev.maayanlab.cloud'

// Dataset type definition
type Dataset = {
  title: string
  value: string
  info: string  // Size, last updated, etc.
  sourceUrl: string
  sourceUrl2?: string  // Second citation if needed
  sourceLabel?: string  // Default "Citation(s)", can be "Link" for metadata
  secondaryUrl?: string  // Harmonizome or Hugging Face
  secondaryLabel?: string  // "Harmonizome" or "Hugging Face"
  note?: string
  noteLinkText?: string  // Text within note to be linked
  noteUrl?: string  // Optional link for the note
  // For datasets with local downloads (up/down split)
  upUrl?: string
  downUrl?: string
  metadataUrl?: string  // Only for datasets with separate metadata
  // For datasets with a single combined download
  downloadUrl?: string
  // For external-only datasets (no downloads)
  externalOnly?: boolean
}

// Drug/Chemical Perturbation Datasets
const drugPerturbationDatasets: Dataset[] = [
  {
    title: 'L1000-CP (Chemical Perturbations)',
    value: '1,436,110 signatures',
    info: 'Up: 1.1 GB, Down: 1.1 GB, Last Updated Jul 1 2021',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    upUrl: `${MINIO_BASE}/gmts/l1000-cp-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/l1000-cp-down.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
  },
  {
    title: 'Tahoe 100M',
    value: '37,800 signatures',
    info: 'Up: 11.4 MB, Down: 11.4 MB',
    sourceUrl: 'https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3',
    secondaryUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M',
    secondaryLabel: 'Hugging Face',
    upUrl: `${MINIO_BASE}/gmts/tahoe-100m-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/tahoe-100m-down.gmt.gz`,
  },
  {
    title: 'Novartis/DRUG-seq U2OS MoABox Dataset',
    value: '26,316 signatures',
    info: 'Up: 3.2 MB, Down: 3.2 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35508359/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/drugseqr-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/drugseqr-down.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'DRUGseqr',
    noteUrl: 'https://drugseqr.maayanlab.cloud/download',
  },
  {
    title: 'CMAP Build 02',
    value: '12,200 signatures',
    info: 'Up: 3.7 MB, Down: 3.8 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/17008526/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/cmap-build02-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/cmap-build02-down.gmt.gz`,
  },
  {
    title: 'Ginkgo Bioworks',
    value: '9,310 signatures',
    info: 'Not available for redistribution',
    sourceUrl: 'https://www.ginkgobioworks.com/',
    secondaryUrl: 'https://huggingface.co/ginkgo-datapoints',
    secondaryLabel: 'Hugging Face',
    externalOnly: true,
    note: 'Data used under license',
  },
  {
    title: 'Sci-Plex Drug Perturbations',
    value: '4,604 signatures',
    info: 'Up: 6.9 MB, Down: 6.9 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/31806696/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/sciplex-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/sciplex-down.gmt.gz`,
  },
  {
    title: 'DeepCoverMOA',
    value: '1,748 signatures',
    info: 'Up: 0.5 MB, Down: 0.5 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/36593396/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/deepcovermoa-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/deepcovermoa-down.gmt.gz`,
  },
  {
    title: 'GEO Small Molecules',
    value: '810 signatures',
    info: 'Up: 1.5 MB, Down: 0.3 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/23193258/',
    sourceUrl2: 'https://pubmed.ncbi.nlm.nih.gov/11752295/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/geo-chem-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/geo-chem-down.gmt.gz`,
  },
]

// Gene Perturbation Datasets
const genePerturbationDatasets: Dataset[] = [
  {
    title: 'PerturbAtlas Gene Perturbations',
    value: '12,852 signatures',
    info: 'Up: 3.1 MB, Down: 3.1 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/perturbatlas-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/perturbatlas-down.gmt.gz`,
  },
  {
    title: 'PerturbAtlas Mouse Gene Perturbations',
    value: '10,743 signatures',
    info: 'Up: 2.3 MB, Down: 2.3 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/perturbatlas-mouse-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/perturbatlas-mouse-down.gmt.gz`,
  },
  {
    title: 'L1000-XPR (Gene Knockouts)',
    value: '281,890 signatures',
    info: 'Up: 219 MB, Down: 219 MB, Last Updated Jul 1 2021',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    upUrl: `${MINIO_BASE}/gmts/l1000-xpr-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/l1000-xpr-down.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
  },
  {
    title: 'Replogle et al. K562 Genome-wide Perturb-seq',
    value: '4,110 signatures',
    info: 'Up: 1.6 MB, Down: 0.4 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/replogle-k562-genomewide-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/replogle-k562-genomewide-down.gmt.gz`,
  },
  {
    title: 'Replogle et al. RPE1 Essential Perturb-seq',
    value: '2,714 signatures',
    info: 'Up: 0.9 MB, Down: 0.2 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/replogle-rpe1-essential-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/replogle-rpe1-essential-down.gmt.gz`,
  },
  {
    title: 'Replogle et al. K562 Essential Perturb-seq',
    value: '2,383 signatures',
    info: 'Up: 1.2 MB, Down: 0.4 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/replogle-k562-essential-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/replogle-k562-essential-down.gmt.gz`,
  },
  {
    title: 'GEO Gene Perturbations',
    value: '1,477 signatures',
    info: 'Up: 1.1 MB, Down: 1.1 MB',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/23193258/',
    sourceUrl2: 'https://pubmed.ncbi.nlm.nih.gov/11752295/',
    secondaryUrl: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    secondaryLabel: 'Harmonizome',
    upUrl: `${MINIO_BASE}/gmts/geo-gene-up.gmt.gz`,
    downUrl: `${MINIO_BASE}/gmts/geo-gene-down.gmt.gz`,
  },
  {
    title: 'CM4A1',
    value: '11,739 perturbed genes',
    info: '',
    sourceUrl: 'https://figshare.com/s/ee85bb1880921326249b',
    sourceLabel: 'Download Link',
    externalOnly: true,
  },
]

// Metadata datasets (external links only)
const metadataDatasets: Dataset[] = [
  {
    title: 'Drug Repurposing Hub',
    value: 'Drug metadata',
    info: 'Broad Institute drug annotations',
    sourceUrl: 'https://repo-hub.broadinstitute.org/repurposing#download-data',
    sourceLabel: 'Link',
    externalOnly: true,
  },
  {
    title: 'LINCS Metadata',
    value: 'Signature metadata',
    info: 'L1000 experiment annotations',
    sourceUrl: 'https://maayanlab.cloud/sigcom-lincs/#/Download',
    sourceLabel: 'Link',
    externalOnly: true,
  },
  {
    title: 'Tahoe 100M Metadata',
    value: 'Drug metadata',
    info: 'Tahoe drug annotations',
    sourceUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M#drug-metadata',
    sourceLabel: 'Link',
    externalOnly: true,
  },
  {
    title: 'Novartis DRUG-seq Metadata',
    value: 'Drug metadata',
    info: 'DRUG-seq drug annotations',
    sourceUrl: 'https://drugseqr.maayanlab.cloud/download',
    sourceLabel: 'Link',
    externalOnly: true,
  },
]

// Dataset card component
function DatasetCard({ dataset }: { dataset: Dataset }) {
  const hasUpDownDownloads = dataset.upUrl && dataset.downUrl

  return (
    <div className="bg-base-100 shadow-sm border rounded-lg px-3 py-2">
      <h3 className="font-medium text-sm leading-tight">{dataset.title}</h3>
      <p className="text-xs text-gray-500 leading-tight">{dataset.value} · {dataset.info}</p>
      <div className="text-xs leading-tight mt-1">
        {dataset.sourceUrl2 ? (
          <>
            Citation(s): <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="link link-primary">[1]</a>
            {' '}<a href={dataset.sourceUrl2} target="_blank" rel="noopener noreferrer" className="link link-primary">[2]</a>
          </>
        ) : (
          <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="link link-primary">{dataset.sourceLabel || 'Citation(s)'}</a>
        )}
        {dataset.secondaryUrl && (
          <> · <a href={dataset.secondaryUrl} target="_blank" rel="noopener noreferrer" className="link link-primary">{dataset.secondaryLabel}</a></>
        )}
        {dataset.downloadUrl && (
          <> · <a href={dataset.downloadUrl} download className="link link-primary">Download</a></>
        )}
        {hasUpDownDownloads && (
          <>
            {' · '}<a href={dataset.upUrl} download className="link link-primary">Up</a>
            {' · '}<a href={dataset.downUrl} download className="link link-primary">Down</a>
          </>
        )}
        {dataset.metadataUrl && (
          <> · <a href={dataset.metadataUrl} target="_blank" rel="noopener noreferrer" className="link link-primary">Metadata</a></>
        )}
      </div>
      {dataset.note && (
        <p className="text-xs italic text-gray-400 leading-tight">
          {dataset.note}
          {dataset.noteLinkText && dataset.noteUrl && (
            <a href={dataset.noteUrl} target="_blank" rel="noopener noreferrer" className="link link-primary">{dataset.noteLinkText}</a>
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
        Downloads below result in compressed .gmt.gz files
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
          <DatasetCard key={dataset.title} dataset={dataset} />
        ))}
      </div>

      <p className="text-sm mt-4">
        Developed in <a className='link link-primary' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
    </div>
  )
}
