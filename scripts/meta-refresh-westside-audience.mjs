#!/usr/bin/env node
/**
 * scripts/meta-refresh-westside-audience.mjs
 *
 * Refreshes the "RR Westside Bend Homeowners" Meta Custom Audience
 * (id 120244510092910698) directly from Supabase — westside_parcels
 * (17,665 rows, every West Bend parcel) joined to crm_people where linked
 * (person_id), so the audience reflects the CURRENT list rather than the
 * one-time manual CSV push from 2026-05-25.
 *
 * FIXED 2026-07-09: the first two pushes only sent name+city+state+zip
 * (FN/LN/CT/ST/ZIP) for every record, even for the 57% of linked people who
 * have a real email and/or phone on file in crm_people. Per Meta's own spec
 * (see lib/meta/audienceHash.ts, the canonical hasher used by the daily
 * "Ryan Realty CRM Leads" sync) name+location alone is a weak match key —
 * that library deliberately DROPS name-only records because they "would
 * only inflate the upload" without improving match rate. This rewrite
 * pulls real email/phone from crm_people for every linked parcel and sends
 * a combined 7-key schema (EMAIL, PHONE, FN, LN, CT, ST, ZIP) — Meta matches
 * on whatever subset of keys is present per row, so adding the strong keys
 * can only help, never hurt, the ~2,900-3,400 already-matched via name+zip.
 *
 * Compliance: excludes any linked crm_people row with a channel='all'
 * crm_suppressions row (TCPA hard-stop, litigator, DNC) or a realtor/
 * industry tag — same exclusion logic as app/api/cron/meta-audience-sync.
 * Unlinked parcels (no person_id yet) have no tags/suppressions to check
 * and are included as-is (they're raw public-record data, not CRM contacts).
 *
 * Privacy: all PII is hashed server-side before any network call. Meta
 * never receives plaintext names, emails, or phones.
 *
 * Usage:
 *   node scripts/meta-refresh-westside-audience.mjs --dry-run   # counts only
 *   node scripts/meta-refresh-westside-audience.mjs             # push live
 */

import { createHash } from 'node:crypto'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const META_TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_TOKEN || '').trim()
const AUDIENCE_ID = '120244510092910698' // "RR Westside Bend Homeowners"

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!DRY_RUN && !META_TOKEN) {
  console.error('Missing META_PAGE_ACCESS_TOKEN (or pass --dry-run)')
  process.exit(1)
}

// ── Normalization, byte-identical to lib/meta/audienceHash.ts (the canonical
// hasher). Duplicated here because scripts/*.mjs run as plain Node ESM and
// can't import repo .ts modules directly. ──────────────────────────────────
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

function normalizeEmail(raw) {
  if (raw == null) return null
  const v = String(raw).trim().toLowerCase()
  if (!v || !/^[^@\s]+@[^@\s]+$/.test(v)) return null
  return v
}

function normalizePhone(raw, defaultCountryCode = '1') {
  if (raw == null) return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) digits = defaultCountryCode + digits
  if (digits.length < 11) return null
  return digits
}

function normalizeName(raw) {
  if (raw == null) return null
  const v = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[.,'’`\-_/\\]/g, '')
    .replace(/\s+/g, '')
  return v || null
}

const normCity = (v) => (v || '').trim().toLowerCase().replace(/[^a-z]/g, '')
const normState = (v) => {
  const s = (v || '').trim().toLowerCase()
  return s.length === 2 ? s : s.replace(/[^a-z]/g, '').slice(0, 2)
}
const normZip = (v) => (v || '').replace(/\D/g, '').slice(0, 5)

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed (${res.status}): ${path}`)
  return res.json()
}

const REALTOR_TAG_KEYWORDS = ['realtor', 'real estate', 'real-estate-agent', 'industry:realtor', 'agent', 'broker']

async function main() {
  console.log(`[westside-audience-refresh] ${DRY_RUN ? 'DRY RUN' : 'LIVE'} — loading westside_parcels...`)

  let allParcels = []
  let offset = 0
  const pageSize = 1000
  for (;;) {
    const page = await sbFetch(
      `westside_parcels?select=apn,owner1_first,owner1_last,mail_city,mail_state,mail_zip,site_zip,person_id&limit=${pageSize}&offset=${offset}`,
    )
    allParcels = allParcels.concat(page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  console.log(`  loaded ${allParcels.length} parcels`)

  const linkedPersonIds = [...new Set(allParcels.filter((p) => p.person_id).map((p) => p.person_id))]
  console.log(`  ${linkedPersonIds.length} parcels linked to a crm_people row`)

  // Pull suppressions + tags + emails/phones/names for every linked person,
  // in chunks (URL length safety).
  const suppressedIds = new Set()
  const realtorIds = new Set()
  const peopleById = new Map()
  const chunkSize = 200
  for (let i = 0; i < linkedPersonIds.length; i += chunkSize) {
    const chunk = linkedPersonIds.slice(i, i + chunkSize)
    const idsParam = chunk.join(',')
    const [suppressions, people] = await Promise.all([
      sbFetch(`crm_suppressions?select=person_id&channel=eq.all&person_id=in.(${idsParam})`),
      sbFetch(`crm_people?select=id,tags,emails,phones,first_name,last_name&id=in.(${idsParam})`),
    ])
    suppressions.forEach((r) => suppressedIds.add(r.person_id))
    people.forEach((p) => {
      const tags = (p.tags || []).map((t) => String(t).toLowerCase())
      if (tags.some((t) => REALTOR_TAG_KEYWORDS.some((kw) => t.includes(kw)))) realtorIds.add(p.id)
      peopleById.set(p.id, p)
    })
  }
  console.log(`  excluding ${suppressedIds.size} hard-stopped + ${realtorIds.size} realtor-tagged linked people`)

  const eligible = allParcels.filter((p) => {
    if (p.person_id && suppressedIds.has(p.person_id)) return false
    if (p.person_id && realtorIds.has(p.person_id)) return false
    if (!p.owner1_first || !p.owner1_last) return false
    return true
  })
  console.log(`  ${eligible.length} eligible records after exclusions + missing-name filter`)

  let withEmail = 0
  let withPhone = 0
  const records = eligible.map((p) => {
    const person = p.person_id ? peopleById.get(p.person_id) : null

    // Prefer the CRM's real contact + name data when linked; fall back to
    // the parcel's own owner name (public-record data) when not.
    const emailRaw = person?.emails?.[0]?.value ?? person?.emails?.[0] ?? null
    const phoneRaw = person?.phones?.[0]?.value ?? person?.phones?.[0] ?? null
    const email = normalizeEmail(emailRaw)
    const phone = normalizePhone(phoneRaw)
    const fn = normalizeName(person?.first_name || p.owner1_first)
    const ln = normalizeName(person?.last_name || p.owner1_last)
    if (email) withEmail += 1
    if (phone) withPhone += 1

    return [
      email ? sha256(email) : '',
      phone ? sha256(phone) : '',
      fn ? sha256(fn) : '',
      ln ? sha256(ln) : '',
      sha256(normCity(p.mail_city || 'Bend')),
      sha256(normState(p.mail_state || 'OR')),
      sha256(normZip(p.mail_zip || p.site_zip)),
    ]
  })
  console.log(`  ${withEmail} records carry a real email, ${withPhone} carry a real phone (in addition to name+location for all)`)

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would push ${records.length} hashed records to audience ${AUDIENCE_ID}.`)
    console.log('No network call made to Meta.')
    return
  }

  const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'CT', 'ST', 'ZIP']
  const batchSize = 5000
  let pushed = 0
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const url = `https://graph.facebook.com/v21.0/${AUDIENCE_ID}/users?access_token=${encodeURIComponent(META_TOKEN)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { schema, data: batch } }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn(`  ! batch ${i}-${i + batch.length}: HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
    } else {
      pushed += batch.length
      console.log(`  ✓ pushed batch ${i}-${i + batch.length} (num_received=${body.num_received ?? '?'})`)
    }
  }
  console.log(`\n[westside-audience-refresh] done — ${pushed}/${records.length} records pushed to audience ${AUDIENCE_ID}.`)
}

main().catch((e) => {
  console.error('[westside-audience-refresh] FAILED:', e)
  process.exit(1)
})
