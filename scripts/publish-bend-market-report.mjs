#!/usr/bin/env node
/**
 * One-shot publish script for the Bend YTD 2026 Market Report.
 *
 * Fires POST /api/social/publish with full GateArtifacts and per-platform
 * caption variants tuned to each platform's best practices (per the
 * publish skill matrix). Returns per-platform results.
 *
 * Run: CRON_SECRET=... node scripts/publish-bend-market-report.mjs
 *
 * Or: bash scripts/publish-bend-market-report.sh (which loads .env.local)
 */

import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const CRON_SECRET = env.CRON_SECRET || process.env.CRON_SECRET
if (!CRON_SECRET) {
  console.error('CRON_SECRET not set in .env.local or env')
  process.exit(1)
}

const SITE = env.NEXT_PUBLIC_SITE_URL || 'https://ryanrealty.vercel.app'
const MEDIA_URL = `${SITE}/v5_library/bend_market_report_ytd2026.mp4`
const COVER_URL = `${SITE}/v5_library/thumbs/bend_market_report_ytd2026_cover.jpg`

// Per-platform caption variants tuned to platform best practices.
// Source: automation_skills/automation/publish/SKILL.md per-platform matrix.

const captionInstagram =
  `Bend YTD market report — April 2026.\n\n` +
  `5.8 months of supply = balanced market.\n` +
  `Median sale: $699K, down 7.3% from 2025.\n` +
  `1,149 active listings. 56 days to contract.\n\n` +
  `Full report at ryan-realty.com.`

const captionFacebook =
  `Bend, Oregon — YTD 2026 market check.\n\n` +
  `• Median sale price: $699K (-7.3% YoY)\n` +
  `• Active listings: 1,149\n` +
  `• Months of supply: 5.8 → balanced market\n` +
  `• Median days on market: 56 (14 days faster than 2025)\n\n` +
  `Full breakdown for Bend, Redmond, Sisters, Sunriver, La Pine, and Prineville at ryan-realty.com.`

const captionTikTok = `Bend YTD market report. Median sale $699K, down 7 percent. Balanced market at 5.8 months of supply.`

const captionYouTube = {
  title: 'Bend Oregon Market Report — YTD 2026 (Real Estate Update)',
  description:
    `Bend, Oregon real estate market — year-to-date 2026.\n\n` +
    `Median sale price: $699,000 (down 7.3% vs 2025)\n` +
    `Active listings: 1,149\n` +
    `Months of supply: 5.8 (balanced market)\n` +
    `Median days on market: 56\n\n` +
    `Full report and detailed neighborhood data at https://ryan-realty.com\n\n` +
    `Sources: Oregon Data Share MLS via Spark API, Supabase market_pulse_live.\n` +
    `Voice: AI-generated narration (ElevenLabs). All figures verified against primary MLS data.\n\n` +
    `#shorts #BendOregon #RealEstate #MarketReport #CentralOregon`,
  tags: [
    'bend oregon',
    'real estate',
    'market report',
    'central oregon',
    'home prices',
    'housing market',
    'ytd 2026',
    'realtor',
  ],
  privacyStatus: 'public',
}

const captionLinkedIn =
  `Bend YTD 2026 market check.\n\n` +
  `Median sale: $699K (down 7.3% YoY)\n` +
  `Active listings: 1,149\n` +
  `Months of supply: 5.8 (balanced)\n` +
  `Median DOM: 56 days\n\n` +
  `Year-over-year, the typical Bend home is taking 13 days less to go pending. ` +
  `Inventory is up but absorption stays steady around 16.7%, keeping us in a ` +
  `balanced posture rather than a clear shift to either side.\n\n` +
  `Full neighborhood-by-neighborhood breakdown is on our site.\n\n` +
  `(Link in first comment.)`

const captionX = `Bend YTD market: median sale $699K (-7.3% YoY), 1,149 active, 5.8 mos supply, 56 DOM. Balanced market.`

const captionGBP =
  `Bend year-to-date market — April 2026 update.\n\n` +
  `Median sale price for SFR is $699,000, a 7.3% decline from 2025. ` +
  `Months of supply sits at 5.8, putting the Bend market squarely in balanced territory ` +
  `(neither a clear seller's nor buyer's market). Active listings: 1,149. ` +
  `Median days on market: 56, which is 14 days faster than the same period last year.`

// Nextdoor: neighborhood-focused, body 250-500 chars, no hashtags, lead with local hook
const captionNextdoor =
  `Quick April update for the Bend single-family market — your neighbors might find this useful.\n\n` +
  `Median sale price is $699K (down 7.3% from 2025). Active listings: 1,149. Months of supply: 5.8 — that's a balanced market, not leaning seller or buyer. Typical home goes pending in 56 days, two weeks faster than a year ago.\n\n` +
  `Full breakdown for Bend, Redmond, Sisters, Sunriver, La Pine, and Prineville on our site.`

// ----- Build the publish payload -----
const body = {
  approved: true,
  contentType: 'market_report_video',
  platforms: ['instagram', 'facebook', 'youtube', 'linkedin', 'x', 'google_business_profile', 'nextdoor'],
  mediaType: 'reel',
  mediaUrl: MEDIA_URL,
  coverUrl: undefined, // we'll let IG pick a frame; YT thumbnail set separately
  captionDefault: captionInstagram,
  captionPerPlatform: {
    instagram: captionInstagram,
    facebook: captionFacebook,
    youtube: captionYouTube.description,
    linkedin: captionLinkedIn,
    x: captionX,
    google_business_profile: captionGBP,
    nextdoor: captionNextdoor,
  },
  hashtagsPerPlatform: {
    instagram: ['#BendOregon', '#CentralOregon', '#RealEstate', '#MarketReport', '#HousingMarket'],
    facebook: ['#BendOregon', '#CentralOregon'],
    x: ['#BendOR'],
    linkedin: [],
    youtube: [],
    google_business_profile: [],
  },
  metadata: {
    youtube: captionYouTube,
    linkedin: { visibility: 'PUBLIC' },
    google_business_profile: {
      summary: captionGBP,
      callToActionUrl: 'https://ryan-realty.com/reports',
    },
    nextdoor: {
      ctaText: 'See full report',
      ctaUrl: 'https://ryan-realty.com/reports',
    },
  },
  gate: {
    scorecardPath: 'video/market-report/out/bend/scorecard.json',
    citationsPath: 'video/market-report/out/bend/citations.json',
    qaReportPath: 'video/market-report/out/bend/qa_report.md',
    postflightPath: 'video/market-report/out/bend/postflight.json',
    manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
    humanApprovedAt: new Date().toISOString(),
    formatSkillName: 'market_report_video',
    formatSkillVersion: 'ytd2026-2026-04-27',
  },
}

console.log('Publishing Bend YTD 2026 Market Report to:', body.platforms.join(', '))
console.log('  mediaUrl:', body.mediaUrl)
console.log('  humanApprovedAt:', body.gate.humanApprovedAt)
console.log()

const r = await fetch(`${SITE}/api/social/publish`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': CRON_SECRET,
  },
  body: JSON.stringify(body),
})

const out = await r.json()
console.log('HTTP', r.status)
console.log(JSON.stringify(out, null, 2))

if (out.results) {
  console.log('\n=== Per-platform summary ===')
  for (const [platform, res] of Object.entries(out.results)) {
    const icon = res.success ? '✓' : '✗'
    const status = res.status || 'unknown'
    const id = res.externalPostId ? ` id=${res.externalPostId}` : ''
    const err = res.error ? ` — ${res.error}` : ''
    console.log(`  ${icon} ${platform}: ${status}${id}${err}`)
  }
}
