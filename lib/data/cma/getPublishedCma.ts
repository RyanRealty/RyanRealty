import 'server-only'

/**
 * Published CMAs on public listing pages (Matt approved 2026-07-30).
 *
 * Three exported paths, all funnelled through ONE guard (`isPublishable`) so a
 * document can never be publishable on one surface and not another:
 *
 *   getPublishedCmaForListing()  → the UNGATED listing-page summary.
 *   registerForCmaDocument()     → the registration that mints a delivery token.
 *   resolveCmaDocumentByToken()  → the full document, for a registrant only.
 *
 * What is ungated and why it is safe.
 *   The summary carries our opinion of VALUE (a range), the property's
 *   capability facts (zoning, acreage, water, septic, flood, permits) and an
 *   AGGREGATE description of the evidence: how many closed sales, and the
 *   window they closed in. It carries no address, price, or date for any
 *   individual comparable sale. That distinction is the whole compliance
 *   boundary. Under the ODS Rules (Aug 2024) §5-4 A.4, "MLS listing
 *   information" includes sold data, and §5-4 C requires a registered
 *   consumer before that information may be searched or retrieved on a
 *   website. Capability facts come from Deschutes County and FEMA, not the
 *   MLS, so they are outside that rule entirely.
 *
 *   The DOCUMENT itself is unaffected. ODS §7-5 D: "None of the foregoing
 *   shall be construed to prevent any individual legitimately in possession of
 *   'current', 'sold', 'comparable', or 'statistical' information from
 *   utilizing such information to support valuations on particular properties
 *   for clients and customers." A delivered CMA carries full comps, exactly as
 *   it always has. Nothing here redacts it.
 *
 * This reader NEVER selects `html_content`, `citations`, `client_name`,
 * `client_email`, `client_phone`, or any per-comp column. The ungated payload
 * type has nowhere to put them, so a future edit cannot leak one by accident.
 *
 * Import from this module path, not the `@/lib/data` barrel. The barrel is on a
 * line + export-count ratchet (ci:file-size-budget) and this feature has three
 * call sites, none of them a page, so it follows the getCmaPerformance
 * precedent instead of growing the barrel.
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/** How long a delivery link stays live after registration. */
const TOKEN_TTL_DAYS = 30

/** Statuses that mean "a human finished this document". */
const PUBLISHABLE_STATUSES = new Set(['finalized', 'delivered'])

/**
 * The terms the registrant affirmatively agrees to.
 *
 * Matt asked for the registration as a lead funnel. These clauses cost nothing
 * extra and make the same gate satisfy ODS §5-4 F, which requires a registrant
 * to "review and affirmatively to express agreement (by mouse click or
 * otherwise)" to terms covering: a consumer-broker relationship, personal
 * non-commercial use, a bona fide interest, no redistribution, and
 * acknowledgment of the MLS copyright. §5-4 G bars a terms-of-use from imposing
 * a financial obligation or creating a representation agreement, so this text
 * does neither.
 *
 * Server-only on purpose: the section passes it down as props and the action
 * validates the submitted version against it, so there is one source of truth.
 */
export const CMA_DOCUMENT_TERMS_VERSION = 'cma-doc-terms-2026-07-30'

export const CMA_DOCUMENT_TERMS: readonly string[] = [
  'You are asking a licensed Oregon broker at Ryan Realty for help with this property, and we can contact you about it.',
  'You will use what you receive for your own personal, non-commercial purposes.',
  'You have a real interest in buying, selling, or leasing property of this kind.',
  'You will not copy, redistribute, or retransmit the analysis, other than in considering the purchase or sale of an individual property.',
  'The MLS owns the listing database and holds a valid copyright in it.',
  'Oregon Data Share and other MLS participants can access this feature to verify that we are following MLS rules.',
]

export type PublishedCmaHighlight = {
  headline: string
  /** Where the fact came from. Every highlight carries one. */
  basis: string
}

export type PublishedCmaEvidence = {
  /** Count only. */
  closedSales: number
  /** The window those sales closed in, for the ODS §7-3 period notice. */
  windowStart: string | null
  windowEnd: string | null
}

export type PublishedCmaSummary = {
  id: string
  slug: string
  listingKey: string
  subjectAddress: string
  /** Our opinion is a RANGE. See the note on `recommended_list` below. */
  valueLow: number
  valueHigh: number
  preparedOn: string
  brokerSlug: string | null
  evidence: PublishedCmaEvidence
  highlights: PublishedCmaHighlight[]
  termsVersion: string
  terms: readonly string[]
}

type CmaRow = Record<string, unknown>

/** The columns the ungated summary is allowed to read. No document, no client PII, no comps. */
const SUMMARY_COLUMNS =
  'id, slug, subject_listing_key, subject_address, doc_type, status, archived_at, value_low, value_high, comps_count, broker_slug, published_to_listing, published_at, finalized_at, created_at, build_summary'

/**
 * The one publish guard. Every surface calls this.
 *
 * Note the last clause. `build_summary.pricing.needs_review` is set by the
 * CMA's own adversarial audit. On 2026-07-30 the single document attached to
 * an active Ryan Realty listing carried `needs_review: true` with an audit
 * verdict of "fail". A human ticking a publish box is not enough to put a
 * number the system itself flagged as unsound onto the public web (CLAUDE.md
 * §0). Two signals must agree: a human published it, and the audit passed.
 */
export function isPublishable(row: CmaRow | null | undefined): boolean {
  if (!row) return false
  if (row.published_to_listing !== true) return false
  if (String(row.doc_type ?? '') !== 'cma') return false
  if (!PUBLISHABLE_STATUSES.has(String(row.status ?? ''))) return false
  if (row.archived_at != null) return false
  const low = Number(row.value_low)
  const high = Number(row.value_high)
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low) return false
  const summary = (row.build_summary ?? {}) as Record<string, unknown>
  const pricing = (summary.pricing ?? {}) as Record<string, unknown>
  if (pricing.needs_review === true) return false
  return true
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length > 0 ? s : null
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Property capability facts → sellable, ungated highlights.
 *
 * Provenance is real: `build_summary.site` is produced by lib/cma/county.ts,
 * which pulls zoning and irrigation districts from Deschutes County ArcGIS,
 * flood from the FEMA National Flood Hazard Layer, and septic plus permit
 * history from Deschutes County DIAL. Each basis string below names the source
 * that actually served that field. None of it is MLS data.
 *
 * Only affirmative capability facts are surfaced. A hazard flag is not a
 * marketing highlight and is not asserted here in either direction.
 */
export function highlightsFromSiteFacts(site: Record<string, unknown> | null | undefined): PublishedCmaHighlight[] {
  if (!site || typeof site !== 'object') return []
  const out: PublishedCmaHighlight[] = []

  const acreage = num(site.acreage)
  if (acreage && acreage > 0) {
    out.push({
      headline: `${acreage} acres`,
      basis: 'Deschutes County assessor record',
    })
  }

  const zone = str(site.zone)
  if (zone) {
    out.push({ headline: `Zoned ${zone}`, basis: 'Deschutes County zoning layer' })
  }

  const water = str(site.water_source)
  if (water === 'municipal') {
    out.push({ headline: 'On municipal water', basis: 'Deschutes County record' })
  } else if (water === 'well') {
    out.push({ headline: 'Private well', basis: 'Oregon Water Resources Department well log' })
  }

  if (str(site.septic) === 'installed') {
    out.push({ headline: 'Septic system installed', basis: 'Deschutes County DIAL permit record' })
  }

  const rights = num(site.water_rights_count)
  const district = str(site.irrigation_district)
  if (rights && rights > 0 && district) {
    out.push({
      headline: `Irrigation water rights in ${district}`,
      basis: 'Oregon Water Resources Department water rights mapping',
    })
  } else if (district) {
    out.push({ headline: `Inside ${district}`, basis: 'Deschutes County irrigation district boundary' })
  }

  if (site.in_sfha === false) {
    const zoneCode = str(site.flood_zone)
    out.push({
      headline: 'Outside the FEMA special flood hazard area',
      basis: zoneCode ? `FEMA National Flood Hazard Layer, zone ${zoneCode}` : 'FEMA National Flood Hazard Layer',
    })
  }

  const permits = num(site.permit_count)
  if (permits && permits > 0) {
    out.push({
      headline: `${permits} permits on record`,
      basis: 'Deschutes County DIAL permit history',
    })
  }

  return out
}

/**
 * Aggregate evidence for the ungated summary.
 *
 * Reads `sold_date` and nothing else. No price, no address, no listing key
 * leaves this function, and the return type has no field that could carry one.
 */
async function readEvidence(cmaId: string): Promise<PublishedCmaEvidence> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('cma_comps').select('sold_date').eq('cma_id', cmaId)
  if (error) throw new Error(`cma_comps evidence read failed: ${error.message}`)
  const dates = (data ?? [])
    .map((r) => str((r as Record<string, unknown>).sold_date))
    .filter((d): d is string => d != null)
    .sort()
  return {
    closedSales: (data ?? []).length,
    windowStart: dates[0] ?? null,
    windowEnd: dates[dates.length - 1] ?? null,
  }
}

function toSummary(row: CmaRow, evidence: PublishedCmaEvidence): PublishedCmaSummary {
  const build = (row.build_summary ?? {}) as Record<string, unknown>
  return {
    id: String(row.id),
    slug: String(row.slug),
    listingKey: String(row.subject_listing_key ?? ''),
    subjectAddress: String(row.subject_address ?? ''),
    valueLow: Number(row.value_low),
    valueHigh: Number(row.value_high),
    preparedOn: String(row.published_at ?? row.finalized_at ?? row.created_at),
    brokerSlug: str(row.broker_slug),
    evidence,
    highlights: highlightsFromSiteFacts(build.site as Record<string, unknown> | undefined),
    termsVersion: CMA_DOCUMENT_TERMS_VERSION,
    terms: CMA_DOCUMENT_TERMS,
  }
}

async function fetchPublishedCmaForListing(listingKey: string): Promise<PublishedCmaSummary | null> {
  const key = String(listingKey ?? '').trim()
  if (!key) return null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cmas')
    .select(SUMMARY_COLUMNS)
    .eq('subject_listing_key', key)
    .eq('published_to_listing', true)
    .order('published_at', { ascending: false })
    .limit(1)

  // Throw, never return null, on a DB error. makeResilientCached retries once
  // uncached and then falls back, so a pooler blip can never cache "no CMA
  // here" for the revalidate window (lib/data/cache/resilient.ts).
  if (error) throw new Error(`published cma read failed: ${error.message}`)

  const row = (data ?? [])[0] as CmaRow | undefined
  // Re-assert the guard in code even though the query already filtered on the
  // flag. The query is an optimisation; THIS is the rule.
  if (!isPublishable(row)) return null

  return toSummary(row as CmaRow, await readEvidence(String((row as CmaRow).id)))
}

/**
 * The listing-page read.
 *
 * 60-second TTL rather than the usual 5 minutes because unpublishing is a
 * CLIENT CONFIDENTIALITY control, not a content update. When a broker or a
 * seller says take it down, "within a minute" is the right answer and five is
 * not.
 */
export const getPublishedCmaForListing = makeResilientCached<[string], PublishedCmaSummary | null>(
  fetchPublishedCmaForListing,
  ['published-cma-for-listing-v1'],
  { revalidate: 60, tags: ['cma:published'] },
  null,
)

// ---------------------------------------------------------------------------
// Registration + delivery
// ---------------------------------------------------------------------------

export type CmaDocumentRegistrationInput = {
  listingKey: string
  fullName: string
  email: string
  phone?: string | null
  termsVersion: string
  ipHash?: string | null
  userAgent?: string | null
  personId?: number | null
  assignedBroker?: string | null
}

export type CmaDocumentRegistrationResult =
  | { ok: true; token: string; slug: string; cmaId: string }
  | { ok: false; error: string }

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Record a registration and mint a delivery token.
 *
 * Re-resolves the published CMA through the same guard, so a registration can
 * never be created against a document that is not published. The token is
 * stored as a SHA-256 hash: a database read cannot mint a working link.
 */
export async function registerForCmaDocument(
  input: CmaDocumentRegistrationInput,
): Promise<CmaDocumentRegistrationResult> {
  const key = String(input.listingKey ?? '').trim()
  const fullName = String(input.fullName ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  if (!key || !fullName || !email) return { ok: false, error: 'Name, email, and property are all required.' }
  if (input.termsVersion !== CMA_DOCUMENT_TERMS_VERSION) {
    return { ok: false, error: 'Those terms are out of date. Reload the page and try again.' }
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cmas')
    .select(SUMMARY_COLUMNS)
    .eq('subject_listing_key', key)
    .eq('published_to_listing', true)
    .order('published_at', { ascending: false })
    .limit(1)
  if (error) return { ok: false, error: 'We could not reach the analysis just now.' }

  const row = (data ?? [])[0] as CmaRow | undefined
  if (!isPublishable(row)) return { ok: false, error: 'No published analysis for this property.' }

  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: insertError } = await sb.from('cma_document_registrations').insert({
    cma_id: String((row as CmaRow).id),
    listing_key: key,
    full_name: fullName,
    email,
    phone: str(input.phone),
    terms_version: input.termsVersion,
    ip_hash: str(input.ipHash),
    user_agent: str(input.userAgent),
    person_id: input.personId ?? null,
    assigned_broker: str(input.assignedBroker),
    token_hash: hashToken(token),
    token_expires_at: expires,
  })
  if (insertError) return { ok: false, error: 'We could not record that registration.' }

  return { ok: true, token, slug: String((row as CmaRow).slug), cmaId: String((row as CmaRow).id) }
}

export type CmaDocumentDelivery = {
  slug: string
  subjectAddress: string
  html: string
}

/**
 * Exchange a delivery token for the full document.
 *
 * Re-checks the publish guard on every delivery, so unpublishing a document
 * immediately kills every outstanding link. That is deliberate: the flag is the
 * client-confidentiality control, and a control that only applies at
 * registration time is not a control.
 */
export async function resolveCmaDocumentByToken(token: string): Promise<CmaDocumentDelivery | null> {
  const raw = String(token ?? '').trim()
  if (!raw || raw.length < 32 || raw.length > 128) return null

  const sb = createServiceClient()
  const { data: reg, error: regError } = await sb
    .from('cma_document_registrations')
    .select('id, cma_id, token_expires_at, delivery_count, first_delivered_at')
    .eq('token_hash', hashToken(raw))
    .maybeSingle()
  if (regError || !reg) return null

  const record = reg as Record<string, unknown>
  const expiresAt = Date.parse(String(record.token_expires_at ?? ''))
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null

  const { data: cma, error: cmaError } = await sb
    .from('cmas')
    .select(`${SUMMARY_COLUMNS}, html_content`)
    .eq('id', String(record.cma_id))
    .maybeSingle()
  if (cmaError || !isPublishable(cma as CmaRow | null)) return null

  const row = cma as CmaRow
  const html = typeof row.html_content === 'string' ? row.html_content : ''
  if (!html) return null

  await sb
    .from('cma_document_registrations')
    .update({
      first_delivered_at: record.first_delivered_at ?? new Date().toISOString(),
      delivery_count: Number(record.delivery_count ?? 0) + 1,
    })
    .eq('id', String(record.id))

  return {
    slug: String(row.slug),
    subjectAddress: String(row.subject_address ?? ''),
    html,
  }
}
