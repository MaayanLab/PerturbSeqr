import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import MatcherClientPage from './client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { searchParams?: { q?: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Matcher ${props.searchParams?.q ?? ''}`,
    keywords: parentMetadata.keywords,
  }
}

export default function MatcherPage() {
  return <MatcherClientPage />
}
