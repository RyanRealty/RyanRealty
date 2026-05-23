#!/usr/bin/env node
/**
 * Phase 6 — NAP (Name + Address + Phone) consistency audit across directories.
 *
 * Per Local SEO Guide + Whitespark research, NAP mismatch across directories
 * suppresses GBP local-pack rankings. This script fetches Ryan Realty's
 * publicly-accessible listings on Yelp, BBB, and Google Search, then compares
 * against the GBP canonical NAP.
 *
 * Directories that require a logged-in session (Zillow, Realtor.com brokerage
 * profiles, COAR member portal) are skipped here; Matt screenshots those and
 * we diff manually.
 *
 * Usage:
 *   node scripts/gbp-audit-nap-consistency.mjs                  # report-only
 *   node scripts/gbp-audit-nap-consistency.mjs --json           # JSON output
 *
 * Output:
 *   out/gbp-audit/nap-consistency-<DATE>.md          (human-readable)
 *   out/gbp-audit/nap-consistency-<DATE>.json        (raw)
 */

import fs from 'node:fs'
import path from 'node:path'

const DATE_TODAY = new Date().toISOString().slice(0, 10)

// Canonical NAP (the GBP truth — every directory should match this)
const CANONICAL = {
  name: 'Ryan Realty',
  legal_name: 'Ryan Realty LLC',
  address_full: '115 NW Oregon Ave Suite #2, Bend, OR 97703-1002',
  address_street: '115 NW Oregon Ave Suite #2',
  address_city: 'Bend',
  address_state: 'OR',
  address_zip: '97703',
  phone_display: '(541) 703-3095',
  phone_digits: '5417033095',
  website: 'ryan-realty.com',
  oref_business_license: '201253677',
}

// Public directories we can scrape without login
const DIRECTORIES = [
  {
    key: 'google_search',
    label: 'Google Search snippet (knowledge panel)',
    url: 'https://www.google.com/search?q=Ryan+Realty+Bend+Oregon',
    method: 'fetch+regex',
  },
  {
    key: 'yelp',
    label: 'Yelp business listing',
    url: 'https://www.yelp.com/search?find_desc=Ryan+Realty&find_loc=Bend%2C+OR',
    method: 'fetch+regex',
  },
  {
    key: 'bbb',
    label: 'Better Business Bureau',
    url: 'https://www.bbb.org/us/or/bend/profile/real-estate-broker/ryan-realty-llc',
    method: 'fetch+regex',
  },
  {
    key: 'orea_license',
    label: 'OREA license lookup (business name)',
    url: 'https://orea.elicense.micropact.com/Lookup/LicenseLookup.aspx',
    method: 'manual',
    note: `License 201253677 — confirmed 2026-05-22 via Chrome MCP. Address on file: ${CANONICAL.address_full}. Key contact: Matthew Ryan PB.201206613.`,
  },
  {
    key: 'zillow',
    label: 'Zillow brokerage profile',
    url: 'https://www.zillow.com/profile/Ryan-Realty',
    method: 'fetch+regex',
    note: 'Likely requires login for full profile.',
  },
  {
    key: 'realtor',
    label: 'Realtor.com brokerage profile',
    url: 'https://www.realtor.com/realestateagents/ryan-realty_bend_or',
    method: 'fetch+regex',
    note: 'Likely requires login for full profile.',
  },
  {
    key: 'visit_bend',
    label: 'Visit Bend Chamber',
    url: 'https://www.bendchamber.org/member-directory/?search=ryan+realty',
    method: 'fetch+regex',
  },
  {
    key: 'coar',
    label: 'Central Oregon Association of REALTORS',
    url: 'https://coar.realtor/',
    method: 'manual',
    note: 'COAR member listings are behind login; Matt screenshots from COAR member portal.',
  },
]

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const key = t.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = true
    }
  }
  return out
}

async function fetchPublic(url, label) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body, final_url: res.url || url }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || String(e) }
  }
}

function extractNapFromText(body) {
  if (!body || typeof body !== 'string') return {}

  const out = {}

  // Look for Ryan Realty mentions
  const hasName = /ryan\s+realty/i.test(body)
  out.has_name_mention = hasName

  // Phone (any of the brokerage phone patterns)
  const phones = []
  const phoneRegexes = [
    /\(?541[\)\.\-\s]*703[\)\.\-\s]*3095/g, // FUB-tracked
    /\(?541[\)\.\-\s]*213[\)\.\-\s]*6706/g, // Matt's direct
    /\(?541[\)\.\-\s]*977[\)\.\-\s]*6841/g, // Paul's
    /\(?415[\)\.\-\s]*308[\)\.\-\s]*9087/g, // Rebecca's
  ]
  for (const re of phoneRegexes) {
    const m = body.match(re)
    if (m) phones.push(...m.slice(0, 3))
  }
  out.phones = [...new Set(phones)]

  // Address
  const addressMatches = []
  const addressRegexes = [
    /115\s+NW\s+Oregon[^,\.<\n]{0,80}/gi,
    /1095\s+NW\s+Wall[^,\.<\n]{0,80}/gi, // wrong/old address that might still appear
    /1204\s+NW\s+Iowa[^,\.<\n]{0,80}/gi, // Matt's personal-on-file
  ]
  for (const re of addressRegexes) {
    const m = body.match(re)
    if (m) addressMatches.push(...m.slice(0, 3))
  }
  out.addresses = [...new Set(addressMatches.map((a) => a.trim().replace(/\s+/g, ' ')))]

  // Zip codes
  const zips = body.match(/\b97703(-\d{4})?\b/g)
  if (zips) out.zip_codes = [...new Set(zips)]

  // Website domains
  const sites = []
  if (/ryan-realty\.com/i.test(body)) sites.push('ryan-realty.com')
  if (/ryanrealty\.com/i.test(body)) sites.push('ryanrealty.com')
  if (/ryanrealtybend\.com/i.test(body)) sites.push('ryanrealtybend.com')
  out.website_mentions = [...new Set(sites)]

  return out
}

function compareToCanonical(extracted, dirKey) {
  const issues = []
  const wins = []

  if (!extracted.has_name_mention) {
    issues.push(`No "Ryan Realty" mention found in ${dirKey} response`)
  } else {
    wins.push(`name found`)
  }

  if (extracted.phones?.length) {
    const hasCanonical = extracted.phones.some((p) => p.replace(/\D/g, '').endsWith('7033095'))
    if (hasCanonical) wins.push(`canonical phone ${CANONICAL.phone_display} found`)
    const extras = extracted.phones.filter((p) => !p.replace(/\D/g, '').endsWith('7033095'))
    if (extras.length) issues.push(`extra phones found (may be broker direct lines): ${extras.join(', ')}`)
  } else {
    issues.push(`no phone number found`)
  }

  if (extracted.addresses?.length) {
    const canonical = extracted.addresses.some((a) => /115\s+NW\s+Oregon/i.test(a))
    if (canonical) wins.push(`canonical address found`)
    const wrong = extracted.addresses.filter((a) => !/115\s+NW\s+Oregon/i.test(a))
    if (wrong.length) issues.push(`non-canonical addresses found: ${wrong.join(' | ')}`)
  } else {
    issues.push(`no address found`)
  }

  if (extracted.website_mentions?.length) {
    if (extracted.website_mentions.includes('ryan-realty.com')) wins.push(`canonical website found`)
    const alts = extracted.website_mentions.filter((s) => s !== 'ryan-realty.com')
    if (alts.length) issues.push(`alternate website mentions: ${alts.join(', ')}`)
  }

  if (extracted.zip_codes?.length) {
    const canonical = extracted.zip_codes.some((z) => z === '97703' || z === '97703-1002')
    if (!canonical) issues.push(`unexpected zip codes: ${extracted.zip_codes.join(', ')}`)
  }

  return { issues, wins }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(`=== NAP consistency audit — ${DATE_TODAY} ===\n`)
  console.log('Canonical:')
  Object.entries(CANONICAL).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  console.log('')

  const results = []
  for (const dir of DIRECTORIES) {
    process.stdout.write(`${dir.label} (${dir.url.slice(0, 80)})... `)
    if (dir.method === 'manual') {
      console.log('SKIP (manual)')
      results.push({ ...dir, manual: true })
      continue
    }
    const r = await fetchPublic(dir.url, dir.label)
    if (!r.ok) {
      console.log(`✗ HTTP ${r.status}${r.error ? ` (${r.error})` : ''}`)
      results.push({ ...dir, ok: false, status: r.status, error: r.error, final_url: r.final_url })
      continue
    }
    const extracted = extractNapFromText(r.body || '')
    const { issues, wins } = compareToCanonical(extracted, dir.key)
    console.log(`✓ ${wins.length} ok, ${issues.length} issues`)
    results.push({ ...dir, ok: true, status: r.status, final_url: r.final_url, extracted, issues, wins })
  }

  // Write outputs
  const outDir = 'out/gbp-audit'
  fs.mkdirSync(outDir, { recursive: true })

  const jsonPath = `${outDir}/nap-consistency-${DATE_TODAY}.json`
  fs.writeFileSync(jsonPath, JSON.stringify({ canonical: CANONICAL, results, pulled_at: new Date().toISOString() }, null, 2))

  const lines = []
  lines.push(`# NAP Consistency Audit — ${DATE_TODAY}\n`)
  lines.push(`**Canonical:**`)
  lines.push(`- Name: ${CANONICAL.name}`)
  lines.push(`- Address: ${CANONICAL.address_full}`)
  lines.push(`- Phone: ${CANONICAL.phone_display}`)
  lines.push(`- Website: ${CANONICAL.website}`)
  lines.push(`- OREA: ${CANONICAL.oref_business_license}\n`)
  for (const r of results) {
    lines.push(`## ${r.label}`)
    lines.push(`- URL: \`${r.url}\``)
    if (r.manual) {
      lines.push(`- _Manual check — ${r.note || ''}_`)
      lines.push('')
      continue
    }
    if (!r.ok) {
      lines.push(`- ✗ HTTP ${r.status}${r.error ? ` — ${r.error}` : ''}`)
      lines.push('')
      continue
    }
    if (r.wins?.length) {
      lines.push(`- ✓ Wins:`)
      r.wins.forEach((w) => lines.push(`  - ${w}`))
    }
    if (r.issues?.length) {
      lines.push(`- ⚠ Issues:`)
      r.issues.forEach((i) => lines.push(`  - ${i}`))
    }
    if (r.extracted?.phones?.length) lines.push(`- Phones: ${r.extracted.phones.join(', ')}`)
    if (r.extracted?.addresses?.length) lines.push(`- Addresses: ${r.extracted.addresses.join(' | ')}`)
    if (r.extracted?.website_mentions?.length) lines.push(`- Websites: ${r.extracted.website_mentions.join(', ')}`)
    lines.push('')
  }
  const mdPath = `${outDir}/nap-consistency-${DATE_TODAY}.md`
  fs.writeFileSync(mdPath, lines.join('\n'))

  console.log(`\n✓ ${jsonPath}`)
  console.log(`✓ ${mdPath}`)
}

main().catch((e) => {
  console.error(`FATAL: ${e?.message || e}`)
  process.exit(1)
})
