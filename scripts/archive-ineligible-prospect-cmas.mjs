/**
 * List non-archived expired/FSBO CMAs and linked CRM people that fail the
 * 2026-10-05 intake checks. Dry-run by default. Nothing is emailed.
 *
 * Fails when any of these is true:
 *   - no sendable owner email (CMA column, prospect contact_email, or person)
 *   - email hard stop: compliance_hard_stop, flag litigator/deceased/hard-stop,
 *     or person tag compliance:hard-stop / compliance:deceased / tcpa:litigator
 *   - back on market: Active, Pending, Coming Soon, or Closed after expiry,
 *     same address or the same parcel
 *
 * TCPA-only and a DNC phone do not fail a row that has a sendable email.
 *
 *   node --env-file=.env.local scripts/archive-ineligible-prospect-cmas.mjs
 *   node --env-file=.env.local scripts/archive-ineligible-prospect-cmas.mjs --apply
 *
 * --apply archives an undelivered CMA (status archived + archived_at) and
 * dequeues a drip row (outreach_email_status queued). It stamps
 * compliance_hard_stop only when the reason is an email hard stop and the
 * column is still false. It does not delete rows, does not set
 * crm_people.deleted, and does not archive a CMA that already has delivered_at.
 *
 * Columns cited from docs/DATABASE_SCHEMA_SNAPSHOT.md: cmas (slug, status,
 * archived_at, delivered_at, client_email, person_id, request_source, doc_type,
 * subject_address, subject_city, subject_listing_key), expired_listings and
 * fsbo_listings (compliance_hard_stop, compliance_flags, contact_email,
 * outreach_email_status, outreach_email_queued_at, cma_id), listings
 * (StreetNumber, StreetName, City, StandardStatus, CloseDate,
 * status_change_timestamp, parcel_number), crm_people (emails, tags).
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const EXPIRED_SOURCES = new Set([
  'expired-listing-cron',
  'expired-dashboard',
  'expired-outreach-queue',
  'expired-backfill',
])
const FSBO_SOURCES = new Set(['fsbo-cron', 'fsbo-dashboard', 'fsbo-lp', 'fsbo-outreach', 'fsbo-backfill'])
const EMAIL_HARD_FLAGS = new Set(['litigator', 'deceased', 'hard-stop'])
const EMAIL_HARD_TAGS = new Set(['compliance:hard-stop', 'compliance:deceased', 'tcpa:litigator'])
const ON_MARKET = new Set(['Active', 'Pending', 'Coming Soon'])

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

function sendable(email) {
  const v = String(email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

function maskEmail(email) {
  const s = String(email ?? '').trim().toLowerCase()
  const at = s.indexOf('@')
  if (at < 1) return ''
  return `${s[0]}***${s.slice(at)}`
}

function emailsOf(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((p) => (typeof p === 'string' ? p : p?.value)).filter(Boolean)
}

function flagsOf(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((f) => String(f))
}

function tagsOf(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => String(t).toLowerCase())
}

function parcelOf(raw) {
  const v = String(raw ?? '').trim()
  if (!v || /^(n\/?a\.?|none|tbd|null|unknown|0+|-+|\.+)$/i.test(v)) return null
  return v
}

function parcelFromNotes(notes) {
  const m = String(notes ?? '').match(/\btaxlot\s+([A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)/i)
  return m ? parcelOf(m[1]) : null
}

function isClosed(status) {
  return /closed/i.test(String(status ?? ''))
}

function hits(kind, listing, namePrefix, cityUpper, expiry, subjectParcel) {
  const streetName = String(listing.StreetName ?? '').toUpperCase()
  const city = String(listing.City ?? '').toUpperCase()
  const addressMatch = streetName.startsWith(namePrefix) && city === cityUpper
  const listingParcel = parcelOf(listing.parcel_number)
  const parcelMatch = Boolean(subjectParcel && listingParcel && subjectParcel === listingParcel)
  if (!addressMatch && !parcelMatch) return false
  const status = String(listing.StandardStatus ?? '')
  if (ON_MARKET.has(status)) {
    if (kind === 'fsbo') return true
    return expiry == null || String(listing.status_change_timestamp ?? '') > expiry
  }
  if (!isClosed(status) || expiry == null) return false
  const soldAt = String(listing.CloseDate ?? listing.status_change_timestamp ?? '')
  return soldAt !== '' && soldAt > expiry
}

async function pageAll(table, columns, orderCol, filter) {
  const rows = []
  const page = 1000
  for (let from = 0; from < 20000; from += page) {
    let q = sb.from(table).select(columns).order(orderCol, { ascending: true }).range(from, from + page - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < page) break
  }
  return rows
}

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function main() {
  const expired = await pageAll(
    'expired_listings',
    'listing_key, street_address, city, status_change_timestamp, expired_at, contact_email, compliance_hard_stop, compliance_flags, fub_person_id, outreach_crm_person_id, cma_id, enrichment_notes, outreach_email_status, outreach_email_queued_at',
    'listing_key',
  )
  const fsbo = await pageAll(
    'fsbo_listings',
    'fsbo_url, street_address, city, detected_at, contact_email, compliance_hard_stop, compliance_flags, fub_person_id, outreach_crm_person_id, cma_id, enrichment_notes, outreach_email_status, outreach_email_queued_at',
    'fsbo_url',
  )
  const cmaIds = new Set(
    [...expired, ...fsbo].map((r) => r.cma_id).filter(Boolean),
  )
  const cmas = await pageAll(
    'cmas',
    'id, slug, subject_address, subject_city, subject_listing_key, client_email, person_id, status, request_source, doc_type, delivered_at, archived_at',
    'id',
    (q) => q.is('archived_at', null),
  )
  const lane = cmas.filter((c) => {
    const src = String(c.request_source ?? '').toLowerCase()
    return (
      EXPIRED_SOURCES.has(src) ||
      FSBO_SOURCES.has(src) ||
      String(c.doc_type ?? '').toLowerCase() === 'expired-audit' ||
      cmaIds.has(c.id)
    )
  })

  const personIds = new Set()
  for (const row of [...expired, ...fsbo]) {
    for (const id of [row.outreach_crm_person_id, row.fub_person_id]) {
      const n = Number(id)
      if (Number.isFinite(n) && n > 0) personIds.add(n)
    }
  }
  for (const c of lane) {
    const n = Number(c.person_id)
    if (Number.isFinite(n) && n > 0) personIds.add(n)
  }
  const people = new Map()
  for (const ids of chunk([...personIds], 200)) {
    const { data, error } = await sb.from('crm_people').select('id, emails, tags, deleted, source').in('id', ids)
    if (error) throw new Error(`crm_people: ${error.message}`)
    for (const p of data ?? []) people.set(Number(p.id), p)
  }

  const expiredByKey = new Map(expired.map((r) => [r.listing_key, r]))
  const expiredByCma = new Map(expired.filter((r) => r.cma_id).map((r) => [r.cma_id, r]))
  const fsboByCma = new Map(fsbo.filter((r) => r.cma_id).map((r) => [r.cma_id, r]))

  const listingKeys = [...new Set(expired.map((r) => r.listing_key).filter(Boolean))]
  const parcelByKey = new Map()
  for (const ids of chunk(listingKeys, 200)) {
    const { data, error } = await sb.from('listings').select('ListingKey, parcel_number').in('ListingKey', ids)
    if (error) throw new Error(`listings parcel: ${error.message}`)
    for (const row of data ?? []) {
      const parcel = parcelOf(row.parcel_number)
      if (parcel) parcelByKey.set(row.ListingKey, parcel)
    }
  }

  const streets = new Set()
  const parcels = new Set()
  function noteAddress(street, parcel) {
    const num = String(street ?? '').trim().split(' ')[0]
    if (num) streets.add(num)
    if (parcel) parcels.add(parcel)
  }
  for (const row of expired) noteAddress(row.street_address, parcelByKey.get(row.listing_key) ?? parcelFromNotes(row.enrichment_notes))
  for (const row of fsbo) noteAddress(row.street_address, parcelFromNotes(row.enrichment_notes))
  for (const c of lane) noteAddress(c.subject_address, null)

  const byNumber = new Map()
  const byParcel = new Map()
  const statusOr = 'StandardStatus.in.(Active,Pending,"Coming Soon"),StandardStatus.ilike.*Closed*'
  const select = 'StreetNumber, StreetName, City, status_change_timestamp, StandardStatus, CloseDate, parcel_number'
  for (const nums of chunk([...streets], 100)) {
    const { data, error } = await sb.from('listings').select(select).in('StreetNumber', nums).or(statusOr)
    if (error) throw new Error(`listings street: ${error.message}`)
    for (const row of data ?? []) {
      const k = String(row.StreetNumber ?? '')
      const arr = byNumber.get(k) ?? []
      arr.push(row)
      byNumber.set(k, arr)
    }
  }
  for (const lots of chunk([...parcels], 100)) {
    const { data, error } = await sb.from('listings').select(select).in('parcel_number', lots).or(statusOr)
    if (error) throw new Error(`listings parcel probe: ${error.message}`)
    for (const row of data ?? []) {
      const parcel = parcelOf(row.parcel_number)
      if (!parcel) continue
      const arr = byParcel.get(parcel) ?? []
      arr.push(row)
      byParcel.set(parcel, arr)
    }
  }

  function onMarket(kind, street, city, expiry, parcel) {
    const raw = String(street ?? '').trim()
    if (!raw) return false
    const num = raw.split(' ')[0]
    const namePrefix = raw.slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const cityUpper = String(city ?? '').toUpperCase()
    const rows = [...(byNumber.get(num) ?? []), ...(parcel ? byParcel.get(parcel) ?? [] : [])]
    return rows.some((l) => hits(kind, l, namePrefix, cityUpper, expiry, parcel))
  }

  function personFor(ids) {
    for (const id of ids) {
      const n = Number(id)
      if (people.has(n)) return people.get(n)
    }
    return null
  }

  function reasonsFor(kind, prospect, cma) {
    const reasons = []
    const flags = flagsOf(prospect?.compliance_flags)
    const person = personFor([
      cma?.person_id,
      prospect?.outreach_crm_person_id,
      prospect?.fub_person_id,
    ])
    const tags = tagsOf(person?.tags)
    if (prospect?.compliance_hard_stop === true) reasons.push('hard-stop:column')
    const flagHit = flags.find((f) => EMAIL_HARD_FLAGS.has(f.toLowerCase()))
    if (flagHit) reasons.push(`hard-stop:flag:${flagHit.toLowerCase()}`)
    const tagHit = tags.find((t) => EMAIL_HARD_TAGS.has(t))
    if (tagHit) reasons.push(`hard-stop:tag:${tagHit}`)
    const emails = [
      cma?.client_email,
      prospect?.contact_email,
      ...emailsOf(person?.emails),
    ]
    if (!emails.some((e) => sendable(e))) reasons.push('no-email')
    const street = prospect?.street_address || cma?.subject_address
    const city = prospect?.city || cma?.subject_city
    const expiry =
      kind === 'fsbo'
        ? (prospect?.detected_at ?? null)
        : (prospect?.status_change_timestamp ?? prospect?.expired_at ?? null)
    const parcel =
      kind === 'fsbo'
        ? parcelFromNotes(prospect?.enrichment_notes)
        : (parcelByKey.get(prospect?.listing_key) ?? parcelFromNotes(prospect?.enrichment_notes))
    if (onMarket(kind, street, city, expiry, parcel)) reasons.push('back-on-market')
    return { reasons, person, emails: emails.filter((e) => sendable(e)).map(maskEmail) }
  }

  const lines = []
  const actions = []
  const seenCma = new Set()
  function pushCma(kind, prospect, cma) {
    if (!cma || cma.archived_at || seenCma.has(cma.id)) return
    const { reasons, person, emails } = reasonsFor(kind, prospect, cma)
    if (reasons.length === 0) return
    seenCma.add(cma.id)
    const delivered = Boolean(cma.delivered_at)
    const queued = prospect?.outreach_email_status === 'queued'
    const action = delivered ? (queued ? 'dequeue-only' : 'report-only') : 'archive-and-dequeue'
    lines.push(
      [
        'CMA',
        cma.slug,
        cma.subject_address,
        reasons.join(','),
        person ? `person ${person.id}` : 'no-person',
        emails[0] || 'no-email',
        delivered ? 'delivered' : cma.status,
        queued ? 'queued' : 'not-queued',
        action,
      ].join(' | '),
    )
    actions.push({ kind, prospect, cma, reasons, action, delivered })
  }

  const cmaById = new Map(lane.map((c) => [c.id, c]))
  for (const row of expired) {
    const cma = (row.cma_id && cmaById.get(row.cma_id)) || lane.find((c) => c.subject_listing_key === row.listing_key)
    pushCma('expired', row, cma)
  }
  for (const row of fsbo) {
    pushCma('fsbo', row, row.cma_id ? cmaById.get(row.cma_id) : null)
  }
  for (const c of lane) {
    if (seenCma.has(c.id)) continue
    const src = String(c.request_source ?? '').toLowerCase()
    const kind = FSBO_SOURCES.has(src) ? 'fsbo' : 'expired'
    const prospect = expiredByCma.get(c.id) || expiredByKey.get(c.subject_listing_key) || fsboByCma.get(c.id) || null
    pushCma(kind, prospect, c)
  }

  const seenPerson = new Set()
  for (const item of actions) {
    const person = personFor([
      item.cma?.person_id,
      item.prospect?.outreach_crm_person_id,
      item.prospect?.fub_person_id,
    ])
    if (!person || seenPerson.has(person.id)) continue
    seenPerson.add(person.id)
    lines.push(
      [
        'PERSON',
        person.id,
        person.deleted ? 'deleted-flag' : 'active',
        item.reasons.join(','),
        item.cma?.slug ?? item.prospect?.listing_key ?? item.prospect?.fsbo_url ?? '',
        'leave-person',
      ].join(' | '),
    )
  }

  console.log(APPLY ? 'APPLY' : 'DRY RUN')
  console.log(`${lines.length} row(s). Archiving is proposed. Nothing is deleted.`)
  for (const line of lines) console.log(line)
  if (!APPLY) {
    console.log('No writes. Re-run with --apply to archive undelivered CMAs and dequeue.')
    return
  }

  const now = new Date().toISOString()
  for (const item of actions) {
    if (!item.delivered && item.cma) {
      const { error } = await sb
        .from('cmas')
        .update({ status: 'archived', archived_at: now })
        .eq('id', item.cma.id)
        .is('archived_at', null)
      if (error) console.error('archive failed', item.cma.slug, error.message)
      else console.log('archived', item.cma.slug)
    }
    if (item.prospect && item.prospect.outreach_email_status === 'queued') {
      const table = item.kind === 'fsbo' ? 'fsbo_listings' : 'expired_listings'
      const col = item.kind === 'fsbo' ? 'fsbo_url' : 'listing_key'
      const id = item.prospect[col]
      const { error } = await sb
        .from(table)
        .update({ outreach_email_status: null, outreach_email_queued_at: null })
        .eq(col, id)
        .eq('outreach_email_status', 'queued')
      if (error) console.error('dequeue failed', id, error.message)
      else console.log('dequeued', id)
    }
    if (item.reasons.includes('hard-stop') && item.prospect && item.prospect.compliance_hard_stop !== true) {
      const table = item.kind === 'fsbo' ? 'fsbo_listings' : 'expired_listings'
      const col = item.kind === 'fsbo' ? 'fsbo_url' : 'listing_key'
      const id = item.prospect[col]
      const { error } = await sb.from(table).update({ compliance_hard_stop: true }).eq(col, id)
      if (error) console.error('hard-stop stamp failed', id, error.message)
      else console.log('stamped hard stop', id)
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
