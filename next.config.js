/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  experimental: {
    // Framework copy budget includes multipart overhead; the handler still enforces 10 MiB files.
    middlewareClientMaxBodySize: '11mb',
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
