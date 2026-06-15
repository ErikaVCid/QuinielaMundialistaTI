import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // External image domains used in the app
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: 'r2.thesportsdb.com' },
      { protocol: 'https', hostname: 'www.thesportsdb.com' },
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'cdn.sportmonks.com' },
    ],
  },

  // Fix turbopack workspace root warning (duplicate lockfile at ~/package-lock.json)
  turbopack: {
    root: __dirname,
  },

  // Silence noisy hydration warnings in development
  reactStrictMode: true,

  // Tell Next.js we're building a standalone app (better for Docker/serverless)
  // output: 'standalone',  // uncomment if you prefer standalone output

  // Redirect www → non-www in production (optional)
  // async redirects() {
  //   return [{ source: '/:path*', has: [{ type: 'host', value: 'www.tu-dominio.com' }], destination: 'https://tu-dominio.com/:path*', permanent: true }]
  // },
}

export default nextConfig
