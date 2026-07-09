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
 * Match keys per Meta spec (FN, LN, CT, ST, ZIP) — same schema/normalization
 * as scripts/meta-upload-mls-audiences.mjs, for match-rate consistency.
 *
 * Compliance: excludes any linked crm_people row with a channel='all'
 * crm_suppressions row (TCPA hard-stop, litigator, DNC) or a realtor/
 * industry tag — same exclusion logic as app/api/cron/meta-audience-sync.
 * Unlinked parcels (no person_id yet) have no tags/suppressions to check
 * and are included as-is (they're raw public-record data, not CRM contacts).
 *
 * Privacy: all PII is hashed server-side before any network call. Meta
 * never receives plaintext names.
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

const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const normName = (v) => (v || '').trim().toLowerCase().replace(/[^a-z]/g, '')
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

  // Pull suppressions + tags for every linked person, in chunks (URL length safety).
  const suppressedIds = new Set()
  const realtorIds = new Set()
  const chunkSize = 200
  for (let i = 0; i < linkedPersonIds.length; i += chunkSize) {
    const chunk = linkedPersonIds.slice(i, i + chunkSize)
    const idsParam = chunk.join(',')
    const [suppressions, people] = await Promise.all([
      sbFetch(`crm_suppressions?select=person_id&channel=eq.all&person_id=in.(${idsParam})`),
      sbFetch(`crm_people?select=id,tags&id=in.(${idsParam})`),
    ])
    suppressions.forEach((r) => suppressedIds.add(r.person_id))
    people.forEach((p) => {
      const tags = (p.tags || []).map((t) => String(t).toLowerCase())
      if (tags.some((t) => REALTOR_TAG_KEYWORDS.some((kw) => t.includes(kw)))) realtorIds.add(p.id)
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

  const records = eligible.map((p) => [
    sha256(normName(p.owner1_first)),
    sha256(normName(p.owner1_last)),
    sha256(normCity(p.mail_city || 'Bend')),
    sha256(normState(p.mail_state || 'OR')),
    sha256(normZip(p.mail_zip || p.site_zip)),
  ])

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would push ${records.length} hashed records to audience ${AUDIENCE_ID}.`)
    console.log('No network call made to Meta.')
    return
  }

  const schema = ['FN', 'LN', 'CT', 'ST', 'ZIP']
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
