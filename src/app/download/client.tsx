'use client'
import React from 'react'
import { useAllLibrariesQuery } from '@/graphql'

// MinIO base URL for GMT downloads
const MINIO_BASE = process.env.NEXT_PUBLIC_MINIO_URL
if (typeof MINIO_BASE === 'undefined') throw new Error('Please configure NEXT_PUBLIC_MINIO_URL')

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

type FullSignature = { url: string; label: string }

// Datasets either pull their signature count live from the database (via
// libraryName, looked up against geneSetLibraries) or display a static `value`
// (for metadata cards or placeholders like CM4AI that aren't in the DB).
// Do not set both: the DB is the single source of truth when libraryName is set.
type Dataset = {
  title: string
  libraryName?: string  // matches app_public.gene_set_library.name for live count lookup
  value?: string        // static display text; omit when libraryName is set
  info: React.ReactNode
  publicationUrl: string
  publicationUrl2?: string
  sourceUrl?: string
  sourceLabel?: string
  sourceUrl2?: string
  sourceLabel2?: string
  gmtUrl?: string
  fullSignaturesUrl?: string
  fullSignatures?: FullSignature[]
  note?: string
  noteLinkText?: string
  noteUrl?: string
  termKey?: string  // key into termStructures
}

// Drug/Chemical Perturbation Datasets
const drugPerturbationDatasets: Dataset[] = [
  {
    title: 'CMAP Build 02',
    libraryName: 'Microarrays CMap',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/17008526/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/microarrays-cmap.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/microarrays-cmap-full.txt.gz`, label: 'Discretized Matrix' },
      { url: `${MINIO_BASE}/cmap-ratio-matrix.txt.gz`, label: 'Fold Change Ratios' },
      { url: `${MINIO_BASE}/cmap-lfc.h5`, label: 'Limma log2FC' },
    ],
    termKey: 'microarrays-cmap',
  },
  {
    title: 'CREEDS Drug Perturbations',
    libraryName: 'CREEDS Chem',
    info: 'CREEDS + Harmonizome GEO microarray',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/27667448/',
    sourceUrl: 'https://maayanlab.cloud/CREEDS/',
    sourceLabel: 'CREEDS',
    sourceUrl2: 'https://maayanlab.cloud/Harmonizome/dataset/CREEDS+Signatures+of+Differentially+Expressed+Genes+for+Drugs',
    sourceLabel2: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/creeds-chem.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/creeds-chem-full.json`, label: 'Fold Changes (JSON)' },
    ],
    termKey: 'creeds-chem',
  },
  {
    title: 'DeepCoverMOA',
    libraryName: 'DeepCover MoA',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/36593396/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/deepcover-moa.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/deepcover-moa-full.txt.gz`, label: 'CD Coefficients' },
    ],
    termKey: 'deepcover-moa',
  },
  {
    title: 'Ginkgo Bioworks',
    libraryName: 'Ginkgo Bioworks',
    info: '',
    publicationUrl: 'https://www.ginkgobioworks.com/',
    sourceUrl: 'https://huggingface.co/ginkgo-datapoints',
    sourceLabel: 'Hugging Face',
    note: 'Data used under license',
    termKey: 'ginkgo-bioworks',
  },
  {
    title: 'L1000-CP (Chemical Perturbations)',
    libraryName: 'LINCS L1000 CP',
    info: 'Pruned, top 250 by CD coefficient',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/lincs-l1000-cp.gmt.gz`,
    fullSignatures: [
      { url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gctx/cd-coefficient/cp_coeff_mat.gctx', label: 'Full CD Coefficients' },
      { url: `${MINIO_BASE}/l1000-cp-pruned-cd-coefficients.h5ad`, label: 'Pruned CD Coefficients' },
    ],
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
    termKey: 'lincs-l1000-cp',
  },
  {
    title: 'Novartis/DRUG-seq U2OS MoABox Dataset',
    libraryName: 'NIBR DRUG-seq',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35508359/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/nibr-drug-seq.gmt.gz`,
    fullSignatures: [
      { url: 'https://zenodo.org/records/14291445', label: 'Full DE (RData)' },
      { url: `${MINIO_BASE}/nibr-drug-seq-de.parquet`, label: 'DE Summary (Parquet)' },
    ],
    note: 'See also ',
    noteLinkText: 'DRUGseqr',
    noteUrl: 'https://drugseqr.maayanlab.cloud/download',
    termKey: 'nibr-drug-seq',
  },
  {
    title: 'RummaGEO Drug Perturbations',
    libraryName: 'RummaGEO Chem',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/rummageo-chem.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/rummageo-chem-full.txt.gz`, label: 'Discretized Matrix' },
    ],
    note: 'See also ',
    noteLinkText: 'RummaGEO',
    noteUrl: 'https://rummageo.com',
    termKey: 'rummageo-chem',
  },
  {
    title: 'Sci-Plex Drug Perturbations',
    libraryName: 'SciPlex',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/31806696/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/sciplex.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/sciplex-full.txt.gz`, label: 'CD Coefficients' },
    ],
    termKey: 'sciplex',
  },
  {
    title: 'Tahoe 100M',
    libraryName: 'Tahoe-100M',
    info: <><a href="https://huggingface.co/datasets/tahoebio/Tahoe-100M/viewer/pseudobulk_differential_expression" target="_blank" rel="noopener noreferrer" className="link link-neutral">Pseudobulk DESeq2</a>, padj ≤ 0.05, top 100 by log2FC, per-concentration</>,
    publicationUrl: 'https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3',
    sourceUrl: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M',
    sourceLabel: 'Hugging Face',
    gmtUrl: `${MINIO_BASE}/tahoe-100m.gmt.gz`,
    fullSignatures: [
      { url: 'https://huggingface.co/datasets/tahoebio/Tahoe-100M/viewer/pseudobulk_differential_expression', label: 'DESeq2 log2FC' },
    ],
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
    fullSignatures: [
      { url: 'https://figshare.com/s/ee85bb1880921326249b', label: 'Figshare' },
      { url: `${MINIO_BASE}/cm4ai-cd-coefficients.h5ad`, label: 'CD Coefficients' },
    ],
  },
  {
    title: 'CREEDS Gene Perturbations',
    libraryName: 'CREEDS Gene',
    info: 'CREEDS + Harmonizome GEO microarray',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/27667448/',
    sourceUrl: 'https://maayanlab.cloud/CREEDS/',
    sourceLabel: 'CREEDS',
    sourceUrl2: 'https://maayanlab.cloud/Harmonizome/dataset/CREEDS+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel2: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/creeds-gene.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/creeds-gene-full.json`, label: 'Fold Changes (JSON)' },
    ],
    termKey: 'creeds-gene',
  },
  {
    title: 'L1000-XPR (Gene Knockouts)',
    libraryName: 'LINCS L1000 XPR',
    info: 'Pruned, top 250 by CD coefficient',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35524556/',
    gmtUrl: `${MINIO_BASE}/lincs-l1000-xpr.gmt.gz`,
    fullSignatures: [
      { url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gctx/cd-coefficient/xpr_coeff_mat.gctx', label: 'Full CD Coefficients' },
      { url: `${MINIO_BASE}/l1000-xpr-pruned-cd-coefficients.h5ad`, label: 'Pruned CD Coefficients' },
    ],
    note: 'See also ',
    noteLinkText: 'L2S2',
    noteUrl: 'https://l2s2.maayanlab.cloud/download',
    termKey: 'lincs-l1000-xpr',
  },
  {
    title: 'PerturbAtlas Human Gene Perturbations',
    libraryName: 'Perturb Atlas Human',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/perturb-atlas-human.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/perturb-atlas-human-full.txt.gz`, label: 'CD Coefficients' },
    ],
    termKey: 'perturb-atlas-human',
  },
  {
    title: 'PerturbAtlas Mouse Gene Perturbations',
    libraryName: 'Perturb Atlas Mouse',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39351872/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/perturb-atlas-mouse.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/perturb-atlas-mouse-full.txt.gz`, label: 'CD Coefficients' },
    ],
    termKey: 'perturb-atlas-mouse',
  },
  {
    title: 'Replogle et al. Perturb-seq',
    libraryName: 'Replogle et al.',
    info: 'K562 genome-wide, K562 essential, RPE1 essential',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/35688146/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/replogle-perturb-seq.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/replogle-k562-genomewide-full.txt.gz`, label: 'K562 Genome-wide CD Coefficients' },
      { url: `${MINIO_BASE}/replogle-k562-essential-full.txt.gz`, label: 'K562 Essential CD Coefficients' },
      { url: `${MINIO_BASE}/replogle-rpe1-essential-full.txt.gz`, label: 'RPE1 Essential CD Coefficients' },
    ],
    termKey: 'replogle-perturb-seq',
  },
  {
    title: 'RummaGEO Gene Perturbations',
    libraryName: 'RummaGEO Gene',
    info: '',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/38645198/',
    sourceUrl: 'https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures',
    sourceLabel: 'Harmonizome',
    gmtUrl: `${MINIO_BASE}/rummageo-gene.gmt.gz`,
    fullSignatures: [
      { url: `${MINIO_BASE}/rummageo-gene-full.txt.gz`, label: 'Discretized Matrix' },
    ],
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

function DatasetCard({ dataset, showDownloads = true, liveCount }: { dataset: Dataset, showDownloads?: boolean, liveCount?: number }) {
  const structure = dataset.termKey ? termStructures[dataset.termKey] : null
  const displayValue = dataset.libraryName
    ? (liveCount != null ? `${liveCount.toLocaleString()} signatures` : '…')
    : dataset.value

  return (
    <div className="bg-base-100 shadow-sm border rounded-lg px-3 py-2">
      <h3 className="font-medium text-sm leading-tight">{dataset.title}</h3>
      <p className="text-xs text-gray-500 leading-tight">{displayValue}{dataset.info && <> · {dataset.info}</>}</p>
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
            <br />
            {dataset.fullSignatures ? (
              <>
                {'Full Signatures: '}
                {dataset.fullSignatures.map((sig, i) => (
                  <span key={sig.label}>
                    <a href={sig.url} download className="link link-neutral">{sig.label}</a>
                    {i < dataset.fullSignatures!.length - 1 && ', '}
                  </span>
                ))}
              </>
            ) : dataset.fullSignaturesUrl ? (
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
  const { data } = useAllLibrariesQuery()
  const counts = Object.fromEntries(
    data?.geneSetLibraries?.nodes.map(n => [n.name, n.geneSetsByLibraryId.totalCount]) ?? []
  )

  return (
    <div className="prose max-w-none">
      <p className="text-sm font-bold mb-4">
        GMT downloads contain both up- and down-regulated gene sets in a single compressed .gmt.gz file
      </p>

      <h3 className="text-lg font-medium mt-4 mb-2">Drug/Chemical Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {drugPerturbationDatasets.map(dataset => (
          <DatasetCard key={dataset.title} dataset={dataset} liveCount={dataset.libraryName ? counts[dataset.libraryName] : undefined} />
        ))}
      </div>

      <h3 className="text-lg font-medium mt-4 mb-2">Gene Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3 my-3">
        {genePerturbationDatasets.map(dataset => (
          <DatasetCard key={dataset.title} dataset={dataset} liveCount={dataset.libraryName ? counts[dataset.libraryName] : undefined} />
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
