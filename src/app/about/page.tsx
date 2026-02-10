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
          <br></br>
          <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
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
            <li><a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/23193258/" target="_blank">GEO Small Molecules</a> (<a className="underline" href="https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules" target="_blank">Harmonizome</a>)</li>
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
