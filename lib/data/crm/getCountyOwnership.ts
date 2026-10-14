/**
 * getCountyOwnershipForPerson — which parcels does the county say this CRM
 * contact owns? (Matt 2026-10-14: "check county records to see whether they
 * own a home, and which one". Internal only: the CRM person page. Never a
 * public page, an email, an export, or an anonymous visitor.)
 *
 * SOURCES, in the order they are trusted
 *   1. Live county owner of record, read at request time from the public
 *      taxlot layers (lib/county-records/owner-records.ts): Deschutes and
 *      Crook. Jefferson publishes no queryable layer, so it is not searched.
 *      Each read is cached for a day (owner records change a few times a week
 *      county-wide), and the row says when it was read.
 *   2. public.westside_parcels, the assessor export for Bend's west side
 *      loaded 2026-07-04 (migration 20260705120000). It is the only source of
 *      assessed value, market value and last sale date/price, and it fills in
 *      the owner of record only when the live Deschutes read did not answer.
 *   public.taxlots holds lot polygons only (no owner), so it is not read here.
 *
 * QUERY SHAPE (one person; no per-parcel N+1)
 *   crm_people         .eq(id)                       name + addresses
 *   crm_deals          .eq(person_id)                deal property addresses
 *   crm_relationships  via getContactRelationships   linked people (a spouse)
 *   westside_parcels   .or(person_id | owner name | site number), limit 300
 *   Deschutes, Crook   one where clause each, in parallel (names, site
 *                      addresses, and the westside accounts found above)
 *
 * MATCHING lives in lib/crm/county-owner-match.ts and is conservative:
 * ownership is claimed only when the recorded owner string names the contact.
 *
 * DAL boundary (G1): the raw .from() reads live here. createServiceClient
 * bypasses RLS; the caller is the admin person page, which has already run
 * requireAdminPage('people.view') and requirePersonInScope for this id.
 */
import { createServiceClient } from '@/lib/data/client'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import {
  classifyParcel,
  contactPersonLabel,
  describeMatch,
  longestLetterRun,
  parseContactName,
  parseOwnerOfRecord,
  parseStreetLine,
  parseStructuredOwner,
  recordSpelling,
  sameOwnerOfRecord,
  type ContactAddress,
  type ContactIdentity,
  type MatchStrength,
  type OwnerKind,
  type ParsedOwner,
  type RelatedContact,
  type StreetAddress,
} from '@/lib/crm/county-owner-match'
import {
  COUNTY_LABEL,
  COUNTY_SOURCE,
  CROOK_SITUS_PLACES,
  NAME_READ_CAP,
  PARCEL_READ_CAP,
  buildOwnerWhere,
  fetchOwnerRecordsByWhere,
  type CountyKey,
  type CountyOwnerQuery,
  type CountyOwnerRecord,
} from '@/lib/county-records/owner-records'

// ── Output ────────────────────────────────────────────────────────────────────

export type CountyOwnershipFigures = {
  assessedValue: number | null
  marketValue: number | null
  /** Withheld (null) when the live owner is not the owner the export recorded. */
  lastSaleDate: string | null
  lastSalePrice: number | null
  /** When the westside_parcels export was loaded. */
  asOf: string
  /** The live owner of record differs from the export's: the parcel changed hands since. */
  ownerChangedSince: boolean
}

export type CountyOwnershipRow = {
  key: string
  county: CountyKey
  countyLabel: string
  account: string
  /** More accounts at the same site with the same owner (a land account and a home account). */
  otherAccounts: string[]
  taxlot: string | null
  /** Site address as the county records it, unit and city included when it has them. */
  situsAddress: string | null
  ownerOfRecord: string
  ownerKind: OwnerKind
  strength: MatchStrength
  strengthLabel: string
  explanation: string
  propertyClass: string | null
  recordUrl: string | null
  /** Where the owner of record on this row came from, and when it was read or loaded. */
  source: string
  sourceAsOf: string | null
  sourceIsLive: boolean
  figures: CountyOwnershipFigures | null
}

export type CountySearchStatus = {
  county: CountyKey
  label: string
  /**
   * ok: every read answered. partial: the site-address/account read or the
   * name read failed, not both. unavailable: nothing answered. not-searched:
   * nothing on the contact could go into a county search.
   */
  status: 'ok' | 'partial' | 'unavailable' | 'not-searched'
  /** The older of the reads' times (each read is cached for a day). */
  readAt: string | null
  /** The name read matched more owners than one read returns. */
  truncated: boolean
}

export type CountyOwnershipResult = {
  personId: number
  /** Names searched ("Jane Pellworth"). Empty when the contact has no first and last name. */
  searchedNames: string[]
  /** Street addresses searched, as the contact record has them. */
  searchedAddresses: string[]
  counties: CountySearchStatus[]
  /** When westside_parcels was loaded, if any of its rows were read. */
  snapshotLoadedAt: string | null
  rows: CountyOwnershipRow[]
}

export const STRENGTH_LABEL: Record<MatchStrength, string> = {
  high: 'Owner of record',
  medium: 'Name match only',
  resident: 'Not owner of record',
}

const STRENGTH_ORDER: Record<MatchStrength, number> = { high: 0, medium: 1, resident: 2 }

// ── Inputs ────────────────────────────────────────────────────────────────────

type PersonRow = {
  id: number
  first_name: string | null
  last_name: string | null
  name: string | null
  addresses: unknown
  deleted: boolean | null
}

export type WestsideOwnerRow = {
  apn: string
  site_street: string | null
  site_city: string | null
  site_zip: string | null
  mail_street: string | null
  mail_city: string | null
  mail_zip: string | null
  owner1_first: string | null
  owner1_last: string | null
  owner2_first: string | null
  owner2_last: string | null
  all_owners: string | null
  purchase_date: string | null
  purchase_price: number | null
  assessed_value: number | null
  market_value: number | null
  loaded_at: string
  person_id: number | null
}

const WESTSIDE_COLUMNS =
  'apn,site_street,site_city,site_zip,mail_street,mail_city,mail_zip,owner1_first,owner1_last,owner2_first,owner2_last,all_owners,purchase_date,purchase_price,assessed_value,market_value,loaded_at,person_id'

const WESTSIDE_LIMIT = 300

/** Address-type words on crm_people.addresses -> the noun phrase the row explains with. */
function addressLabel(type: unknown): string {
  const t = String(type ?? '').trim().toLowerCase()
  if (t.startsWith('mail')) return 'mailing address on their record'
  if (t.startsWith('prop')) return 'property address on their record'
  if (t.startsWith('home')) return 'home address on their record'
  if (t.startsWith('work')) return 'work address on their record'
  return 'address on their record'
}

/** crm_people.addresses jsonb -> parsed street addresses with their labels. */
export function contactAddressesFrom(raw: unknown, dealAddresses: string[] = []): Array<ContactAddress & { display: string }> {
  const out: Array<ContactAddress & { display: string }> = []
  const seen = new Set<string>()
  const push = (street: string, city: string, zip: string, label: string) => {
    const address = parseStreetLine(street, { city, zip })
    if (!address) return
    const k = `${address.number}|${address.direction}|${address.core.join(' ')}|${address.unit}|${address.city}|${address.zip}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ label, address, display: [street.trim(), city.trim()].filter(Boolean).join(', ') })
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const a = row as Record<string, unknown>
      push(String(a.street ?? ''), String(a.city ?? ''), String(a.zip ?? a.code ?? ''), addressLabel(a.type))
    }
  }
  for (const line of dealAddresses) {
    // Deal addresses are one line: "123 Main St, Bend, OR 97701".
    const parts = line.split(',').map((p) => p.trim())
    const zip = (line.match(/\b(\d{5})(?:-\d{4})?\s*$/) ?? [])[1] ?? ''
    push(parts[0] ?? '', parts[1] ?? '', zip, 'property on their deal')
  }
  return out
}

/** The one street word worth a LIKE: the longest that is not a street type. */
function streetWord(a: StreetAddress): string | null {
  const words = a.core.filter((t) => t.length >= 2)
  const typeWords = new Set(['ST', 'AVE', 'BLVD', 'RD', 'DR', 'LN', 'CT', 'PL', 'TER', 'CIR', 'WAY', 'HWY', 'PKWY', 'LOOP', 'TRL', 'SQ', 'PT', 'RUN', 'PATH', 'ROW'])
  const named = words.filter((t) => !typeWords.has(t))
  const pool = named.length > 0 ? named : words
  if (pool.length === 0) return null
  return pool.reduce((best, t) => (t.length > best.length ? t : best), '')
}

/** The county search for this contact: names, addresses, and accounts already in hand. */
export function buildContactQuery(
  person: PersonRow,
  identity: ContactIdentity,
  addresses: ContactAddress[],
  accounts: string[],
): CountyOwnerQuery {
  // Search the longest letter run of the name as the record spells it ("O'Pellworth" ->
  // PELLWORTH, "Mary-Jo" -> MARY): the county may keep the apostrophe, hyphen or space
  // the record dropped, and the matcher, not the search, decides.
  const names = identity.people.map((p) => ({
    first: longestLetterRun(recordSpelling(p.first, person)) || p.first,
    last: longestLetterRun(recordSpelling(p.last, person)) || p.last,
  }))
  const addrs = addresses
    .map((a) => ({ number: a.address.number, streetWord: streetWord(a.address) ?? '' }))
    .filter((a) => a.streetWord)
  return { names, addresses: addrs, accounts }
}

/** westside_parcels `.or()` filter for this contact. Values are A-Z, 0-9, space and * only. */
export function westsideOrFilter(personId: number, q: CountyOwnerQuery): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '')
  const parts = [`person_id.eq.${Math.trunc(personId)}`]
  for (const n of q.names) {
    const first = clean(n.first)
    const last = clean(n.last)
    if (first.length < 2 || last.length < 2) continue
    // A short family name ("LI") is matched whole; "*LI*" would read half the export.
    const lastPattern = last.length >= 4 ? `*${last}*` : last
    parts.push(`and(owner1_last.ilike."${lastPattern}",owner1_first.ilike."${first}*")`)
    parts.push(`and(owner2_last.ilike."${lastPattern}",owner2_first.ilike."${first}*")`)
    // A trust or company is written whole into owner1_first.
    if (first.length >= 3 && last.length >= 4) parts.push(`and(owner1_first.ilike."*${first}*",owner1_first.ilike."*${last}*")`)
  }
  for (const a of q.addresses) {
    const num = clean(a.number)
    const word = clean(a.streetWord)
    if (num && word.length >= 2) parts.push(`and(site_street.ilike."${num} *",site_street.ilike."*${word}*")`)
  }
  return parts.join(',')
}

// ── Candidates ────────────────────────────────────────────────────────────────

/** One parcel to classify: a live county record, or an export row standing in for one. */
export type OwnershipCandidate = {
  county: CountyKey
  account: string
  taxlot: string | null
  ownerRaw: string
  owner: ParsedOwner
  situs: StreetAddress | null
  situsDisplay: string | null
  mailing: StreetAddress | null
  situsPlaces?: { cities: readonly string[]; zips: readonly string[] }
  propertyClass: string | null
  recordUrl: string | null
  source: string
  sourceAsOf: string | null
  sourceIsLive: boolean
  west: WestsideOwnerRow | null
}

function situsDisplayOf(rec: CountyOwnerRecord): string | null {
  if (!rec.situsStreet) return null
  const unit = rec.situsUnit ? ` #${rec.situsUnit}` : ''
  return [`${rec.situsStreet}${unit}`, rec.situsCity].filter(Boolean).join(', ')
}

export function liveCandidate(rec: CountyOwnerRecord, readAt: string | null, west: WestsideOwnerRow | null): OwnershipCandidate {
  return {
    county: rec.county,
    account: rec.account,
    taxlot: rec.taxlot,
    ownerRaw: rec.ownerRaw,
    owner: parseOwnerOfRecord(rec.ownerRaw, rec.county === 'crook' ? 'surname-first' : 'comma'),
    situs: parseStreetLine(rec.situsStreet, { city: rec.situsCity, zip: rec.situsZip, unit: rec.situsUnit }),
    situsDisplay: situsDisplayOf(rec),
    mailing: parseStreetLine(rec.mailingStreet, { city: rec.mailingCity, zip: rec.mailingZip }),
    situsPlaces: rec.county === 'crook' ? CROOK_SITUS_PLACES : undefined,
    propertyClass: rec.propertyClass,
    recordUrl: rec.recordUrl,
    source: COUNTY_SOURCE[rec.county],
    sourceAsOf: readAt,
    sourceIsLive: true,
    west,
  }
}

export function westsideCandidate(w: WestsideOwnerRow): OwnershipCandidate {
  const owner = parseStructuredOwner(w)
  return {
    county: 'deschutes',
    account: w.apn,
    taxlot: null,
    ownerRaw: owner.raw,
    owner,
    situs: parseStreetLine(w.site_street, { city: w.site_city, zip: w.site_zip }),
    situsDisplay: [w.site_street, w.site_city].filter(Boolean).join(', ') || null,
    mailing: parseStreetLine(w.mail_street, { city: w.mail_city, zip: w.mail_zip }),
    propertyClass: null,
    recordUrl: /^\d+$/.test(w.apn) ? `https://dial.deschutes.org/Real/Index/${w.apn}` : null,
    source: 'Assessor export for west Bend (westside_parcels)',
    sourceAsOf: w.loaded_at,
    sourceIsLive: false,
    west: w,
  }
}

function figuresFor(c: OwnershipCandidate): CountyOwnershipFigures | null {
  const w = c.west
  if (!w) return null
  if (w.assessed_value == null && w.market_value == null && w.purchase_date == null && w.purchase_price == null) return null
  const sameOwner = c.sourceIsLive ? sameOwnerOfRecord(c.owner, parseStructuredOwner(w)) : true
  return {
    assessedValue: w.assessed_value != null ? Number(w.assessed_value) : null,
    marketValue: w.market_value != null ? Number(w.market_value) : null,
    lastSaleDate: sameOwner ? w.purchase_date : null,
    lastSalePrice: sameOwner && w.purchase_price != null ? Number(w.purchase_price) : null,
    asOf: w.loaded_at,
    ownerChangedSince: !sameOwner,
  }
}

/**
 * Classify every candidate parcel against the contact. Pure: the DAL hands in
 * everything it read. Exported for the unit test.
 */
export function buildOwnershipRows(
  identity: ContactIdentity,
  addresses: ContactAddress[],
  related: RelatedContact[],
  candidates: OwnershipCandidate[],
): CountyOwnershipRow[] {
  const rows: CountyOwnershipRow[] = []
  const seen = new Set<string>()
  const bySite = new Map<string, CountyOwnershipRow>()
  for (const c of candidates) {
    const key = `${c.county}:${c.account}`
    if (seen.has(key)) continue
    const cls = classifyParcel(identity, addresses, { owner: c.owner, situs: c.situs, mailing: c.mailing, situsPlaces: c.situsPlaces }, related)
    if (!cls) continue
    seen.add(key)
    // One owner, one site, two accounts (land and a manufactured home): one row.
    const siteKey = c.situsDisplay ? `${c.county}|${c.owner.raw}|${c.situsDisplay.toUpperCase()}` : null
    const same = siteKey ? bySite.get(siteKey) : undefined
    if (same) {
      same.otherAccounts.push(c.account)
      continue
    }
    const row: CountyOwnershipRow = {
      key,
      county: c.county,
      countyLabel: COUNTY_LABEL[c.county],
      account: c.account,
      otherAccounts: [],
      taxlot: c.taxlot,
      situsAddress: c.situsDisplay,
      ownerOfRecord: c.ownerRaw,
      ownerKind: c.owner.kind,
      strength: cls.strength,
      strengthLabel: STRENGTH_LABEL[cls.strength],
      explanation: describeMatch(cls, c.ownerRaw, c.owner.kind),
      propertyClass: c.propertyClass,
      recordUrl: c.recordUrl,
      source: c.source,
      sourceAsOf: c.sourceAsOf,
      sourceIsLive: c.sourceIsLive,
      figures: figuresFor(c),
    }
    rows.push(row)
    if (siteKey) bySite.set(siteKey, row)
  }
  return rows.sort(
    (a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || String(a.situsAddress).localeCompare(String(b.situsAddress)),
  )
}

// ── County reads ──────────────────────────────────────────────────────────────

type CountyRead = { records: CountyOwnerRecord[]; truncated: boolean; readAt: string }

async function readCountyDirect(county: CountyKey, where: string, cap: number): Promise<CountyRead> {
  const out = await fetchOwnerRecordsByWhere(county, where, { cap })
  return { ...out, readAt: new Date().toISOString() }
}

// A failed read throws, and a thrown read is never cached: the next view retries.
const readCountyCached = unstable_cache(readCountyDirect, ['crm-county-owner-records-v2'], {
  revalidate: 60 * 60 * 24,
  tags: ['crm-county-owner-records'],
})

type CountyResult = {
  status: CountySearchStatus
  records: CountyOwnerRecord[]
  /** The site-address/account read answered, so an account it did not return is gone. */
  parcelReadOk: boolean
}

/**
 * Two reads per county, so a common name can never crowd out the parcels that
 * matter most: one by the contact's own site addresses and known accounts
 * (a handful of rows), one by name (up to the layer's page size).
 */
async function readCounty(county: CountyKey, q: CountyOwnerQuery, cache: boolean): Promise<CountyResult> {
  const parcelWhere = buildOwnerWhere(county, { names: [], addresses: q.addresses, accounts: q.accounts })
  const nameWhere = buildOwnerWhere(county, { names: q.names, addresses: [], accounts: [] })
  const base = { county, label: COUNTY_LABEL[county], readAt: null, truncated: false }
  if (!parcelWhere && !nameWhere) return { status: { ...base, status: 'not-searched' }, records: [], parcelReadOk: false }

  const attempt = async (where: string | null, cap: number): Promise<CountyRead | 'failed' | null> => {
    if (!where) return null
    try {
      return cache ? await readCountyCached(county, where, cap) : await readCountyDirect(county, where, cap)
    } catch (err) {
      console.warn(`[getCountyOwnership] ${county} read failed:`, err instanceof Error ? err.message : err)
      return 'failed'
    }
  }
  const [parcel, byName] = await Promise.all([attempt(parcelWhere, PARCEL_READ_CAP), attempt(nameWhere, NAME_READ_CAP)])
  const reads = [parcel, byName].filter((r): r is CountyRead => r !== null && r !== 'failed')
  const failed = [parcel, byName].filter((r) => r === 'failed').length
  const records = new Map<string, CountyOwnerRecord>()
  for (const r of reads) for (const rec of r.records) if (!records.has(rec.account)) records.set(rec.account, rec)
  const times = reads.map((r) => r.readAt).sort()
  return {
    status: {
      ...base,
      status: reads.length === 0 ? 'unavailable' : failed > 0 ? 'partial' : 'ok',
      readAt: times[0] ?? null,
      truncated: reads.some((r) => r.truncated),
    },
    records: [...records.values()],
    parcelReadOk: parcel !== null && parcel !== 'failed',
  }
}

// ── The DAL function ──────────────────────────────────────────────────────────

export async function getCountyOwnershipForPerson(
  personId: number,
  opts: { cache?: boolean } = {},
): Promise<CountyOwnershipResult> {
  const empty: CountyOwnershipResult = {
    personId,
    searchedNames: [],
    searchedAddresses: [],
    counties: [],
    snapshotLoadedAt: null,
    rows: [],
  }
  if (!Number.isFinite(personId) || personId <= 0) return empty
  const sb = createServiceClient()

  const [personRes, dealsRes, relationships] = await Promise.all([
    sb.from('crm_people').select('id,first_name,last_name,name,addresses,deleted').eq('id', personId).maybeSingle(),
    sb.from('crm_deals').select('property_address').eq('person_id', personId).not('property_address', 'is', null).limit(25),
    getContactRelationships(personId),
  ])
  if (personRes.error) throw new Error(`crm_people read failed: ${personRes.error.message}`)
  const person = personRes.data as PersonRow | null
  if (!person || person.deleted) return empty

  const identity = parseContactName(person)
  const dealAddresses = (dealsRes.data ?? [])
    .map((d) => String((d as { property_address: string | null }).property_address ?? ''))
    .filter(Boolean)
  const addresses = contactAddressesFrom(person.addresses, dealAddresses)
  const related: RelatedContact[] = relationships
    .filter((r) => r.relatedPersonId !== personId)
    .slice(0, 10)
    .map((r) => ({ label: r.label, name: r.name, identity: parseContactName({ name: r.name }) }))

  const result: CountyOwnershipResult = {
    ...empty,
    searchedNames: identity.people.map(contactPersonLabel),
    searchedAddresses: addresses.map((a) => a.display),
  }
  if (identity.people.length === 0 && !identity.entityKey && addresses.length === 0) return result

  const baseQuery = buildContactQuery(person, identity, addresses, [])

  // westside_parcels: rows linked to this person, naming them, or on one of their street numbers.
  const westRes = await sb
    .from('westside_parcels')
    .select(WESTSIDE_COLUMNS)
    .or(westsideOrFilter(personId, baseQuery))
    .order('apn')
    .limit(WESTSIDE_LIMIT)
  if (westRes.error) console.warn('[getCountyOwnership] westside_parcels read failed:', westRes.error.message)
  if ((westRes.data?.length ?? 0) >= WESTSIDE_LIMIT) {
    console.warn(`[getCountyOwnership] westside_parcels read for person ${personId} hit ${WESTSIDE_LIMIT} rows; later rows were not read`)
  }
  // Keep only export rows that relate to the contact before asking the county about them.
  const westRows = ((westRes.data ?? []) as unknown as WestsideOwnerRow[]).filter((w) => {
    const c = westsideCandidate(w)
    return classifyParcel(identity, addresses, { owner: c.owner, situs: c.situs, mailing: c.mailing }, related) !== null
  })
  result.snapshotLoadedAt = westRows[0]?.loaded_at ?? null

  const cache = opts.cache !== false
  const query = buildContactQuery(person, identity, addresses, westRows.map((w) => w.apn))
  const [deschutes, crook] = await Promise.all([readCounty('deschutes', query, cache), readCounty('crook', query, cache)])
  result.counties = [deschutes.status, crook.status]

  const westByApn = new Map(westRows.map((w) => [w.apn, w]))
  const candidates: OwnershipCandidate[] = [
    ...deschutes.records.map((r) => liveCandidate(r, deschutes.status.readAt, westByApn.get(r.account) ?? null)),
    ...crook.records.map((r) => liveCandidate(r, crook.status.readAt, null)),
  ]
  // The export stands in for the owner of record only where Deschutes did not
  // answer for that account. When the account read did answer, an export
  // account it did not return no longer exists at the county.
  if (!deschutes.parcelReadOk) {
    const live = new Set(deschutes.records.map((r) => r.account))
    candidates.push(...westRows.filter((w) => !live.has(w.apn)).map(westsideCandidate))
  }

  result.rows = buildOwnershipRows(identity, addresses, related, candidates)
  return result
}
