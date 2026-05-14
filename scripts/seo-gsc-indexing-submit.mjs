#!/usr/bin/env node
/**
 * Submit URLs to Google's Indexing API to nudge re-indexing.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seo-gsc-indexing-submit.mjs
 *
 * Note: the Indexing API requires:
 *   1. The service account has the `https://www.googleapis.com/auth/indexing` scope
 *   2. The service account is added as a verified owner of the GSC property
 *
 * Google officially supports the Indexing API for JobPosting and BroadcastEvent
 * structured data. It's documented as not for general re-indexing, but in practice
 * Google has been observed to use it as a recrawl signal. Worst case, it returns
 * 403 and we fall back to natural recrawl.
 */

import { google } from 'googleapis'

const URLS_TO_SUBMIT = [
  // Week 1 title + meta updates (Yoast field changes — moderate signal)
  'https://ryan-realty.com/bend-oregon-market-report-may-2026/',
  'https://ryan-realty.com/bend-building-permit-timeline-construction/',
  'https://ryan-realty.com/contact/',
  'https://ryan-realty.com/about-us/',
  'https://ryan-realty.com/bend-oregon-cost-of-living-2026/',
  'https://ryan-realty.com/explore/bend/',
  'https://ryan-realty.com/explore/bend/tanager/',
  'https://ryan-realty.com/explore/bend/tumalo/',
  'https://ryan-realty.com/explore/bend/northwest-crossing/',
  'https://ryan-realty.com/explore/bend/rivers-edge-village/',
  'https://ryan-realty.com/explore/bend/valhalla-heights/',
  'https://ryan-realty.com/explore/bend/tree-farm/',
  'https://ryan-realty.com/explore/sisters/the-rim-at-aspen-lakes/',
  // Week 3 new + upgraded pages
  'https://ryan-realty.com/sell-your-bend-oregon-home/',
  'https://ryan-realty.com/bend-oregon-realtor/',
  'https://ryan-realty.com/relocating-to-bend-oregon/',
  // Broker pages
  'https://ryan-realty.com/matt-ryan/',
  'https://ryan-realty.com/paul-stevenson/',
  'https://ryan-realty.com/rebecca-ryser-peterson/',
]

async function main() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  if (!clientEmail || !privateKeyRaw) {
    console.error('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY required in env')
    process.exit(1)
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/indexing'],
  })

  const indexing = google.indexing({ version: 'v3', auth })

  const results = []
  for (const url of URLS_TO_SUBMIT) {
    try {
      const res = await indexing.urlNotifications.publish({
        requestBody: {
          url,
          type: 'URL_UPDATED',
        },
      })
      results.push({ url, status: 'ok', notifyTime: res.data?.urlNotificationMetadata?.latestUpdate?.notifyTime })
      console.log(`  ✓ submitted: ${url}`)
    } catch (e) {
      const msg = e?.message || String(e)
      results.push({ url, status: 'err', err: msg.slice(0, 200) })
      console.error(`  ✗ failed: ${url} — ${msg.slice(0, 120)}`)
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length
  const errCount = results.filter(r => r.status === 'err').length
  console.log(`\nSubmission summary: ${okCount} OK, ${errCount} errors out of ${URLS_TO_SUBMIT.length}`)

  if (errCount > 0) {
    console.log('\nIf you see 403 errors: the service account needs to be added as a verified owner of the GSC property.')
    console.log('Add via: Google Search Console → Settings → Users and permissions → Add user → ' + clientEmail)
  }
}

main().catch(e => {
  console.error('Fatal error:', e?.message || e)
  process.exit(1)
})
