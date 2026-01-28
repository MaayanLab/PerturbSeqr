'use client'
import React from 'react'

// TODO: have downloads as a table in the database
const drugPerturbationDatasets = [
  {
    url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gmt/l1000_cp.gmt',
    filename: 'l1000_cp.gmt',
    title: 'L1000-CP (Chemical Perturbations)',
    value: '1,436,110 signatures',
    size: <><span className="whitespace-nowrap">2.25GB uncompressed, Last Updated Jul 1 2021</span></>,
    source: 'L2S2/LINCS',
  },
  {
    url: 'https://maayanlab.cloud/sigcom-lincs/#/Download',
    filename: '',
    title: 'L1000-Sigs (SigCom LINCS)',
    value: '62,056 signatures',
    size: <><span className="whitespace-nowrap">Up: 4.8 MB, Down: 4.4 MB compressed</span></>,
    source: 'SigCom LINCS',
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/Tahoe+Therapeutics+Tahoe+100M+Perturbation+Atlas',
    filename: '',
    title: 'Tahoe 100M',
    value: '37,800 signatures',
    size: <><span className="whitespace-nowrap">Up: 11.4 MB, Down: 11.4 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://drugseqr.maayanlab.cloud/download',
    filename: '',
    title: 'Novartis DRUG-seq U2OS MoABox / DRUGseqr',
    value: '26,316 signatures',
    size: <><span className="whitespace-nowrap">6.5 MB uncompressed</span></>,
    source: 'DRUGseqr',
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/CMAP+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    filename: '',
    title: 'CMAP Build 02',
    value: '12,200 signatures',
    size: <><span className="whitespace-nowrap">Up: 3.7 MB, Down: 3.8 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://www.ginkgobioworks.com/',
    filename: '',
    title: 'Ginkgo Bioworks',
    value: '9,310 signatures',
    size: <><span className="whitespace-nowrap">Up: 23.0 MB, Down: 20.6 MB (not for redistribution)</span></>,
    note: 'Data used under license',
    altUrl: 'https://huggingface.co/ginkgo-datapoints',
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures',
    filename: '',
    title: 'Sci-Plex Drug Perturbations',
    value: '4,604 signatures',
    size: <><span className="whitespace-nowrap">Up: 6.9 MB, Down: 6.9 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action',
    filename: '',
    title: 'DeepCoverMOA',
    value: '1,748 signatures',
    size: <><span className="whitespace-nowrap">Up: 0.5 MB, Down: 0.5 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules',
    filename: '',
    title: 'GEO Small Molecules',
    value: '810 signatures',
    size: <><span className="whitespace-nowrap">Up: 1.5 MB, Down: 0.3 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
]

const genePerturbationDatasets = [
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    filename: '',
    title: 'PerturbAtlas Gene Perturbations',
    value: '12,852 signatures',
    size: <><span className="whitespace-nowrap">Up: 3.1 MB, Down: 3.1 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations',
    filename: '',
    title: 'PerturbAtlas Mouse Gene Perturbations',
    value: '10,743 signatures',
    size: <><span className="whitespace-nowrap">Up: 2.3 MB, Down: 2.3 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gmt/l1000_xpr.gmt',
    filename: 'l1000_xpr.gmt',
    title: 'L1000-CRISPR (Gene Knockouts)',
    value: '281,890 signatures',
    size: <><span className="whitespace-nowrap">438.4MB uncompressed, Last Updated Jul 1 2021</span></>,
    source: 'L2S2/LINCS',
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures',
    filename: '',
    title: 'Replogle K562 Genome-wide Perturb-seq',
    value: '4,110 signatures',
    size: <><span className="whitespace-nowrap">Up: 1.6 MB, Down: 0.4 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    filename: '',
    title: 'Replogle RPE1 Essential Perturb-seq',
    value: '2,714 signatures',
    size: <><span className="whitespace-nowrap">Up: 0.9 MB, Down: 0.2 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures',
    filename: '',
    title: 'Replogle K562 Essential Perturb-seq',
    value: '2,383 signatures',
    size: <><span className="whitespace-nowrap">Up: 1.2 MB, Down: 0.4 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
  {
    url: 'https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations',
    filename: '',
    title: 'GEO Gene Perturbations',
    value: '1,477 signatures',
    size: <><span className="whitespace-nowrap">Up: 1.1 MB, Down: 1.1 MB uncompressed, Last Updated [TODO Date]</span></>,
  },
]

export default function DownloadClientPage() {
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">Data Sources</h2>
      <p className="text-sm text-gray-600">
        PerturbSeek aggregates perturbation signatures from multiple sources. Click on a dataset to visit the original data source.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-2">Drug/Chemical Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-2 gap-4 my-4">
        {drugPerturbationDatasets.map(download => (
          <a key={download.url} className="stats shadow no-underline" href={download.url} target="_blank">
            <div className="stat gap-2">
              <div className="stat-title">{download.title}</div>
              <div className="stat-value text-lg">{download.value}</div>
              <div className="stat-desc whitespace-normal">
                {download.size}
                {(download as any).note && <span className="block text-xs italic">{(download as any).note}</span>}
                {(download as any).altUrl && (
                  <span className="block">
                    Also see: <a href={(download as any).altUrl} target="_blank" className="underline" onClick={e => e.stopPropagation()}>Hugging Face</a>
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      <h3 className="text-lg font-medium mt-6 mb-2">Gene Perturbation Datasets</h3>
      <div className="grid lg:grid-cols-2 gap-4 my-4">
        {genePerturbationDatasets.map(download => (
          <a key={download.url} className="stats shadow no-underline" href={download.url} target="_blank">
            <div className="stat gap-2">
              <div className="stat-title">{download.title}</div>
              <div className="stat-value text-lg">{download.value}</div>
              <div className="stat-desc whitespace-normal">
                {download.size}
              </div>
            </div>
          </a>
        ))}
      </div>

      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
    </div>
  )
}
