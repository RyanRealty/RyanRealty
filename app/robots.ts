import type { MetadataRoute } from 'next'

/**
 * Dynamic robots.txt for SEO and AI/LLM discoverability.
 *
 * Allows all major search engine crawlers AND AI crawlers (GPTBot, PerplexityBot,
 * ClaudeBot, etc.) to index public content. This is critical for:
 * - Google search rankings
 * - Google AI Overviews / SGE citations
 * - ChatGPT / OpenAI search citations
 * - Perplexity AI citations
 * - Claude / Anthropic citations
 * - Apple Intelligence / Siri
 */
export default function robots(): MetadataRoute.Robots {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ryanrealty.vercel.app'
  // Always use https for production sitemap reference
  const baseUrl = envUrl.replace(/^http:\/\/localhost.*/, 'https://ryanrealty.vercel.app').replace(/^http:\/\//, 'https://')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/dashboard/', '/account/', '/api/', '/auth/'],
      },
      // Explicitly allow AI crawlers for LLM citation
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
