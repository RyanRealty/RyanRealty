#!/usr/bin/env node
/**
 * Submit the sitemap to Google Search Console via the webmasters API.
 *
 * The Indexing API requires Verified Owner status (service account needs DNS/HTML
 * verification, not just "Full" user permission). Sitemap submission via webmasters
 * API requires only "Full" permission.
 *
 * After this run: Google will recrawl based on the sitemap's lastmod timestamps.
 * The site's sitemap was auto-rebuilt by Yoast at 14:09 today after all the edits.
 *
 * Usage: node --env-file=.env.local scripts/seo-gsc-sitemap-submit.mjs
 */

import { google } from 'googleapis'

const SITE_URL = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'
const SITEMAPS = [
  'https://ryan-realty.com/sitemap_index.xml',
  'https://ryan-realty.com/page-sitemap.xml',
  'https://ryan-realty.com/post-sitemap.xml',
]

async function main() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  if (!clientEmail || !privateKeyRaw) {
    console.error('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY required')
    process.exit(1)
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters'], // full webmasters, not readonly
  })

  const webmasters = google.webmasters({ version: 'v3', auth })

  for (const feedpath of SITEMAPS) {
    try {
      // PUT submits the sitemap (idempotent — re-submission is fine and forces a re-crawl signal)
      await webmasters.sitemaps.submit({
        siteUrl: SITE_URL,
        feedpath,
      })
      console.log(`  ✓ submitted: ${feedpath}`)
    } catch (e) {
      console.error(`  ✗ failed: ${feedpath} — ${e?.message?.slice(0, 200) || e}`)
    }
  }

  // Also list current sitemaps + their status
  console.log('\nCurrent sitemap registry in GSC:')
  try {
    const list = await webmasters.sitemaps.list({ siteUrl: SITE_URL })
    for (const s of list.data.sitemap || []) {
      console.log(`  ${s.path} — lastSubmitted: ${s.lastSubmitted} — lastDownloaded: ${s.lastDownloaded} — warnings: ${s.warnings || 0} — errors: ${s.errors || 0}`)
    }
  } catch (e) {
    console.error('  list failed:', e?.message?.slice(0, 200))
  }
}

main().catch(e => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
