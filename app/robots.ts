import type { MetadataRoute } from 'next'

/**
 * Dynamic robots.txt for SEO. Points crawlers to sitemap and allows indexing.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ryan-realty.com'
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/dashboard/', '/api/', '/auth/', '/compare'] },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
