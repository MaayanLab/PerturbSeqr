import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import EnrichClientPage from './client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { searchParams: { dataset: string | string[] | undefined, libraries?: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Gene set search`,
    keywords: parentMetadata.keywords,
  }
}

export default function EnrichPage(props: { searchParams: { dataset: string | string[] | undefined, libraries?: string } }) {
  return <EnrichClientPage searchParams={props.searchParams} />
}
