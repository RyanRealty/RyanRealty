/**
 * SEO: revalidate sitemap and ping Google after delta sync. Step 20 Task 7.
 */

import { inngest } from '@/lib/inngest'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? process.env.INNGEST_SIGNING_KEY

export const regenerateSitemap = inngest.createFunction(
  { id: 'seo/regenerate-sitemap', name: 'Regenerate sitemap & ping Google', retries: 1 },
  { event: 'seo/regenerate-sitemap' },
  async ({ step }) => {
    await step.run('revalidate-sitemap', async () => {
      if (!REVALIDATE_SECRET?.trim()) {
        return { revalidated: false, reason: 'REVALIDATE_SECRET not set' }
      }
      const url = `${SITE_URL}/api/revalidate?secret=${encodeURIComponent(REVALIDATE_SECRET)}&path=/sitemap.xml`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Revalidate failed: ${res.status} ${text}`)
      }
      return { revalidated: true }
    })

    await step.run('ping-google', async () => {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`
      const res = await fetch(pingUrl, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Google ping failed: ${res.status}`)
      }
      return { pinged: true }
    })

    return { ok: true }
  }
)
