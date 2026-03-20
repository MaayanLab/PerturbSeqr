'use client'
import React from 'react'

// MinIO base URL for GMT downloads
const MINIO_BASE = process.env.NEXT_PUBLIC_MINIO_URL || 'https://s3.perturbseqr.k8s.dev.maayanlab.cloud'

// --- Term structure types and colors ---

type TermField = { text: string; label: string }

type TermStructure = {
  example: string
  direction: string
  fields: TermField[]
  extraFields: TermField[]
}

// Standard field colors (positions 0-4)
const FIELD_COLORS = ['#2563eb', '#059669', '#0891b2', '#d97706', '#dc2626']
// Extra field colors (positions 5+)
const EXTRA_COLORS = ['#7c3aed', '#be185d', '#6d28d9', '#9333ea']

function TermStructureDisplay({ structure, compact = false }: { structure: TermStructure; compact?: boolean }) {
  const allFields = [...structure.fields, ...structure.extraFields]
  const textSize = compact ? 'text-xs' : 'text-sm'
  const monoSize = compact ? 'text-xs' : 'text-base'

  return (
    <div>
      {/* Colored term */}
      <div className={`font-mono ${monoSize} leading-relaxed mb-1 break-all`}>
        {allFields.map((field, i) => (
          <span key={i}>
            <span
              className="font-bold"
              style={{ color: i < 5 ? FIELD_COLORS[i] : EXTRA_COLORS[(i - 5) % EXTRA_COLORS.length] }}
            >
              {field.text || '\u00A0'}
            </span>
            {i < allFields.length - 1 && <span className="text-gray-400">::</span>}
          </span>
        ))}
        <span className="text-gray-400">{' '}</span>
        <span className="font-bold text-gray-600">{structure.direction}</span>
      </div>
      {/* Labels */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {allFields.map((field, i) => {
          const color = i < 5 ? FIELD_COLORS[i] : EXTRA_COLORS[(i - 5) % EXTRA_COLORS.length]
          const dot = i < 5 ? '\u25CF' : '\u25CB'
          return (
            <span key={i} className={textSize} style={{ color }}>
              {dot} {field.label}
            </span>
          )
        })}
        <span className={`${textSize} text-gray-600`}>{'\u25CF'} Direction</span>
      </div>
    </div>
  )
}

// --- Per-dataset term structures ---

const termStructures: Record<string, TermStructure> = {
  'lincs-l1000-cp': {
    example: 'bortezomib::HT29::::24H::20uM::REP.B007::C23 up',
    direction: 'up',
    fields: [
      { text: 'bortezomib', label: 'Perturbation' },
      { text: 'HT29', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '24H', label: 'Timepoint' },
      { text: '20uM', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'REP.B007', label: 'Batch ID' },
      { text: 'C23', label: 'Well' },
    ],
  },
  'tahoe-100m': {
    example: '(R)-Verapamil (hydrochloride)::A-172::CNS/Brain::24h::0.05uM up',
    direction: 'up',
    fields: [
      { text: '(R)-Verapamil (hydrochloride)', label: 'Perturbation' },
      { text: 'A-172', label: 'Cell Line' },
      { text: 'CNS/Brain', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '0.05uM', label: 'Concentration' },
    ],
    extraFields: [],
  },
  'nibr-drug-seq': {
    example: 'Diphenidol::U2OS::::24h::0.01uM::AF-80-QK39::batchid1 up',
    direction: 'up',
    fields: [
      { text: 'Diphenidol', label: 'Perturbation' },
      { text: 'U2OS', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '0.01uM', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'AF-80-QK39', label: 'NSN Code' },
      { text: 'batchid1', label: 'Batch' },
    ],
  },
  'microarrays-cmap': {
    example: '(+)-chelidonine::HL60::::6h::11uM::batch641 up',
    direction: 'up',
    fields: [
      { text: '(+)-chelidonine', label: 'Perturbation' },
      { text: 'HL60', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '6h', label: 'Timepoint' },
      { text: '11uM', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'batch641', label: 'Batch' },
    ],
  },
  'ginkgo-bioworks': {
    example: 'SC_514::A549::::24h::1uM up',
    direction: 'up',
    fields: [
      { text: 'SC_514', label: 'Perturbation' },
      { text: 'A549', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '1uM', label: 'Concentration' },
    ],
    extraFields: [],
  },
  'sciplex': {
    example: '2-Methoxyestradiol::A549::::24h::100nM up',
    direction: 'up',
    fields: [
      { text: '2-Methoxyestradiol', label: 'Perturbation' },
      { text: 'A549', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '100nM', label: 'Concentration' },
    ],
    extraFields: [],
  },
  'deepcover-moa': {
    example: '(4-Chlorobenzyl)pyridine::HCT116::::24h::10uM up',
    direction: 'up',
    fields: [
      { text: '(4-Chlorobenzyl)pyridine', label: 'Perturbation' },
      { text: 'HCT116', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '10uM', label: 'Concentration' },
    ],
    extraFields: [],
  },
  'creeds-chem': {
    example: 'Fluorouracil::::Bone marrow cells::::::mus musculus::GSE1559.3639 up',
    direction: 'up',
    fields: [
      { text: 'Fluorouracil', label: 'Perturbation' },
      { text: '', label: 'Cell Line' },
      { text: 'Bone marrow cells', label: 'Cell Type' },
      { text: '', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'mus musculus', label: 'Organism' },
      { text: 'GSE1559.3639', label: 'GEO ID' },
    ],
  },
  'rummageo-chem': {
    example: 'temozolomide::LNZ308::glioblastoma cell line::36h::::human::GSE111247::0::1 up',
    direction: 'up',
    fields: [
      { text: 'temozolomide', label: 'Perturbation' },
      { text: 'LNZ308', label: 'Cell Line' },
      { text: 'glioblastoma cell line', label: 'Cell Type' },
      { text: '36h', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'human', label: 'Organism' },
      { text: 'GSE111247', label: 'GEO ID' },
      { text: '0', label: 'Group 1' },
      { text: '1', label: 'Group 2' },
    ],
  },
  'perturb-atlas-human': {
    example: 'CPSF6::K562::::::::KD::SRP013565::10000 up',
    direction: 'up',
    fields: [
      { text: 'CPSF6', label: 'Perturbation' },
      { text: 'K562', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'KD', label: 'Pert. Type' },
      { text: 'SRP013565', label: 'SRA ID' },
      { text: '10000', label: 'Atlas ID' },
    ],
  },
  'perturb-atlas-mouse': {
    example: 'Adar1::::Anti-CD40 and anti-IgM activated B cells::::::KO::SRP360154::1001 up',
    direction: 'up',
    fields: [
      { text: 'Adar1', label: 'Perturbation' },
      { text: '', label: 'Cell Line' },
      { text: 'Anti-CD40 and anti-IgM activated B cells', label: 'Cell Type' },
      { text: '', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'KO', label: 'Pert. Type' },
      { text: 'SRP360154', label: 'SRA ID' },
      { text: '1001', label: 'Atlas ID' },
    ],
  },
  'lincs-l1000-xpr': {
    example: 'AKT1::A549::::96H::::HAHN001::A03 up',
    direction: 'up',
    fields: [
      { text: 'AKT1', label: 'Perturbation' },
      { text: 'A549', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: '96H', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'HAHN001', label: 'Pert. ID' },
      { text: 'A03', label: 'Well' },
    ],
  },
  'replogle-perturb-seq': {
    example: 'ZC3H18::K562::::day6::::P1P2::essential::10023 up',
    direction: 'up',
    fields: [
      { text: 'ZC3H18', label: 'Perturbation' },
      { text: 'K562', label: 'Cell Line' },
      { text: '', label: 'Cell Type' },
      { text: 'day6', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'P1P2', label: 'Guide' },
      { text: 'essential', label: 'Screen' },
      { text: '10023', label: 'Study ID' },
    ],
  },
  'creeds-gene': {
    example: 'Foxo1::::T reg::::::KO::mus musculus::GSE40655.508 up',
    direction: 'up',
    fields: [
      { text: 'Foxo1', label: 'Perturbation' },
      { text: '', label: 'Cell Line' },
      { text: 'T reg', label: 'Cell Type' },
      { text: '', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'KO', label: 'Pert. Type' },
      { text: 'mus musculus', label: 'Organism' },
      { text: 'GSE40655.508', label: 'GEO ID' },
    ],
  },
  'rummageo-gene': {
    example: 'irf1::BEAS-2B::respiratory epithelial cells::24h::::human::GSE114284::1::0 up',
    direction: 'up',
    fields: [
      { text: 'irf1', label: 'Perturbation' },
      { text: 'BEAS-2B', label: 'Cell Line' },
      { text: 'respiratory epithelial cells', label: 'Cell Type' },
      { text: '24h', label: 'Timepoint' },
      { text: '', label: 'Concentration' },
    ],
    extraFields: [
      { text: 'human', label: 'Organism' },
      { text: 'GSE114284', label: 'GEO ID' },
      { text: '1', label: 'Group 1' },
      { text: '0', label: 'Group 2' },
    ],
  },
}

// --- Dataset definitions ---

type Dataset = {
  title: string
  value: string
  info: React.ReactNode
  publicationUrl: string
  publicationUrl2?: string
  sourceUrl?: string
  sourceLabel?: string
  sourceUrl2?: string
  sourceLabel2?: string
  gmtUrl?: string
  fullSignaturesUrl?: string
  note?: string
  noteLinkText?: string
  noteUrl?: string
  termKey?: string  // key into termStructures
}

// Drug/Chemical Perturbation Datasets
const drugPerturbationDatasets: Dataset[] = [
  {
    title: 'CMAP Build 02',
    value: '12,200 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/17008526/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/microarrays-cmap.gmt.gz`,
    termKey: 'microarrays-cmap',
  },
  {
    title: 'CREEDS Drug Perturbations',
    value: '1,860 signatures',
    info: 'CREEDS + Harmonizome GEO microarray',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/27667448/',
    sourceUrl: 'https://maayanlab.cloud/CREEDS/',
    sourceLabel: 'CREEDS',
    sourceUrl2: 'https://maayanlab.cloud/Harmonizome/dataset/CREEDS+Signatures+of+Differentially+Expressed+Genes+for+Drugs',
    sourceLabel2: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/creeds-chem.gmt.gz`,
    termKey: 'creeds-chem',
  },
  {
    title: 'DeepCoverMOA',
    value: '1,748 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/36593396/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/deepcover-moa.gmt.gz`,
    termKey: 'deepcover-moa',
  },
  {
    title: 'Ginkgo Bioworks',
    value: '9,310 signatures',
    info: '',
    publicationUrl: 'https://www.ginkgobioworks.com/',
    sourceUrl: 'https://huggingface.co/ginkgo-datapoints',
    sourceLabel: 'Hugging Face',
    note: 'Data used under license',
    termKey: 'ginkgo-bioworks',
  },
  {
    title: 'L1000-CP (Chemical Perturbations)',
    value: '156,926 signatures',
    info: 'Pruned, top 250 by CD coefficient',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/data/lincs-l1000-cp.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
    termKey: 'lincs-l1000-cp',
  },
  {
    title: 'Novartis/DRUG-seq U2OS MoABox Dataset',
    value: '26,316 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35508359/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/nibr-drug-seq.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'DRUGseqr',
    noteUrl: 'https://drugseqr.maayanlab.cloud/download',
    termKey: 'nibr-drug-seq',
  },
  {
    title: 'RummaGEO Drug Perturbations',
    value: '5,345 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/rummageo-chem.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'RummaGEO',
    noteUrl: 'https://rummageo.com',
    termKey: 'rummageo-chem',
  },
  {
    title: 'Sci-Plex Drug Perturbations',
    value: '4,604 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/31806696/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/sciplex.gmt.gz`,
    termKey: 'sciplex',
  },
  {
    title: 'Tahoe 100M',
    value: '105,404 signatures',
    info: <><a href="https://huggingface.co/datasets/tahoebio/Tahoe-100M/viewer/pseudobulk_differential_expression" target="_blank" rel="noopener noreferrer" className="link link-neutral">Pseudobulk DESeq2</a>, padj ≤ 0.05, top 100 by log2FC, per-concentration</>,
    publicationUrl: 'https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3',
    sourceUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M',
    sourceLabel: 'Hugging Face',
    gmtUrl: `${MINIO_BASE}/data/tahoe-100m.gmt.gz`,
    termKey: 'tahoe-100m',
  },
]

// Gene Perturbation Datasets
const genePerturbationDatasets: Dataset[] = [
  {
    title: 'CM4AI',
    value: '0 signatures',
    info: '',
    publicationUrl: '',
    sourceUrl: 'https://cm4ai.org',
    sourceLabel: 'CM4AI',
    fullSignaturesUrl: 'https://figshare.com/s/ee85bb1880921326249b',
  },
  {
    title: 'CREEDS Gene Perturbations',
    value: '4,788 signatures',
    info: 'CREEDS + Harmonizome GEO microarray',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/27667448/',
    sourceUrl: 'https://maayanlab.cloud/CREEDS/',
    sourceLabel: 'CREEDS',
    sourceUrl2: 'https://maayanlab.cloud/Harmonizome/dataset/CREEDS+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel2: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/creeds-gene.gmt.gz`,
    termKey: 'creeds-gene',
  },
  {
    title: 'L1000-XPR (Gene Knockouts)',
    value: '65,672 signatures',
    info: 'Pruned, top 250 by CD coefficient',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/data/lincs-l1000-xpr.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
    termKey: 'lincs-l1000-xpr',
  },
  {
    title: 'PerturbAtlas Human Gene Perturbations',
    value: '12,852 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/perturb-atlas-human.gmt.gz`,
    termKey: 'perturb-atlas-human',
  },
  {
    title: 'PerturbAtlas Mouse Gene Perturbations',
    value: '10,743 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/perturb-atlas-mouse.gmt.gz`,
    termKey: 'perturb-atlas-mouse',
  },
  {
    title: 'Replogle et al. Perturb-seq',
    value: '9,207 signatures',
    info: 'K562 genome-wide, K562 essential, RPE1 essential',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/replogle-perturb-seq.gmt.gz`,
    termKey: 'replogle-perturb-seq',
  },
  {
    title: 'RummaGEO Gene Perturbations',
    value: '7,960 signatures',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/data/rummageo-gene.gmt.gz`,
    note: 'See also ',
    noteLinkText: 'RummaGEO',
    noteUrl: 'https://rummageo.com',
    termKey: 'rummageo-gene',
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

// --- Components ---

function DatasetCard({ dataset, showDownloads = true }: { dataset: Dataset, showDownloads?: boolean }) {
  const structure = dataset.termKey ? termStructures[dataset.termKey] : null

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
        {dataset.sourceUrl2 && (
          <>
            {' · '}
            <a href={dataset.sourceUrl2} target="_blank" rel="noopener noreferrer" className="link link-neutral">{dataset.sourceLabel2 || 'Source'}</a>
          </>
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
      {structure && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Signature Term Format</p>
          <TermStructureDisplay structure={structure} compact />
        </div>
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
