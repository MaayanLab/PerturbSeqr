import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | License`,
    keywords: parentMetadata.keywords,
  }
}

export default async function License() {
  return (
    <div className="prose max-w-3xl">
      <h2 className="title text-xl font-medium mb-4">License</h2>
      <h3 className="text-lg font-semibold mt-4">Use</h3>
      <p className="mt-1">
        Perturb-Seqr&apos;s web-based tools and services are free for academic, non-profit use, but for commercial uses please contact Mount Sinai Innovation Partners (<a className="underline" href="mailto:MSIPInfo@mssm.edu">MSIPInfo@mssm.edu</a>) for a license.
      </p>
      <h3 className="text-lg font-semibold mt-4">Citation</h3>
      <p className="mt-1">
        Within any publication that uses any methods or results inspired by Perturb-Seqr, please cite:
      </p>
      <p className="mt-1 font-bold">
        Lily D. Taub, John K. Gardner, Ido Diamant, Daniel J. B. Clarke, Avi Ma&apos;ayan. Perturb-Seqr: Comprehensive Signature Search Engine Integrating Connectivity Maps from Multiple Sources. bioRxiv (2026). <a className="underline" href="https://www.biorxiv.org/content/10.64898/2026.10.06.757137v1">doi:10.64898/2026.10.06.757137</a>
      </p>
      <h3 className="text-lg font-semibold mt-4">Disclaimer</h3>
      <p className="mt-1 font-bold">
        PERTURB-SEQR IS NOT TO BE USED FOR TREATING OR DIAGNOSING HUMAN SUBJECTS.
      </p>
      <p className="mt-2">
        Perturb-Seqr or any documents available from this server ARE PROVIDED AS IS WITHOUT ANY WARRANTY OF ANY KIND, EITHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND FREEDOM FROM INFRINGEMENT, OR THAT Perturb-Seqr or any documents available from this server WILL BE ERROR FREE. The Ma&apos;ayan lab MAKES NO REPRESENTATIONS THAT THE USE OF Perturb-Seqr or any documents available from this server WILL NOT INFRINGE ANY PATENT OR PROPRIETATY RIGHTS OF THIRD PARTIES.
      </p>
      <p className="mt-2">
        In no event will the Ma&apos;ayan lab or any of its members be liable for any damages, including but not limited to direct, indirect, special or consequential damages, arising out of, resulting from, or in any way connected with the use of Perturb-Seqr or documents available from this server.
      </p>
    </div>
  )
}
