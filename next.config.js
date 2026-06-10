/** @type {import('next').NextConfig} */

const NEXT_PUBLIC_MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL ?? process.env.PUBLIC_S3_URL
if (!NEXT_PUBLIC_MINIO_URL) throw new Error("Please configure PUBLIC_S3_URL");

const nextConfig = {
  experimental: {
    serverActions: true,
  },
  env: {
    NEXT_PUBLIC_MINIO_URL,
  },
  async rewrites() {
    return [
      {
        source: '/graphql',
        destination: '/api/graphql',
      },
      {
        source: '/graphiql',
        destination: '/api/graphiql',
      },
    ]
  },
}

module.exports = nextConfig
