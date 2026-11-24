import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { libraryRead } from '@/lib/libraryDatabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  const id = String(req.query.id)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).end()
  try {
    const artifact = await libraryRead(async db => (await db.query(
      "SELECT metadata FROM app_public.library_artifact WHERE id=$1 AND metadata->>'status'='public'", [id]
    )).rows[0]?.metadata)
    if (!artifact?.objectKey) return res.status(404).end()
    if (!process.env.LIBRARY_S3_BUCKET) return res.status(503).end()
    // Sign the browser-reachable host; an internal Docker hostname cannot be rewritten after signing.
    const publicBase = process.env.PUBLIC_S3_URL || process.env.NEXT_PUBLIC_MINIO_URL
    const endpoint = process.env.LIBRARY_S3_PUBLIC_ENDPOINT || process.env.INGEST_S3_ENDPOINT ||
      (process.env.MINIO_ENDPOINT && publicBase ? new URL(publicBase).origin : undefined)
    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1', endpoint, forcePathStyle: Boolean(endpoint),
      ...(process.env.MINIO_ENDPOINT && !process.env.INGEST_S3_ENDPOINT ? {
        credentials: { accessKeyId: process.env.MINIO_ROOT_USER!, secretAccessKey: process.env.MINIO_ROOT_PASSWORD! },
      } : {}),
    })
    const url = await getSignedUrl(client, new GetObjectCommand({
      Bucket: process.env.LIBRARY_S3_BUCKET, Key: artifact.objectKey,
      ResponseContentDisposition: `attachment; filename="${artifact.objectKey.split('/').pop().replace(/["\r\n]/g, '')}"`,
    }), { expiresIn: 300 })
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(307, url)
  } catch (error) {
    console.error('Library artifact unavailable', error)
    res.status(503).end()
  }
}
