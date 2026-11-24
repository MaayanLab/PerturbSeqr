'use client'
import React from 'react'
import useSWR from 'swr'

export default function DownloadLink({ url, label, objectKey, size }: {
  url: string; label: string; objectKey?: string; size?: string;
}) {
  const base = process.env.NEXT_PUBLIC_MINIO_URL
  const key = objectKey || (base && url.startsWith(base + '/') ? url.slice(base.length + 1) : undefined)
  const { data: counts, mutate } = useSWR<Record<string, number>>(key ? '/api/library-downloads' : null, async endpoint => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Counts unavailable')
    return response.json()
  }, { refreshInterval: 60000 })
  const count = key && counts ? counts[key] ?? 0 : undefined
  const details = [size && `${size} compressed`, count !== undefined ? `${count.toLocaleString()} download${count === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
  return <>
    <a href={url} download className="link link-neutral" onClick={() => {
      if (!key) return
      fetch('/api/library-downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }), keepalive: true })
        .then(response => response.ok ? response.json() : null)
        .then(row => { if (row) mutate((current: Record<string, number> | undefined) => ({ ...current, [row.key]: Number(row.count) }), false) })
        .catch(() => {})
    }}>{label}</a>
    {details && <span className="text-gray-400"> ({details})</span>}
  </>
}
