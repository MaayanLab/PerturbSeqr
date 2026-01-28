import React from 'react'
import Image from "next/image"
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
      <h2 className="title text-xl font-medium mb-3">About PerturbSeek</h2>
      <div className="flex">
        <div className="flex-col">
          <Image className={'rounded float-right ml-5'} src={'/images/DR.gif'} width={250} height={250} alt={'PerturbSeek'} unoptimized></Image>
          <p className="mt-4">
            PerturbSeek is a fork of <a className="underline" href="https://l2s2.maayanlab.cloud" target="_blank">L2S2</a> (LINCS L1000 Signature Search) for Signature Search across drug/chemical and gene perturbation datasets.
          </p>
          <p className="mt-4">
            <strong>Drug/Chemical Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li>L1000-CP Chemical Perturbations (from L2S2/LINCS)</li>
            <li>Tahoe 100M</li>
            <li>DRUGseqr</li>
            <li>CMAP Build 02</li>
            <li>Ginkgo Bioworks</li>
            <li>Sci-Plex Drug Perturbations</li>
            <li>DeepCoverMOA</li>
            <li>GEO Small Molecules</li>
          </ul>
          <p className="mt-4">
            <strong>Gene Perturbation Datasets:</strong>
          </p>
          <ul className="list-disc ml-4">
            <li>PerturbAtlas Gene Perturbations</li>
            <li>PerturbAtlas Mouse Gene Perturbations</li>
            <li>L1000-CRISPR Gene Knockouts (from L2S2/LINCS)</li>
            <li>Replogle K562 Genome-wide Perturb-seq</li>
            <li>Replogle RPE1 Essential Perturb-seq</li>
            <li>Replogle K562 Essential Perturb-seq</li>
            <li>GEO Gene Perturbations</li>
          </ul>
          <p className="mt-2">
            <strong>L2S2 Resources:</strong>
          </p>
          <ul className="list-disc ml-4">
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
