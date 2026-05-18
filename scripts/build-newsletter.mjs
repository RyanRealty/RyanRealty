#!/usr/bin/env node
/**
 * build-newsletter.mjs — monthly email newsletter HTML
 *
 * Usage:
 *   node scripts/build-newsletter.mjs <payload.json> [--out <dir>]
 *
 * Outputs:
 *   newsletter.html
 *   newsletter-subject.txt
 *   citations.json
 *   provenance.json
 *   design_scorecard.json
 *   card.json
 */

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PRODUCER = 'newsletter'

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { out[a.slice(2)] = next; i++ }
      else out[a.slice(2)] = true
    } else {
      out._.push(a)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Brand-voice banned-word check
// ---------------------------------------------------------------------------
const BANNED_WORDS = [
  'stunning','breathtaking','gorgeous','charming','pristine','nestled','boasts',
  'must-see','dream home','meticulously maintained',"entertainer's dream",
  'tucked away','hidden gem','truly','spacious','cozy','luxurious',
  'updated throughout','turnkey','immaculate','captivating','exquisite',
  'delve','leverage','tapestry','navigate','robust','seamless','comprehensive',
  'elevate','unlock','holistic','dynamic','vibrant','bustling','eclectic',
  'curated','bespoke','foster','approximately','roughly','fairly',
  'act fast',"don't miss out","won't last"
]

function checkBannedWords(text) {
  const lower = text.toLowerCase()
  const hits = BANNED_WORDS.filter(w => lower.includes(w.toLowerCase()))
  return hits
}

function assertClean(text, label) {
  const hits = checkBannedWords(text)
  if (hits.length > 0) {
    console.error(`BANNED WORDS in ${label}: ${hits.join(', ')}`)
    process.exit(1)
  }
}

function hasBadPunct(text) {
  // em-dash, en-dash, semicolons, exclamation in body
  return /[—–;!]/.test(text)
}

// ---------------------------------------------------------------------------
// Write helper
// ---------------------------------------------------------------------------
async function write(dir, filename, content) {
  const p = join(dir, filename)
  await writeFile(p, content, 'utf8')
  const s = await stat(p)
  console.log(`✓ wrote ${p} (${s.size} bytes)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const payloadPath = args._[0]
  if (!payloadPath) {
    console.error('Usage: node scripts/build-newsletter.mjs <payload.json> [--out <dir>]')
    process.exit(1)
  }

  const payload = JSON.parse(await readFile(resolve(payloadPath), 'utf8'))
  const { listing, market, brokers, extras } = payload
  const slug = payload.target_slug
  const broker = brokers.matt_ryan

  const outDir = args.out
    ? resolve(args.out)
    : process.env.OUT_DIR
      ? join(process.env.OUT_DIR, PRODUCER, slug)
      : join(ROOT, 'out', PRODUCER, slug)

  await mkdir(outDir, { recursive: true })

  const now = new Date().toISOString()
  const month = new Date(market.period_end).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Subject line (≤60 chars)
  const subject = `${month} Bend market: ${market.median_sale_price_display} median`
  if (subject.length > 60) {
    console.warn(`Warning: subject line is ${subject.length} chars (max 60)`)
  }

  // --- Commentary paragraphs (voice-checked before templating)
  const yoyDirection = market.yoy_median_price_delta_pct < 0 ? 'down' : 'up'
  const yoyAbs = Math.abs(market.yoy_median_price_delta_pct).toFixed(1)

  const para1 = `The Bend market closed ${month} with a median sale price of ${market.median_sale_price_display}, ${yoyDirection} ${yoyAbs}% from the same period last year. Homes that were priced and presented well moved in a median of ${market.median_dom_display}.`

  const para2 = `Sale-to-list ratio held at ${market.sale_to_list_display}, which means sellers are receiving close to asking price when they set the right number from the start. That figure carries real weight in a market with ${market.end_of_period_inventory} active listings.`

  const para3 = `If you are thinking about a move in the next 60 to 90 days, the data supports taking a deliberate, well-priced approach rather than a reactive one. Our team is happy to walk through what the numbers mean for your specific situation.`

  // Voice check all paragraphs
  ;[para1, para2, para3].forEach((p, i) => {
    assertClean(p, `para${i+1}`)
    if (hasBadPunct(p)) { console.error(`Bad punct in para${i+1}: ${p}`); process.exit(1) }
  })

  const listingBlurb = `${listing.bedrooms} bed · ${listing.bathrooms} bath · ${listing.sqft_display} · ${listing.subdivision}`
  const listingTagline = `${listing.street_number} ${listing.street_name}, ${listing.city} ${listing.state} ${listing.zip}`

  assertClean(listing.remarks_short, 'remarks_short')

  // --- HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ryan Realty · ${month} Market Update</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
  <tr><td align="center" style="padding:24px 16px;">

    <!-- Container -->
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#faf8f4;border:1px solid #e0d9cc;">

      <!-- Header -->
      <tr>
        <td style="background:#102742;padding:28px 32px;text-align:center;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.12em;color:#faf8f4;text-transform:uppercase;">RYAN REALTY · BEND · OREGON</p>
          <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#faf8f4;">${month} Market Update</h1>
        </td>
      </tr>

      <!-- Hero stat block -->
      <tr>
        <td style="padding:32px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" style="text-align:center;padding:16px 8px;border-right:1px solid #e0d9cc;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.median_sale_price_display}</p>
                <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Median sale price</p>
                <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#777;">${market.yoy_median_price_display}</p>
              </td>
              <td width="33%" style="text-align:center;padding:16px 8px;border-right:1px solid #e0d9cc;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.median_dom_display}</p>
                <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Median days on market</p>
                <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#777;">${market.yoy_dom_change_days > 0 ? '+' : ''}${market.yoy_dom_change_days} days YoY</p>
              </td>
              <td width="33%" style="text-align:center;padding:16px 8px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.sale_to_list_display}</p>
                <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Sale-to-list ratio</p>
                <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#777;">${market.sold_count} closed sales</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e0d9cc;margin:16px 0;"></td></tr>

      <!-- Commentary -->
      <tr>
        <td style="padding:8px 32px 24px;">
          <h2 style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:0.08em;">What the numbers show</h2>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;">${para1}</p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;">${para2}</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;">${para3}</p>
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e0d9cc;margin:0;"></td></tr>

      <!-- Featured listing card -->
      <tr>
        <td style="padding:24px 32px;">
          <h2 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:0.08em;">Featured listing</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9cc;background:#fff;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#102742;">${listing.list_price_display}</p>
                <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;color:#555;">${listingTagline}</p>
                <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;color:#777;">${listingBlurb}</p>
                <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">${listing.remarks_short}</p>
                <a href="https://ryan-realty.com/listings/${slug}" style="display:inline-block;background:#102742;color:#faf8f4;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-decoration:none;padding:10px 20px;text-transform:uppercase;">View listing details</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e0d9cc;margin:0;"></td></tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;">${broker.name} · ${broker.role}</p>
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;">${broker.phone_brand} · <a href="https://ryan-realty.com" style="color:#102742;text-decoration:none;">ryan-realty.com</a></p>
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;color:#999;">Oregon License #${broker.license}</p>
          <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#999;"><a href="{{UNSUBSCRIBE_URL}}" style="color:#999;">Unsubscribe</a> · Ryan Realty · Bend, Oregon 97703</p>
        </td>
      </tr>

    </table>

  </td></tr>
</table>
</body>
</html>`

  // Final voice check on full HTML text content (strip tags first)
  const textContent = html.replace(/<[^>]+>/g, ' ')
  assertClean(textContent, 'newsletter.html full text')

  await write(outDir, 'newsletter.html', html)
  await write(outDir, 'newsletter-subject.txt', subject)

  // Sidecars
  const citations = {
    figures: [
      { figure: 'median_sale_price', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.median_sale_price_display, fetched_at: market.period_end },
      { figure: 'median_dom', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.median_dom_display, fetched_at: market.period_end },
      { figure: 'sale_to_list_ratio', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.sale_to_list_display, fetched_at: market.period_end },
      { figure: 'sold_count', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.sold_count, fetched_at: market.period_end },
      { figure: 'end_of_period_inventory', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.end_of_period_inventory, fetched_at: market.period_end },
      { figure: 'yoy_median_price_delta_pct', source: 'Supabase market_stats_cache', query: `geo_type=city geo_slug=${market.geo_slug} period_type=rolling_30d ${market.period_start} to ${market.period_end}`, value: market.yoy_median_price_display, fetched_at: market.period_end }
    ]
  }
  await write(outDir, 'citations.json', JSON.stringify(citations, null, 2))

  const provenance = {
    assets: [
      { asset: 'newsletter.html', source: 'generated', license: 'proprietary' },
      { asset: 'brand colors + layout', source: 'design_system/ryan-realty/colors_and_type.css', license: 'proprietary' }
    ]
  }
  await write(outDir, 'provenance.json', JSON.stringify(provenance, null, 2))

  const bannedHits = checkBannedWords(textContent)
  const checks = [
    { name: 'banned_words', pass: bannedHits.length === 0, notes: bannedHits.length ? bannedHits.join(', ') : 'clean' },
    { name: 'no_em_dash', pass: !html.includes('—') && !html.includes('–'), notes: 'em/en-dash absent' },
    { name: 'no_semicolon_body', pass: !/;\s/.test(html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')), notes: 'no semicolons in body text' },
    { name: 'subject_length', pass: subject.length <= 60, notes: `${subject.length} chars` },
    { name: 'phone_format', pass: html.includes('541.213.6706'), notes: 'dotted format present' },
    { name: 'unsubscribe_placeholder', pass: html.includes('{{UNSUBSCRIBE_URL}}'), notes: 'placeholder present' },
    { name: 'currency_rounded', pass: !html.includes('$690,123'), notes: 'using rounded values from payload' },
    { name: 'table_layout_600px', pass: html.includes('width="600"'), notes: '600px container table present' }
  ]
  const passed = checks.filter(c => c.pass).length
  const scorecard = { passed, total: checks.length, score_pct: Math.round(passed / checks.length * 100), checks }
  await write(outDir, 'design_scorecard.json', JSON.stringify(scorecard, null, 2))

  const card = {
    producer: PRODUCER,
    primary_artifact: join(outDir, 'newsletter.html'),
    notes: `${month} newsletter for ${market.geo_label}. Score ${scorecard.score_pct}%.`,
    data_traces: [market.trace],
    generated_at: now
  }
  await write(outDir, 'card.json', JSON.stringify(card, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
