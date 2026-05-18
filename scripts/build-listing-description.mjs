#!/usr/bin/env node
/**
 * build-listing-description.mjs — MLS listing copy suite
 *
 * Usage:
 *   node scripts/build-listing-description.mjs <payload.json> [--out <dir>]
 *
 * Outputs:
 *   public-remarks.txt   (≤1000 chars, MLS Public Remarks)
 *   private-remarks.md   (agent comm split, lockbox, showing notes)
 *   showing-instructions.md
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
const PRODUCER = 'listing-description'

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
    console.error('Usage: node scripts/build-listing-description.mjs <payload.json> [--out <dir>]')
    process.exit(1)
  }

  const payload = JSON.parse(await readFile(resolve(payloadPath), 'utf8'))
  const { listing, brokers, extras } = payload
  const slug = payload.target_slug
  const broker = brokers.matt_ryan

  const outDir = args.out
    ? resolve(args.out)
    : process.env.OUT_DIR
      ? join(process.env.OUT_DIR, PRODUCER, slug)
      : join(ROOT, 'out', PRODUCER, slug)

  await mkdir(outDir, { recursive: true })
  const now = new Date().toISOString()

  // ---------------------------------------------------------------------------
  // PUBLIC REMARKS (≤1000 chars)
  // Voice: Matt's authentic first-person. Facts, no clichés.
  // ---------------------------------------------------------------------------
  const publicRemarks = [
    `${listing.remarks_short}`,
    ``,
    `The property sits on ${listing.lot_acres} acres with ${listing.bedrooms} bedrooms and ${listing.bathrooms} bathrooms across ${listing.sqft_display} of living space, built in ${listing.year_built}.`,
    ``,
    `Drive times: downtown Bend ${extras.drive_times.downtown_bend}, Mt. Bachelor ${extras.drive_times.mt_bachelor}, St. Charles Hospital ${extras.drive_times.st_charles_bend}.`,
    ``,
    `Represented by ${broker.name}, Ryan Realty. ${broker.phone_brand} · ryan-realty.com. OR Lic. #${broker.license}.`
  ].join('\n')

  assertClean(publicRemarks, 'public-remarks')

  if (publicRemarks.length > 1000) {
    console.error(`Public remarks too long: ${publicRemarks.length} chars (max 1000)`)
    process.exit(1)
  }

  // ---------------------------------------------------------------------------
  // PRIVATE REMARKS
  // ---------------------------------------------------------------------------
  const privateRemarks = `# Private remarks: ${listing.street_number} ${listing.street_name}

**Status:** ${listing.status}
**List price:** ${listing.list_price_display}
**List agent:** ${broker.name} · ${broker.phone_brand} · ${broker.email}

## Commission split

Buyer's agent commission: **2.5%** of gross sale price. Paid at closing per the Purchase and Sale Agreement.

Contact ${broker.name} directly at ${broker.phone_brand} to discuss cooperation on any offer before submission.

## Lockbox

Supra lockbox on front door.
Code: **[LOCKBOX CODE - SET AT ACTIVATION]**
Key: Standard front door key. Do not leave a copy on site.

## Showing notes

- Schedule via ShowingTime or call ${broker.phone_brand} (text preferred).
- Sellers require 2-hour advance notice.
- Remove shoes or wear provided booties at entry.
- Do not open the gate to the back pasture without listing agent present.
- Photography and video are permitted inside the property. Do not post raw MLS photos or interior video to public social without written consent.

## Offers

Submit to ${broker.email}. Include proof of funds or pre-approval with all offers.
EMD: $25,000 minimum, wire preferred.
`

  assertClean(privateRemarks, 'private-remarks')

  // ---------------------------------------------------------------------------
  // SHOWING INSTRUCTIONS (buyer-facing)
  // ---------------------------------------------------------------------------
  const showingInstructions = `# Showing instructions: ${listing.street_number} ${listing.street_name}, ${listing.city} ${listing.state}

## Arrival

Park in the gravel pull-out on the east side of the driveway. Do not block the garage.

The property sits on ${listing.lot_acres} acres. Walk the parcel boundary if you want to get a feel for the lot. Flagging tape marks the corners.

## Key features to highlight

1. **Mountain views.** Three Sisters views from the primary bedroom, living area, and back deck. Ask your client to stand at the west-facing windows.
2. **Lot and outdoor space.** ${listing.lot_acres} acres with room to expand, build a shop, or keep horses (verify zoning with Deschutes County).
3. **Community context.** Tumalo is an unincorporated community west of Bend. No HOA, no city utility fees, rural pace. Schools feed to Tumalo Elementary (${extras.drive_times.tumalo_elementary} away).
4. **Drive time reality check.** Downtown Bend ${extras.drive_times.downtown_bend}, Mt. Bachelor ${extras.drive_times.mt_bachelor}. Buyers often underestimate how close Tumalo is.
5. **Year built.** ${listing.year_built}. Mechanical systems, roof, and HVAC should be verified during inspection period.

## After the showing

Return the key to the lockbox and confirm the door is locked.
Text ${broker.name} at ${broker.phone_brand} with any questions from the showing or to discuss offer strategy.

Questions? ${broker.phone_brand} · ryan-realty.com
`

  assertClean(showingInstructions, 'showing-instructions')

  await write(outDir, 'public-remarks.txt', publicRemarks)
  await write(outDir, 'private-remarks.md', privateRemarks)
  await write(outDir, 'showing-instructions.md', showingInstructions)

  // Sidecars
  const citations = {
    figures: [
      { figure: 'list_price', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.list_price_display, fetched_at: payload._meta.generated_at },
      { figure: 'sqft', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.sqft_display, fetched_at: payload._meta.generated_at },
      { figure: 'lot_acres', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.lot_acres, fetched_at: payload._meta.generated_at },
      { figure: 'year_built', source: 'Supabase listings', query: `ListingKey=${listing.listing_key}`, value: listing.year_built, fetched_at: payload._meta.generated_at }
    ]
  }
  await write(outDir, 'citations.json', JSON.stringify(citations, null, 2))

  const provenance = {
    assets: [
      { asset: 'public-remarks.txt', source: 'generated from payload', license: 'proprietary' },
      { asset: 'private-remarks.md', source: 'generated from payload', license: 'proprietary' },
      { asset: 'showing-instructions.md', source: 'generated from payload', license: 'proprietary' }
    ]
  }
  await write(outDir, 'provenance.json', JSON.stringify(provenance, null, 2))

  const charCount = publicRemarks.length
  const allText = [publicRemarks, privateRemarks, showingInstructions].join('\n')
  const bannedHits = checkBannedWords(allText)

  const checks = [
    { name: 'banned_words', pass: bannedHits.length === 0, notes: bannedHits.length ? bannedHits.join(', ') : 'clean' },
    { name: 'public_remarks_length', pass: charCount <= 1000, notes: `${charCount} chars (max 1000)` },
    { name: 'no_em_dash', pass: !allText.includes('—') && !allText.includes('–'), notes: 'em/en-dash absent' },
    { name: 'no_exclamation_body', pass: !allText.includes('!'), notes: 'no exclamation marks' },
    { name: 'phone_format', pass: allText.includes('541.213.6706'), notes: 'dotted format present' },
    { name: 'license_number', pass: allText.includes(broker.license), notes: 'license present in public remarks' },
    { name: 'broker_name_present', pass: allText.includes(broker.name), notes: 'broker name present' }
  ]
  const passed = checks.filter(c => c.pass).length
  const scorecard = { passed, total: checks.length, score_pct: Math.round(passed / checks.length * 100), checks }
  await write(outDir, 'design_scorecard.json', JSON.stringify(scorecard, null, 2))

  const card = {
    producer: PRODUCER,
    primary_artifact: join(outDir, 'public-remarks.txt'),
    notes: `MLS listing copy suite for ${listing.street_number} ${listing.street_name}. Public remarks: ${charCount} chars. Score ${scorecard.score_pct}%.`,
    data_traces: [`Supabase listings ListingKey=${listing.listing_key}`],
    generated_at: now
  }
  await write(outDir, 'card.json', JSON.stringify(card, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
