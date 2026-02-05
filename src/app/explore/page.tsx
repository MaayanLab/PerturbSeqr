import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import ExploreClientPage from './client'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Dataset Exploration`,
    keywords: parentMetadata.keywords,
  }
}

export default function ExplorePage() {
  return <ExploreClientPage />
}
