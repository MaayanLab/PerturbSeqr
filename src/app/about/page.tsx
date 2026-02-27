import React from 'react'
import Image from 'next/image'
import Link from "next/link"
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | About`,
    keywords: parentMetadata.keywords,
  }
}

export default async function About() {
  return (
    <div className="prose">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="title text-xl font-medium">About PerturbSeqr</h2>
        <Image
          className="dark:invert"
          src="/images/perturbseqr-logo.png"
          alt="PerturbSeqr logo"
          width={60}
          height={90}
        />
      </div>
      <div className="flex">
        <div className="flex-col">
          <h3 className="text-lg font-semibold mt-4">Perturb-Seqr: Comprehensive Signature Search Engine Integrating Connectivity Maps from Multiple Sources</h3>
          <p className="text-sm mt-1">
            John K. Gardner<sup>1</sup>, Lily D. Taub<sup>1</sup>, Ido Diamant<sup>1</sup>, Avi Ma&apos;ayan<sup>1</sup>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <sup>1</sup>Department of Pharmacological Sciences, Mount Sinai Center for Bioinformatics, Icahn School of Medicine at Mount Sinai, New York, New York; CFDE Data Resource Center
          </p>
          <h4 className="text-md font-semibold mt-4">Abstract</h4>
          <p className="mt-1">
            Connectivity Mapping was significantly expanded via the NIH Common Fund LINCS program that produced a massive drug and single gene knockout perturbations followed by expression resource with the L1000 assay. These efforts set the stage for a new wave of Connectivity Mapping datasets that recently emerged due the availability of the DRUG-seq and Perturb-seq biotechnologies. However, as far as we know, no efforts were made to integrate multiple Connectivity Mapping resources for an integrative search. Motivated by this opportunity, we have developed Perturb-seqr, a comprehensive Connectivity Mapping search engine that integrates 9 small molecules transcriptomics Connectivity Maps and 9 single gene perturbation Connectivity Maps. Specifically, Perturb-seqr contains processed data from LINCS (L1000), Tahoe-100M, NIBR (DRUG-seq), the original CMap (cDNA microarrays), Ginkgo Bioworks (DRUG-seq), SciPlex, DeepCover MoA (Proteomics), Perturb Atlas (Perturb-seq), Replogle et al. (Perturb-seq), CREEDS (cDNA microarrays), and RummaGEO (RNA-seq). To serve these dataset in one unifying search engine, we assembled over 650,000 sets of up- and down-regulated genes measuring the effects of over 11,000 unique drugs, and over 12,000 unique gene perturbations, targeting over 4,000 cell lines or tissues. Users of Perturb-seqr can submit their own up- and down-gene-sets to identify small molecules and gene perturbations that produce the most similar or opposite effect on gene expression. Perturb-seqr also provides interactive UMAP visualizations for exploring the clustering of signatures from each dataset, as well as programmatic access to Perturb-seqr via a GraphQL API. To demonstrate how Perturb-seqr can be used for drug and target discovery, we applied it to a dataset that seeks to identify drugs that would maximize insulin secretion from pancreatic islets. Overall, Perturb-Seqr introduces the most comprehensive up-to-date Connectivity Mapping search engine and database, enabling the discovery of new drugs and targets.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Supported by the NIH Common Fund (Award OT2OD036435).
          </p>
          <br />
          <p>
          This site is programmatically accessible via a <Link href="/graphiql" className="underline cursor-pointer" target="_blank">GraphQL API</Link>.
          </p>
          <br />
          <p>
          PerturbSeqr was developed by <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab.</a>
          </p>
          <br />
          <p className='mb-2 font-bold'>Please acknowledge PerturbSeqr in your publications by citing the following reference: </p>
          <p className='font-bold'>[Citation placeholder]</p>
          <br/>
          <p>
            <strong>Drug/Chemical Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li><a className="underline" href="https://maayanlab.cloud/sigcom-lincs/#/Download" target="_blank">LINCS L1000 Chemical Perturbations</a> (<a className="underline" href="https://l2s2.maayanlab.cloud/download" target="_blank">L2S2</a>)</li>
            <li><a className="underline" href="https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3" target="_blank">Tahoe-100M</a> (<a className="underline" href="https://huggingface.co/datasets/tahoebio/Tahoe-100M" target="_blank">Hugging Face</a>)</li>
            <li><a className="underline" href="https://zenodo.org/records/14291446" target="_blank">NIBR DRUG-seq U2OS MoABox Dataset</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/17008526/" target="_blank">Microarrays CMap Build 02</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://www.ginkgobioworks.com/" target="_blank">Ginkgo Bioworks</a> (<a className="underline" href="https://huggingface.co/ginkgo-datapoints" target="_blank">Hugging Face</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/31806696/" target="_blank">SciPlex Drug Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://wren.hms.harvard.edu/DeepCoverMOA/" target="_blank">DeepCover MoA</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/26673713/" target="_blank">CREEDS Drug Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/CREEDS/" target="_blank">CREEDS</a>)</li>
          </ul>
          <p className="mt-4">
            <strong>Gene Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li><a className="underline" href="https://perturbatlas.kratoss.site/#/" target="_blank">Perturb Atlas Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://perturbatlas.kratoss.site/#/" target="_blank">Perturb Atlas Mouse Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://maayanlab.cloud/sigcom-lincs/#/Download" target="_blank">LINCS L1000 Gene Knockouts</a> (<a className="underline" href="https://l2s2.maayanlab.cloud/download" target="_blank">L2S2</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle Perturb-seq</a> K562 Genome-wide (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle Perturb-seq</a> RPE1 Essential (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle Perturb-seq</a> K562 Essential (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/26673713/" target="_blank">CREEDS Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/CREEDS/" target="_blank">CREEDS</a>)</li>
          </ul>
          <p className="mt-2">
            <strong>Resources:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li>
              <a className="underline" href="https://github.com/MaayanLab/PerturbSeqr" target="_blank">
                PerturbSeqr Source Code
              </a>
            </li>
            <li>
              <a className="underline" href="https://academic.oup.com/nar/advance-article/doi/10.1093/nar/gkaf373/8123452" target="_blank">
                L2S2 Publication
              </a>
            </li>
            <li>
              <a className="underline" href="https://github.com/MaayanLab/L2S2" target="_blank">
                L2S2 Source Code
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
