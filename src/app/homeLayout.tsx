import Image from 'next/image'
import React from 'react'
import Stats from '@/components/stats'

export default function HomeLayout({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col lg:flex-row items-center justify-center">
        <div className="card max-w-xs shadow-2xl bg-base-100 flex-shrink-0">
          <div className="card-body">
            {children}
          </div>
        </div>
        <div className="text-center p-10">
          <h3 className="text-xl font-bold p-2 pt-0">
            Signatures Search
          </h3>
          <div className='inline-flex'>
            <Image className={'rounded'} src={'/images/DR.gif'} width={225} height={225} alt={'PerturbSeek'} unoptimized></Image>
          </div>
          <React.Suspense fallback={<div className="text-center p-5"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'}/> </div>}>
          <h1 className="text-2xl font-bold">
            <span className="whitespace-nowrap"> Search through <Stats bold show_gene_sets /></span>
          </h1>
          <div className="mt-3">
            <p className="font-semibold">Datasets:</p>
            <p className="text-sm">L1000-Sigs, Tahoe-100M, L1000-CP, DRUGseqr, PerturbAtlas, CMAP, PerturbAtlas-Mouse, L1000-CRISPR, Ginkgo, SciPlex, Replogle-K562, DeepCoverMOA, GEO-Gene, GEO-Chem</p>
          </div>
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}