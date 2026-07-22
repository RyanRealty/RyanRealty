/**
 * Prospecting hub — shared contract (spec 07).
 *
 * ONE surface (`/admin/prospecting`) over both prospect kinds (expired listings +
 * FSBOs). The types here are the boundary between the DAL (lib/data/prospecting/*),
 * the server actions (app/actions/prospecting.ts), and the UI
 * (components/admin/prospecting/*, app/admin/(protected)/prospecting/*).
 *
 * Design notes:
 * - `id` is the natural key the actions use: expired → `listing_key`, fsbo → `fsbo_url`.
 * - Compliance is fail-closed and structured: the authoritative send gate is the
 *   live `isSuppressed(personId,'sms')` tag read UNION the persisted
 *   `compliance_hard_stop` column (spec §4.3/§6.1). `sendable` is a display
 *   convenience; the server action re-checks every gate live at send time.
 * - Photo/lat/lng: FSBO rows carry them natively; expired rows join `listings`.
 */

export type ProspectKind = 'expired' | 'fsbo'

/** Structured skip-trace compliance flags, e.g. 'litigator' | 'dnc:tcpa' | 'deceased'. */
export type ComplianceFlag = string

/** The document (expired-audit for expired, CMA for FSBO) state for a prospect row. */
export type ProspectDocState =
  | { state: 'none' }
  | { state: 'building'; actionId: string | null }
  | { state: 'failed'; reason: string | null }
  | {
      state: 'ready'
      slug: string
      docType: string
      status: string
      recommendedList: number | null
    }
  | {
      state: 'sent'
      slug: string
      docType: string
      recommendedList: number | null
      sentAt: string
      sid: string | null
    }

export interface ProspectEngagement {
  /** /cma/<slug> document views (visitor_events, scoped to this doc). */
  reportViews: number
  /** SMS short-link taps (crm_timeline sms_click, scoped to this person). */
  linkTaps: number
  /** Email opens (email_events, keyed to this doc). */
  emailOpens: number
  /** Email link clicks (email_events, keyed to this doc). */
  emailClicks: number
  lastActivityAt: string | null
}

/**
 * Fail-closed compliance view for a prospect. `hardStop` is the union of the
 * live tag read and the persisted flag. `reasons` is the human-readable list of
 * why a row is not sendable (rendered as compliance chips).
 */
export interface ProspectComplianceState {
  hardStop: boolean
  flags: ComplianceFlag[]
  /** Now Active/Pending/Coming-Soon in MLS — never solicit an on-market listing. */
  relisted: boolean
  /** FSBO no longer seen in a successful scrape (status='off_market'). */
  offMarket: boolean
  /** Live isSuppressed(personId,'sms') result. */
  suppressedSms: boolean
  noPhone: boolean
  reasons: string[]
}

export interface ProspectRow {
  kind: ProspectKind
  /** listing_key (expired) | fsbo_url (fsbo) — the id every action takes. */
  id: string
  personId: number | null

  // identity
  ownerName: string | null
  streetAddress: string | null
  city: string | null
  postalCode: string | null
  fullAddress: string | null
  listPrice: number | null

  // dates
  listedAt: string | null
  expiredAt: string | null
  detectedAt: string | null

  // media / geo
  photoUrl: string | null
  latitude: number | null
  longitude: number | null

  // contact (admin surface — raw is acceptable; UI masks for display)
  contactPhone: string | null
  contactEmail: string | null

  doc: ProspectDocState
  compliance: ProspectComplianceState
  engagement: ProspectEngagement

  /** doc ready + no compliance block + phone present + not already sent. */
  sendable: boolean
}

/** One prior MLS listing cycle for the address (detail view price history). */
export interface ProspectPriceCycle {
  listDate: string | null
  status: string | null
  originalListPrice: number | null
  finalListPrice: number | null
  closePrice: number | null
  daysOnMarket: number | null
  priceDropCount: number | null
  offMarketDate: string | null
  /** Days from list to first pending — set when the cycle went under contract. */
  daysToPending: number | null
  /** listings.was_relisted — carried for downstream analysis; the cycle LIST
   *  itself is the rendered relist story, so the UI does not restate it. */
  wasRelisted: boolean
  /** Times the cycle fell out of contract and returned to market. */
  backOnMarketCount: number | null
}

/**
 * One-click drip enrollment state for the review detail (the "Enroll in drip"
 * button). `sequenceId` is the active workflow this prospect kind resolves to
 * (crm_automation_rules first, master-plan fallback — same resolution the
 * auto-enroll path uses); `enrolled` is a LIVE read of the person's
 * enrollments in that sequence. Display convenience only — the server action
 * re-runs every guard (hard-stop, active, double-enroll) at click time.
 */
export interface ProspectDripState {
  sequenceId: number | null
  sequenceName: string | null
  enrolled: boolean
}

/** Full detail for the review drawer — extends the row with property + history. */
export interface ProspectDetail extends ProspectRow {
  standardStatus: string | null
  subdivision: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  yearBuilt: number | null
  lotAcres: number | null
  garageSpaces: number | null
  viewDescription: string | null
  propertyType: string | null
  publicRemarks: string | null
  priorListAgentName: string | null
  priorListOfficeName: string | null
  originalListPrice: number | null
  daysOnMarket: number | null
  cumulativeDaysOnMarket: number | null
  contactSource: string | null
  ownerLookupStatus: string | null
  enrichmentNotes: string | null
  priceHistory: ProspectPriceCycle[]
  drip: ProspectDripState
}

export type ProspectStatusFilter =
  | 'all'
  | 'sendable'
  | 'needs-audit'
  | 'sent'
  | 'excluded'
  | 'no-phone'

export interface ProspectListFilters {
  kind: ProspectKind
  q?: string | null
  city?: string | null
  status?: ProspectStatusFilter
  minPrice?: number | null
  maxPrice?: number | null
  /** expired_at / detected_at window (ISO date, inclusive). */
  dateAfter?: string | null
  dateBefore?: string | null
  page?: number
  pageSize?: number
}

export interface ProspectSummary {
  total: number
  sendable: number
  needsAudit: number
  sent: number
  excluded: number
  noPhone: number
}

export interface ProspectListResult {
  rows: ProspectRow[]
  total: number
  summary: ProspectSummary
  page: number
  pageSize: number
  /** Distinct cities present in the unfiltered set, for the city filter Select. */
  cities: string[]
}

export type SendGuardCode =
  | 'auth'
  | 'no-doc'
  | 'relisted'
  | 'off-market'
  | 'hard-stop'
  | 'no-phone'
  | 'quiet-hours'
  | 'suppressed'
  | 'already-sent'
  | 'merge-unresolved'
  | 'send-failed'
  | 'not-found'

export type SendIntroResult =
  | { ok: true; sid: string; personId: number; sentAt: string }
  | { ok: false; error: string; code: SendGuardCode }

/** expired → 'expired-audit', fsbo → 'cma' (spec §4.1). */
export function expectedDocTypeFor(kind: ProspectKind): 'expired-audit' | 'cma' {
  return kind === 'expired' ? 'expired-audit' : 'cma'
}

/**
 * Pure "does this row have a textable phone" check for the DAL's noPhone display
 * flag. Deliberately does NOT import lib/crm/twilio's toE164 — that pulls the
 * Twilio node SDK into the @/lib/data barrel, which breaks edge routes that
 * import the barrel (e.g. /api/og). The SEND action still uses the real toE164
 * as the authoritative gate; this is display-only.
 */
export function hasSendablePhone(phone: string | null | undefined): boolean {
  return (phone ?? '').replace(/\D/g, '').length >= 10
}

/** The crm_templates key that seeds the intro for each kind (spec §4.6). */
export function introTemplateKeyFor(kind: ProspectKind): string {
  return kind === 'expired' ? 'expired-first-touch-sell-v1' : 'fsbo-first-touch-v1'
}
