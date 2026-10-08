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
// /api/og must stay crawlable: social scrapers (facebookexternalhit, Twitterbot,
// Slackbot, LinkedInBot, Discordbot, WhatsApp) fetch it to render link-preview
// cards. A longer Allow beats the /api/ Disallow.
const PUBLIC_ALLOW = ['/', '/api/og', '/llms.txt']
const PRIVATE_PAGES = ['/admin/', '/dashboard/', '/account/', '/auth/', '/mockup-preview/', '/dev/']
const PRIVATE_DISALLOW = [...PRIVATE_PAGES, '/api/']

const NAMED_CRAWLERS = [
  // AI retrieval / answer crawlers: these drive live citations.
  'OAI-SearchBot', // ChatGPT search citations
  'ChatGPT-User', // ChatGPT user-triggered browsing
  'PerplexityBot', // Perplexity search index
  'Perplexity-User', // Perplexity user-triggered fetch
  'Claude-SearchBot', // Claude search index
  'Claude-User', // Claude user-initiated fetch
  'Claude-Web',
  'Applebot', // Siri / Apple Intelligence search
  'YouBot', // You.com AI search
  'meta-externalagent', // Meta AI search
  'Amazonbot', // Amazon / Alexa AI
  // Googlebot + Bingbot ARE the crawlers for Google AI Overviews + Bing Copilot.
  'Googlebot',
  'Bingbot',
  // Model-training crawlers: low cost, no downside for a visibility-seeking site.
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
] as const

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalSiteUrl()
  return {
    rules: [
      { userAgent: '*', allow: PUBLIC_ALLOW, disallow: PRIVATE_DISALLOW },
      // A crawler obeys only the most specific group that names it and ignores
      // `*`, so a bare `allow: '/'` here used to hand Googlebot, Bingbot and
      // every AI crawler /admin/ and /dev/ (SEO review 2026-10-04). They keep
      // /api/: Google renders pages with JavaScript, and a client fetch to a
      // blocked /api/ route is content Google cannot see.
      { userAgent: [...NAMED_CRAWLERS], allow: '/', disallow: PRIVATE_PAGES },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
