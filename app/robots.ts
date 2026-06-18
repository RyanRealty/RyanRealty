import type { MetadataRoute } from 'next'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'

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
  const baseUrl = getCanonicalSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        // /api/og must stay crawlable — social scrapers (facebookexternalhit,
        // Twitterbot, Slackbot, LinkedInBot, Discordbot, WhatsApp) fetch it to
        // render link-preview cards. A longer Allow beats the /api/ Disallow.
        allow: ['/', '/api/og'],
        disallow: ['/admin/', '/dashboard/', '/account/', '/api/', '/auth/', '/mockup-preview/'],
      },
      // AI retrieval / answer crawlers — these drive live citations (allow all).
      { userAgent: 'OAI-SearchBot', allow: '/' }, // ChatGPT search citations
      { userAgent: 'ChatGPT-User', allow: '/' }, // ChatGPT user-triggered browsing
      { userAgent: 'PerplexityBot', allow: '/' }, // Perplexity search index
      { userAgent: 'Perplexity-User', allow: '/' }, // Perplexity user-triggered fetch
      { userAgent: 'Claude-SearchBot', allow: '/' }, // Claude search index
      { userAgent: 'Claude-User', allow: '/' }, // Claude user-initiated fetch
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'Applebot', allow: '/' }, // Siri / Apple Intelligence search
      { userAgent: 'YouBot', allow: '/' }, // You.com AI search
      { userAgent: 'meta-externalagent', allow: '/' }, // Meta AI search
      { userAgent: 'Amazonbot', allow: '/' }, // Amazon / Alexa AI
      // Googlebot + Bingbot ARE the crawlers for Google AI Overviews + Bing Copilot.
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      // Model-training crawlers — low cost, no downside for a visibility-seeking site.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'Bytespider', allow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
