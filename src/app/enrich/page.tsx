import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import EnrichClientPage from './client'

/**
 * Generate metadata for the enrichment page
 * Input: searchParams with dataset ID
 * Output: Page metadata with title
 */
export async function generateMetadata(props: { searchParams: { dataset: string | string[] | undefined, libraries?: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Gene set search`,
    keywords: parentMetadata.keywords,
  }
}

/**
 * EnrichPage - Server component wrapper for enrichment analysis
 * Input: searchParams with dataset ID and optional libraries filter
 * Output: Renders EnrichClientPage client component
 */
export default function EnrichPage(props: { searchParams: { dataset: string | string[] | undefined, libraries?: string } }) {
  return <EnrichClientPage searchParams={props.searchParams} />
}
