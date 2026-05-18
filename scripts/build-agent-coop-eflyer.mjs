#!/usr/bin/env node
/**
 * build-agent-coop-eflyer.mjs — agent co-op email flyer
 *
 * Usage:
 *   node scripts/build-agent-coop-eflyer.mjs <payload.json> [--out <dir>]
 *
 * Outputs:
 *   eflyer.html          (responsive ≤640px HTML email, inlined CSS)
 *   body.md              (plain-text markdown body)
 *   subject-line.txt     (≤60 chars)
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
const PRODUCER = 'agent-coop-eflyer'

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
  return BANNED_WORDS.filter(w => lower.includes(w.toLowerCase()))
}

function assertClean(text, label) {
  const hits = checkBannedWords(text)
  if (hits.length > 0) {
    console.error(`BANNED WORDS in ${label}: ${hits.join(', ')}`)
    process.exit(1)
  }
}

async function write(dir, filename, content) {
  const p = join(dir, filename)
  await writeFile(p, content, 'utf8')
  const s = await stat(p)
  console.log(`✓ wrote ${p} (${s.size} bytes)`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const payloadPath = args._[0]
  if (!payloadPath) {
    console.error('Usage: node scripts/build-agent-coop-eflyer.mjs <payload.json> [--out <dir>]')
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

  const addr = `${listing.street_number} ${listing.street_name}, ${listing.city}, OR ${listing.zip}`
  const addrShort = `${listing.street_number} ${listing.street_name}`

  // Subject line ≤60 chars, hook = address + price + question form
  const subject = `${addrShort} at ${listing.list_price_display}, available to show`
  const subjectTrimmed = subject.length > 60 ? subject.slice(0, 57) + '...' : subject

  // Showing placeholder
  const showingUrl = `https://ryan-realty.com/listings/${slug}?showing=1`

  // ---------------------------------------------------------------------------
  // Plain-text body (Markdown)
  // ---------------------------------------------------------------------------
  const body = `# ${addrShort} · ${listing.list_price_display}

Hello,

We have a new listing in ${listing.subdivision} that may be a good fit for your buyers.

**${addr}**
Listed at **${listing.list_price_display}**

${listing.remarks_short}

---

## Property details

| Feature | Detail |
|---|---|
| Bedrooms | ${listing.bedrooms} |
| Bathrooms | ${listing.bathrooms} |
| Square feet | ${listing.sqft_display} |
| Lot size | ${listing.lot_acres} acres |
| Year built | ${listing.year_built} |
| List price | ${listing.list_price_display} |
| Price per sqft | $${Math.round(listing.list_price / listing.sqft).toLocaleString()} |

---

## Area context

- Downtown Bend: ${extras.drive_times.downtown_bend}
- Mt. Bachelor: ${extras.drive_times.mt_bachelor}
- St. Charles Hospital: ${extras.drive_times.st_charles_bend}
- Tumalo Elementary: ${extras.drive_times.tumalo_elementary}

---

## Bend market snapshot, last 30 days

Median sale price: ${market.median_sale_price_display} · Median DOM: ${market.median_dom_display} · Sale-to-list: ${market.sale_to_list_display}

---

## Commission

Buyer's agent commission: **2.5%** gross sale price.

## Schedule a showing

Call or text ${broker.name} at ${broker.phone_brand}, or use the link below.

Showing link: ${showingUrl}

---

${broker.name} · Ryan Realty
${broker.phone_brand} · ryan-realty.com
OR Lic. #${broker.license}
`

  assertClean(body, 'body.md')

  // Check no em-dashes in body text (table separators allowed: |---|)
  const bodyNoSep = body.replace(/\|---\|/g, '')
  if (bodyNoSep.includes('—') || bodyNoSep.includes('–')) {
    console.error('Em/en-dash found in body.md')
    process.exit(1)
  }

  // ---------------------------------------------------------------------------
  // HTML eflyer (responsive ≤640px, inlined CSS)
  // ---------------------------------------------------------------------------
  const ppsf = Math.round(listing.list_price / listing.sqft).toLocaleString()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New listing: ${addrShort} · Ryan Realty</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader (hidden) -->
<div style="display:none;font-size:1px;color:#f0ede8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  ${addrShort} · ${listing.list_price_display} · ${listing.bedrooms}bed ${listing.bathrooms}bath · ${listing.sqft_display} · Tumalo, Bend OR
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ede8;">
<tr><td align="center" style="padding:16px 8px;">

  <!-- Outer wrapper (max 640px) -->
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"
         style="max-width:640px;width:100%;background:#faf8f4;border:1px solid #ddd6c8;">

    <!-- Header bar -->
    <tr>
      <td style="background:#102742;padding:20px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.14em;color:#faf8f4;text-transform:uppercase;">RYAN REALTY · BEND · OREGON</p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#faf8f4;">New listing, co-op invitation</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Address + price hook -->
    <tr>
      <td style="padding:24px 28px 16px;border-bottom:1px solid #e0d9cc;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:24px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.list_price_display}</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#333;">${addr}</p>
        <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">${listing.remarks_short}</p>
      </td>
    </tr>

    <!-- Property snapshot table -->
    <tr>
      <td style="padding:20px 28px;border-bottom:1px solid #e0d9cc;">
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:0.09em;">Property details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="50%" style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;color:#555;">Bedrooms</td>
            <td width="50%" style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.bedrooms}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;color:#555;">Bathrooms</td>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.bathrooms}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;color:#555;">Square feet</td>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.sqft_display}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;color:#555;">Lot size</td>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.lot_acres} acres</td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;color:#555;">Year built</td>
            <td style="padding:6px 0;border-bottom:1px solid #f0ede8;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${listing.year_built}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px;color:#555;">Price per sqft</td>
            <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">$${ppsf} / sqft</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Drive times -->
    <tr>
      <td style="padding:16px 28px;border-bottom:1px solid #e0d9cc;background:#f5f2ed;">
        <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:0.09em;">Drive times</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="50%" style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:3px 0;">Downtown Bend</td>
            <td width="50%" style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;padding:3px 0;">${extras.drive_times.downtown_bend}</td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:3px 0;">Mt. Bachelor</td>
            <td style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;padding:3px 0;">${extras.drive_times.mt_bachelor}</td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:3px 0;">St. Charles Hospital</td>
            <td style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;padding:3px 0;">${extras.drive_times.st_charles_bend}</td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:3px 0;">Tumalo Elementary</td>
            <td style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#102742;padding:3px 0;">${extras.drive_times.tumalo_elementary}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Market context strip -->
    <tr>
      <td style="padding:16px 28px;border-bottom:1px solid #e0d9cc;">
        <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:0.09em;">Bend market, last 30 days</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="33%" style="text-align:center;border-right:1px solid #e0d9cc;padding:8px 4px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.median_sale_price_display}</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#777;text-transform:uppercase;">Median price</p>
            </td>
            <td width="33%" style="text-align:center;border-right:1px solid #e0d9cc;padding:8px 4px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.median_dom_display}</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#777;text-transform:uppercase;">Median DOM</p>
            </td>
            <td width="33%" style="text-align:center;padding:8px 4px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#102742;font-variant-numeric:tabular-nums;">${market.sale_to_list_display}</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#777;text-transform:uppercase;">Sale-to-list</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Commission + CTA -->
    <tr>
      <td style="padding:20px 28px;border-bottom:1px solid #e0d9cc;">
        <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#333;"><strong>Buyer's agent commission:</strong> 2.5% gross sale price, paid at closing.</p>
        <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#333;">Call or text ${broker.phone_brand} to schedule. Supra lockbox on site, 2-hour advance notice preferred.</p>
        <a href="${showingUrl}" style="display:inline-block;background:#102742;color:#faf8f4;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-decoration:none;padding:11px 24px;letter-spacing:0.06em;text-transform:uppercase;">Schedule a showing</a>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:16px 28px;text-align:center;background:#102742;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#faf8f4;">${broker.name} · ${broker.role} · Ryan Realty</p>
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#faf8f4;">${broker.phone_brand} · ryan-realty.com</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#8fa4bb;">OR License #${broker.license}</p>
      </td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`

  // Voice check on full text content
  const textContent = html.replace(/<[^>]+>/g, ' ')
  assertClean(textContent, 'eflyer.html text')
  assertClean(subjectTrimmed, 'subject-line')

  await write(outDir, 'eflyer.html', html)
  await write(outDir, 'body.md', body)
  await write(outDir, 'subject-line.txt', subjectTrimmed)

  // Sidecars
  const citations = {
    figures: [
      { figure: 'list_price', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.list_price_display, fetched_at: payload._meta.generated_at },
      { figure: 'sqft', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.sqft_display, fetched_at: payload._meta.generated_at },
      { figure: 'median_sale_price', source: 'Supabase market_stats_cache', query: market.trace, value: market.median_sale_price_display, fetched_at: market.period_end },
      { figure: 'median_dom', source: 'Supabase market_stats_cache', query: market.trace, value: market.median_dom_display, fetched_at: market.period_end },
      { figure: 'sale_to_list_ratio', source: 'Supabase market_stats_cache', query: market.trace, value: market.sale_to_list_display, fetched_at: market.period_end }
    ]
  }
  await write(outDir, 'citations.json', JSON.stringify(citations, null, 2))

  const provenance = {
    assets: [
      { asset: 'eflyer.html', source: 'generated from payload', license: 'proprietary' },
      { asset: 'body.md', source: 'generated from payload', license: 'proprietary' },
      { asset: 'subject-line.txt', source: 'generated from payload', license: 'proprietary' }
    ]
  }
  await write(outDir, 'provenance.json', JSON.stringify(provenance, null, 2))

  const allText = [textContent, body, subjectTrimmed].join('\n')
  const bannedHits = checkBannedWords(allText)
  const checks = [
    { name: 'banned_words', pass: bannedHits.length === 0, notes: bannedHits.length ? bannedHits.join(', ') : 'clean' },
    { name: 'subject_length', pass: subjectTrimmed.length <= 60, notes: `${subjectTrimmed.length} chars` },
    { name: 'phone_format', pass: html.includes('541.213.6706'), notes: 'dotted format present' },
    { name: 'no_exclamation_body', pass: !body.includes('!'), notes: 'no exclamation marks in text body' },
    { name: 'commission_disclosed', pass: html.includes('2.5%'), notes: 'commission split disclosed' },
    { name: 'showing_link', pass: html.includes(showingUrl), notes: 'showing link present' },
    { name: 'max_width_640', pass: html.includes('width="640"') || html.includes('max-width:640px'), notes: 'max width constraint present' },
    { name: 'market_data_present', pass: html.includes(market.median_sale_price_display), notes: 'market stats in email' }
  ]
  const passed = checks.filter(c => c.pass).length
  const scorecard = { passed, total: checks.length, score_pct: Math.round(passed / checks.length * 100), checks }
  await write(outDir, 'design_scorecard.json', JSON.stringify(scorecard, null, 2))

  const card = {
    producer: PRODUCER,
    primary_artifact: join(outDir, 'eflyer.html'),
    notes: `Agent co-op eflyer for ${addrShort}. Subject: "${subjectTrimmed}". Score ${scorecard.score_pct}%.`,
    data_traces: [`Supabase listings ListingKey=${listing.listing_key}`, market.trace],
    generated_at: now
  }
  await write(outDir, 'card.json', JSON.stringify(card, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
