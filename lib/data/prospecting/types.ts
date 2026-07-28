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
      /** First-touch timestamp across channels (earliest of sms/email). */
      sentAt: string
      /** Twilio sid — null when the intro went out by email only. */
      sid: string | null
      /** Per-channel stamps (channel-aware sent-state). null = channel unsent. */
      smsSentAt: string | null
      emailSentAt: string | null
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

export type ProspectChannel = 'sms' | 'email' | 'call'

export const PROSPECT_CHANNELS: readonly ProspectChannel[] = ['sms', 'email', 'call']

/** One channel's block decision plus the reason to show the broker. */
export interface ProspectChannelBlock {
  blocked: boolean
  /** Broker-facing reason, e.g. 'On the do-not-call registry'. Null when open. */
  reason: string | null
}

export type ProspectChannelBlocks = Record<ProspectChannel, ProspectChannelBlock>

/**
 * Fail-closed compliance view for a prospect.
 *
 * `channels` is the authoritative per-channel picture and the ONLY thing the UI
 * should read. A contact on the do-not-call registry is blocked for SMS + call
 * (TCPA treats a text as a call) while email stays open — collapsing that into
 * one "hard stop" boolean is what painted every row a red do-not-contact wall
 * and hid a legitimately emailable lead (Brain Dump 2, 2026-07-28).
 *
 * `hardStop` keeps its ORIGINAL meaning byte-for-byte so no existing send gate
 * loosens: the COMPLIANCE-only SMS block (live tag read ∪ persisted flag ∪
 * dangerous skip-trace flag). It deliberately excludes reachability — a row with
 * no phone was never "hard stopped" and still is not. `channels.sms.blocked` is
 * the broader display truth (compliance OR no phone on file), which is why the
 * two are not interchangeable. New code reads `channels`.
 */
export interface ProspectComplianceState {
  /** Compliance-only SMS/call block. Excludes reachability — see the note above. */
  hardStop: boolean
  flags: ComplianceFlag[]
  /** Now Active/Pending/Coming-Soon in MLS — never solicit an on-market listing. */
  relisted: boolean
  /** FSBO no longer seen in a successful scrape (status='off_market'). */
  offMarket: boolean
  /** Live isSuppressed(personId,'sms') result. */
  suppressedSms: boolean
  noPhone: boolean
  noEmail: boolean
  reasons: string[]
  /** Per-channel block map — read this, not `hardStop`. */
  channels: ProspectChannelBlocks
  /** Every channel blocked. The ONLY state that means "do not contact". */
  allChannelsBlocked: boolean
}

/** Channels still open for outreach, in preference order (email, sms, call). */
export function openChannels(compliance: {
  channels: ProspectChannelBlocks
}): ProspectChannel[] {
  return (['email', 'sms', 'call'] as ProspectChannel[]).filter((c) => !compliance.channels[c].blocked)
}

/** Build a uniformly-blocked channel map — the fail-closed default. */
export function blockAllChannels(reason: string): ProspectChannelBlocks {
  return {
    sms: { blocked: true, reason },
    email: { blocked: true, reason },
    call: { blocked: true, reason },
  }
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
  /**
   * Whole years the owner has held the property, when a source proves it.
   * Source priority (get.ts deriveOwnershipSince): crm_people.custom
   * customOwnershipSince (county deed record) → the "Owned since YYYY-MM-DD"
   * marker the owner-lookup chain writes into enrichment_notes → the most
   * recent closed MLS cycle in priceHistory. 0 = owned under a year.
   * Null = no source proves a date (never estimated, per §0).
   */
  ownershipYears: number | null
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
  | 'no-email'
  | 'quiet-hours'
  | 'suppressed'
  | 'already-sent'
  | 'merge-unresolved'
  | 'send-failed'
  | 'not-found'

export type SendIntroResult =
  | { ok: true; sid: string; personId: number; sentAt: string }
  | { ok: false; error: string; code: SendGuardCode }

/** Result of the guarded EMAIL cold intro (sendProspectingEmailIntro). */
export type SendEmailIntroResult =
  | {
      ok: true
      /** Gmail message id (or Resend id on the fallback rail); null on replay. */
      messageId: string | null
      personId: number | null
      sentAt: string
      transport: 'gmail' | 'resend' | null
    }
  | { ok: false; error: string; code: SendGuardCode }

/**
 * Merge the per-channel outreach stamps into the doc's sent-state fields.
 * Returns null when neither channel has sent (the row is not "sent").
 * `sentAt` is the FIRST touch (earliest of the two ISO timestamps — ISO-8601
 * strings compare correctly lexicographically).
 */
export function mergeChannelSentState(
  smsSentAt: string | null,
  emailSentAt: string | null,
): { sentAt: string; smsSentAt: string | null; emailSentAt: string | null } | null {
  if (!smsSentAt && !emailSentAt) return null
  const sentAt =
    smsSentAt && emailSentAt ? (smsSentAt <= emailSentAt ? smsSentAt : emailSentAt) : (smsSentAt ?? emailSentAt)!
  return { sentAt, smsSentAt: smsSentAt ?? null, emailSentAt: emailSentAt ?? null }
}

/**
 * PostgREST/Postgres "column does not exist" (SQLSTATE 42703) classifier — the
 * feature-detect for the 20260722010100 email-outreach columns. The prospecting
 * reads select those columns optimistically and fall back to the legacy column
 * list when the migration has not been applied yet, so the dashboard renders
 * pre-migration instead of erroring.
 */
export function isUndefinedColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  return /column .* does not exist/i.test(error.message ?? '')
}

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

/**
 * Pure "does this row have an emailable address" check, the email twin of
 * hasSendablePhone. Display/guard convenience only — the SEND action still
 * runs the fail-closed suppression checks (isSuppressed + isSuppressedByEmail)
 * as the authoritative gate.
 */
export function hasSendableEmail(email: string | null | undefined): boolean {
  const v = (email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

/** The crm_templates key that seeds the intro for each kind (spec §4.6). */
export function introTemplateKeyFor(kind: ProspectKind): string {
  return kind === 'expired' ? 'expired-first-touch-sell-v1' : 'fsbo-first-touch-v1'
}
