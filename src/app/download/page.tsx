import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import DownloadClientPage from './client'
import libraries from '@/config/libraries.json'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Downloads`,
    keywords: parentMetadata.keywords,
  }
}

function formatBytes(n: number): string {
  if (!n) return ''
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

const MINIO_BASE = process.env.NEXT_PUBLIC_MINIO_URL

// Read each GMT's compressed size straight off MinIO via a server-side HEAD (Content-Length).
// Server-side because MinIO sends no CORS headers (a browser fetch would be blocked). URLs are
// derived from the canonical slug list (src/config/libraries.json) — same construction the
// download cards use, so the keys match dataset.gmtUrl. Runs at build for the static page;
// falls back to no size if a file is unreachable.
async function fetchGmtSizes(): Promise<Record<string, string>> {
  const urls = Object.keys(libraries.libraries).map(slug => `${MINIO_BASE}/${slug}.gmt.gz`)
  const entries = await Promise.all(urls.map(async url => {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      return [url, formatBytes(Number(res.headers.get('content-length')))] as const
    } catch {
      return [url, ''] as const
    }
  }))
  return Object.fromEntries(entries.filter(([, size]) => size))
}

export default async function DownloadPage() {
  return <DownloadClientPage gmtSizes={await fetchGmtSizes()} />
}
