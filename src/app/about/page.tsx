import React from 'react'
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
      <h2 className="title text-xl font-medium mb-3">About PerturbSeqr</h2>
      <div className="flex">
        <div className="flex-col">
          <p className="mt-4">
            PerturbSeqr is a fork of <a className="underline" href="https://l2s2.maayanlab.cloud" target="_blank">L2S2</a> (LINCS L1000 Signature Search) for Signature Search across drug/chemical and gene perturbation datasets.
          </p>
          <p className="mt-4">
            <strong>Drug/Chemical Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li><a className="underline" href="https://l2s2.maayanlab.cloud/download" target="_blank">L1000-CP Chemical Perturbations</a> (L2S2)</li>
            <li><a className="underline" href="https://www.biorxiv.org/content/10.1101/2025.02.20.639398v3" target="_blank">Tahoe 100M</a> (<a className="underline" href="https://huggingface.co/datasets/tahoebio/Tahoe-100M" target="_blank">Hugging Face</a>)</li>
            <li><a className="underline" href="https://drugseqr.maayanlab.cloud/download" target="_blank">DRUGseqr</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://www.broadinstitute.org/connectivity-map-cmap" target="_blank">CMAP Build 02</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://www.ginkgobioworks.com/" target="_blank">Ginkgo Bioworks</a> (<a className="underline" href="https://huggingface.co/ginkgo-datapoints" target="_blank">Hugging Face</a>)</li>
            <li><a className="underline" href="https://github.com/cole-trapnell-lab/sci-plex" target="_blank">Sci-Plex Drug Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://wren.hms.harvard.edu/DeepCoverMOA/" target="_blank">DeepCoverMOA</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://www.ncbi.nlm.nih.gov/geo/" target="_blank">GEO Small Molecules</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules" target="_blank">Harmonizome</a>)</li>
          </ul>
          <p className="mt-4">
            <strong>Gene Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li><a className="underline" href="https://perturbatlas.kratoss.site/#/" target="_blank">PerturbAtlas Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://perturbatlas.kratoss.site/#/" target="_blank">PerturbAtlas Mouse Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://l2s2.maayanlab.cloud/download" target="_blank">L1000-CRISPR Gene Knockouts</a> (L2S2)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle et al.</a> K562 Genome-wide Perturb-seq (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle et al.</a> RPE1 Essential Perturb-seq (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/35688146/" target="_blank">Replogle et al.</a> K562 Essential Perturb-seq (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures" target="_blank">Harmonizome</a>)</li>
            <li><a className="underline" href="https://www.ncbi.nlm.nih.gov/geo/" target="_blank">GEO Gene Perturbations</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations" target="_blank">Harmonizome</a>)</li>
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
