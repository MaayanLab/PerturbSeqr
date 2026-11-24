import type { NextApiRequest, NextApiResponse } from 'next'
import { libraryRead } from '@/lib/libraryDatabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  try {
    if (req.method === 'POST') {
      const key = req.body?.key
      if (typeof key !== 'string' || key.length > 1024) return res.status(400).end()
      const row = await libraryRead(async db => (await db.query('SELECT * FROM app_public.increment_file_download($1)', [key])).rows[0], false)
      return res.status(row ? 200 : 404).json(row ?? {})
    }
    const rows = await libraryRead(async db => (await db.query('SELECT key,count FROM app_public.file_download')).rows)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(Object.fromEntries(rows.map(row => [row.key, Number(row.count)])))
  } catch (error) {
    console.error('Download counts unavailable', error)
    res.status(503).json({ error: 'Download counts unavailable' })
  }
}
