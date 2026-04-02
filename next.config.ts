import type { NextConfig } from 'next'
import path from 'path'
import fs from 'fs'

/**
 * Load Supabase vars from .env.local so they win over Cursor's Supabase plugin
 * (which can inject a different project URL when you run dev from Cursor).
 */
function loadSupabaseEnvFromLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const p = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (
          key === 'NEXT_PUBLIC_SUPABASE_URL' ||
          key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ||
          key === 'SUPABASE_SERVICE_ROLE_KEY'
        ) {
          if (value) out[key] = value
        }
      }
    }
  } catch {
    // ignore
  }
  return out
}

const supabaseFromEnvLocal = loadSupabaseEnvFromLocal()

// PWA: Serwist requires webpack. Next 16 defaults to Turbopack; use `next build --webpack` to enable SW.
// Manifest + offline page + InstallPrompt work without the service worker.
const nextConfig: NextConfig = {
  // Turbopack: use project dir as root so @/ resolves correctly when multiple lockfiles exist (e.g. parent folder).
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  env: {
    ...(supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_URL && {
      NEXT_PUBLIC_SUPABASE_URL: supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_URL,
    }),
    ...(supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY && {
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }),
    ...(supabaseFromEnvLocal.SUPABASE_SERVICE_ROLE_KEY && {
      SUPABASE_SERVICE_ROLE_KEY: supabaseFromEnvLocal.SUPABASE_SERVICE_ROLE_KEY,
    }),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'replication.sparkapi.com', pathname: '/**' },
      { protocol: 'https', hostname: 'sparkapi.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.resize.sparkplatform.com', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // SEO: canonical URLs use /homes-for-sale (keyword-rich). Old /search links redirect.
  async redirects() {
    return [
      { source: '/search', destination: '/homes-for-sale', permanent: true },
      { source: '/search/:path*', destination: '/homes-for-sale/:path*', permanent: true },
      { source: '/listings', destination: '/homes-for-sale', permanent: true },
      { source: '/listings/:listingKey', destination: '/listing/:listingKey', permanent: true },
      { source: '/homes-for-sale/in/listing/:listingKey', destination: '/homes-for-sale/listing/:listingKey', permanent: true },
      { source: '/homes-for-sale/in/:path*', destination: '/homes-for-sale/:path*', permanent: true },
      { source: '/home-valuation', destination: '/sell/valuation', permanent: true },
      { source: '/sign-in', destination: '/login', permanent: true },
      { source: '/sign-in/:path*', destination: '/login/:path*', permanent: true },
      { source: '/agents', destination: '/team', permanent: true },
      { source: '/agents/:slug', destination: '/team/:slug', permanent: true },
      { source: '/reports', destination: '/housing-market/reports', permanent: true },
      { source: '/reports/explore', destination: '/housing-market/explore', permanent: true },
      { source: '/reports/:slug/:geoName', destination: '/housing-market/reports/:slug/:geoName', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/homes-for-sale/listing/:listingKey', destination: '/listing/by-key/:listingKey' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*-[0-9]{5})', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*-[0-9]{5})', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale', destination: '/search' },
      { source: '/homes-for-sale/:path*', destination: '/search/:path*' },
    ];
  },
  // Avoid "Body exceeded 1 MB limit" → browser "Failed to fetch" (e.g. Server Actions with images/large payloads)
  experimental: {
    optimizePackageImports: ['@hugeicons/react', '@hugeicons/core-free-icons', 'date-fns', 'recharts', '@react-email/components', 'radix-ui', '@react-google-maps/api', '@googlemaps/markerclusterer'],
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
