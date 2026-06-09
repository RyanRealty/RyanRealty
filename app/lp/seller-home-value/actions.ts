'use server'

import { createClient } from '@supabase/supabase-js'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import {
  sendEvent,
  addPersonTags,
  createRealtimeTask,
  findPersonByEmail,
  assignPersonToUser,
  setPersonCustomFields,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { createCmaRequest } from '@/lib/cma-request'
import { backfillSessionToFub } from '@/lib/visitor-backfill'
import { geocodeAndTagLead } from '@/lib/lead-geocode'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { sendSellerLeadAlertEmail } from '@/lib/seller-lead-alert'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import { cookies, headers } from 'next/headers'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

// ─── Broker routing constants ─────────────────────────────────────────────
// FUB user ids verified 2026-05-17 via /v1/identity + /v1/users. The
// FOLLOWUPBOSS_BROKER_USER_MAP env var can override these per-environment if
// a broker is added/removed/swapped between Matt's accounts.
const FUB_USER_MATT = 1
// Rebecca (id 2) + Paul (id 3) remain in FUB but no auto-route per Matt
// 2026-05-17. Manual reassignment via FUB UI only.

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

export type SellerLPTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type SellerLPSubmission = {
  address: string
  name?: string
  email?: string
  phone?: string
  timeline?: SellerLPTimeline
  /** Optional motivation field if the form ever surfaces it. */
  motivation?: string
  /** rr_session_id (uuid v4 from localStorage) so the now-known person can be
   *  stitched to their prior anonymous visitor_events and those events replayed
   *  into FUB. Validated server-side before use. */
  sessionId?: string
  /**
   * Which LP variant submitted the form.
   * 'seller-lp'   — seller-home-value LP (default)
   * 'list-now-lp' — sell-your-home BOFU LP (high listing intent)
   */
  source?: 'seller-lp' | 'list-now-lp'
}

export type SellerLPResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' | 'unknown'; alreadyKnown: boolean; assignedBroker: BrokerSlug | null }
  | { success: false; error: string }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function parseAddress(raw: string): {
  street: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  full: string
} {
  const trimmed = raw.trim()
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  const street = parts[0] ?? null
  const city = parts[1] ?? null
  const stateZip = parts[2] ?? ''
  const m = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/)
  const state = m?.[1] ?? (stateZip.replace(/\d/g, '').trim() || null)
  const postalCode = m?.[2] ?? (parts[3]?.trim() || null)
  return { street, city, state, postalCode, full: trimmed }
}

function classifyTimeline(t: SellerLPTimeline | undefined): {
  classification: 'hot' | 'warm' | 'nurture' | 'unknown'
  tierTag: string  // canonical tag: seller:hot | seller:warm | seller:nurture
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'seller:hot' }
    case 'next-3-6':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'exploring':
      return { classification: 'nurture', tierTag: 'seller:nurture' }
    default:
      return { classification: 'unknown', tierTag: 'seller:nurture' }
  }
}

/**
 * Broker assignment for seller LP leads.
 *
 * Per Matt's 2026-05-17 directives:
 *   1. "No round robin. I will get all listings and leads." (default)
 *   2. "If Rebecca or Paul have their ads point to their landing page on
 *       the website, then by default those leads will be theirs." (override)
 *
 * Resolution order:
 *   - If a `?agent=<slug>` cookie is present (set by ad → landing page), route
 *     to that broker. Honors `agent=matt`, `agent=rebecca`, `agent=paul`.
 *   - Otherwise route to Matt by default.
 *
 * Manual reassignment in FUB UI works on a per-lead basis regardless.
 */
async function assignSellerLead(
  _classification: 'hot' | 'warm' | 'nurture' | 'unknown',
): Promise<BrokerAssignment> {
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId }
  return { broker: 'matt', userId: FUB_USER_MATT }
}

async function recordSellerAssignment(params: {
  broker: BrokerSlug
  userId: number
  fubPersonId: number | null
  tier: 'hot' | 'warm' | 'nurture' | 'unknown'
  source: string
}): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) return
  const { error } = await supabase.from('marketing_assignments').insert({
    audience: 'seller',
    broker: params.broker,
    fub_user_id: params.userId,
    fub_person_id: params.fubPersonId,
    source: params.source,
    tier: params.tier === 'unknown' ? 'nurture' : params.tier,
  })
  if (error) {
    console.warn('[seller-lp] marketing_assignments insert failed:', error.message)
  }
}

/**
 * Submit the dedicated seller landing page form.
 *
 * Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md (locked 2026-05-17):
 *  1. Resolve or create FUB person (email match > cookie > new)
 *  2. Round-robin assign to Matt or Rebecca via public.marketing_assignments
 *  3. Apply canonical kebab-case namespaced tags:
 *       audience:seller + seller:{tier} + source:seller-lp + broker:{slug}
 *  4. Write 6 custom fields (move timeline, tier, property address, etc.)
 *  5. Create marketing_brain_actions row for the canonical CMA producer
 *  6. Fire Meta CAPI Lead $500 with shared event_id
 *  7. Create 5-min realtime task for hot leads
 *
 * Downstream: a FUB Automation Rule (configured in FUB UI) listens for the
 * `audience:seller` tag and enrolls the lead in the action plan
 * `Seller Lead — Master Workflow`. FUB's own engine fires all email + SMS
 * touches on schedule. Pause-on-reply is handled by the 15-min cron at
 * /api/cron/seller-workflow-pause.
 */
export async function submitSellerLPForm(submission: SellerLPSubmission): Promise<SellerLPResult> {
  try {
    const rawAddress = submission.address?.trim() ?? ''
    if (!rawAddress) return { success: false, error: 'Property address is required' }

    const email = submission.email?.trim().toLowerCase() ?? ''
    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const timeline = submission.timeline
    const lpSource = submission.source ?? 'seller-lp'
    const isListNowLp = lpSource === 'list-now-lp'
    const { classification, tierTag } = classifyTimeline(timeline)

    // ─── Inbound attribution UTMs → FUB sourceUrl ──────────────────────────
    // FUB's /v1/people API exposes sourceUrl but NOT utmContent/utmCampaign
    // (verified 2026-06-08). So the ONLY way a published social post attributes
    // a seller lead back to its marketing_brain_actions row is to carry the utm
    // params INTO the FUB sourceUrl. The seller-lead-attribution cron parses
    // utm_content (= the action_id) out of sourceUrl and increments
    // content_performance.north_star_attributed_seller_leads. Without this the
    // north-star metric can never move off zero.
    let leadSourceUrl = `${siteUrl}/lp/seller-home-value`
    try {
      const referer = (await headers()).get('referer') ?? ''
      if (referer) {
        const refUrl = new URL(referer)
        const passthrough = new URLSearchParams()
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const v = refUrl.searchParams.get(k)
          if (v) passthrough.set(k, v)
        }
        const qs = passthrough.toString()
        if (qs) leadSourceUrl = `${siteUrl}/lp/seller-home-value?${qs}`
      }
    } catch {
      // malformed referer — fall back to the bare LP url
    }

    // ─── Resolve the FUB person ────────────────────────────────────────────
    // Priority: explicit email match > cookie-identified person id > new email-only.
    let fubPersonId: number | null = null
    let alreadyKnown = false

    if (email) {
      const existing = await findPersonByEmail(email)
      if (existing?.id) {
        fubPersonId = existing.id
        alreadyKnown = true
      }
    }
    if (!fubPersonId) {
      const cookiePersonId = await getFubPersonIdFromCookie()
      if (cookiePersonId) {
        fubPersonId = cookiePersonId
        alreadyKnown = true
      }
    }

    if (!email && !fubPersonId) {
      return {
        success: false,
        error: 'We need either an email or a prior identification to continue.',
      }
    }

    // ─── Address parsing for downstream property matching ──────────────────
    const parsed = parseAddress(rawAddress)

    // ─── Round-robin broker assignment (decided before FUB writes) ─────────
    const assignment = await assignSellerLead(classification)

    // ─── Optional: persist the valuation request row ───────────────────────
    // Mirrors submitValuationRequest so the rest of the stack (auto-CMA, weekly
    // packets, dashboard ratios) treats this lead identically.
    const supabase = getServiceSupabase()
    if (supabase && email) {
      const { error: insertError } = await supabase.from('valuation_requests').insert({
        address_street: parsed.street,
        // address_city is NOT NULL — a free-form address typed without commas
        // (no Places pick) yields a null city and silently drops this row even
        // though the FUB lead still lands. Default to Bend (the LP's market) so
        // the analytics/auto-CMA row is never lost. (Matt 2026-06-04.)
        address_city: parsed.city || 'Bend',
        address_state: parsed.state,
        address_postal_code: parsed.postalCode,
        name: name || null,
        email,
        phone: phone || null,
        source_url: leadSourceUrl,
      })
      if (insertError) {
        // Lead capture is the priority — don't fail the form on a DB hiccup.
        console.warn('[seller-lp] valuation_requests insert failed:', insertError.message)
      }
    }

    // ─── FUB Seller Inquiry event ─────────────────────────────────────────
    const firstName = name.split(/\s+/)[0] || undefined
    const lastName = name.split(/\s+/).slice(1).join(' ') || undefined

    const person: FubEventPerson = fubPersonId
      ? { id: fubPersonId }
      : {
          firstName,
          lastName,
          ...(email ? { emails: [{ value: email }] } : {}),
          ...(phone ? { phones: [{ value: phone }] } : {}),
        }

    const eventResult = await sendEvent({
      type: 'Seller Inquiry',
      person,
      source,
      sourceUrl: leadSourceUrl,
      pageTitle: 'Seller LP — Home Value',
      message: `Seller LP submission. Address: ${parsed.full}. Timeline: ${timeline ?? 'unspecified'}. Tier: ${classification}. Assigned: ${assignment.broker}.`,
      property: {
        street: parsed.street ?? undefined,
        city: parsed.city ?? undefined,
        state: parsed.state ?? undefined,
        code: parsed.postalCode ?? undefined,
      },
    })

    if (!eventResult.ok) {
      console.warn('[seller-lp] FUB sendEvent failed:', eventResult.error)
    }

    // ─── Resolve final FUB person id (in case sendEvent just created it) ──
    if (!fubPersonId && email) {
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) {
        fubPersonId = newlyCreated.id
      }
    }

    // ─── Anonymous-to-known backfill ─────────────────────────────────────────
    // A form submit is a definite identification: we now have email + a FUB
    // person id. If the client passed its rr_session_id, stamp the first-party
    // visitor_sessions row (identified_at + fub_person_id) and replay all prior
    // anonymous visitor_events for this browser into FUB as Viewed Property /
    // Viewed Page events. Idempotent + never throws (see lib/visitor-backfill).
    // Fire-and-forget — lead capture must never block on the replay.
    const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (fubPersonId && email && submission.sessionId && UUID_V4_RE.test(submission.sessionId)) {
      void backfillSessionToFub({
        sessionId: submission.sessionId,
        fubPersonId,
        email,
        identifiedVia: 'form_submit',
      }).catch((e) => console.warn('[seller-lp] session backfill failed (non-blocking):', e))
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    // If this person carries do_not_email / Bounced / Unsubscribed /
    // compliance:hard-stop, DO NOT apply audience:seller — that tag triggers
    // the FUB automation rule which would enroll them in the action plan and
    // start blasting emails. See docs/FUB_OPTIMIZATION_AUDIT_2026-05-17 §7.
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[seller-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Apply canonical tags + assign broker + write custom fields ───────
    if (fubPersonId && !hardStopped) {
      // 1. Tags — canonical kebab-case namespaced schema (see docs/FUB_SELLER_WORKFLOW_2026-05-17.md §4).
      // list-now-lp adds seller:listing-intent to distinguish high-intent BOFU leads in FUB.
      const tags: string[] = [
        'audience:seller',
        tierTag,                         // seller:hot | seller:warm | seller:nurture
        `source:${lpSource}`,            // source:seller-lp | source:list-now-lp
        `broker:${assignment.broker}`,
      ]
      if (isListNowLp) {
        tags.push('seller:listing-intent')
      }
      await addPersonTags(fubPersonId, tags)

      // 2. Broker assignment via FUB's assignedUserId.
      await assignPersonToUser(fubPersonId, assignment.userId)

      // 3. Custom fields — written via PUT /v1/people/{id} (see lib/followupboss.ts).
      await setPersonCustomFields(fubPersonId, {
        customMoveTimeline: timeline ?? 'unspecified',
        customLeadTier: classification,
        customIsSellerCurious: classification === 'nurture' ? 'true' : 'false',
        customSellerPropertyAddress: parsed.full,
      })

      // 4. Geocode the property address + spatial lookup → apply
      //    neighborhood / subdivision / city / geo tags. This makes the lead
      //    filterable in FUB smart lists by neighborhood for targeted
      //    ad campaigns. Fire-and-forget — never blocks lead capture.
      void geocodeAndTagLead({
        fubPersonId,
        address: parsed.full,
        sourceType: 'lp-form',
        state: parsed.state ?? undefined,
      }).then((geoResult) => {
        if (geoResult.ok && geoResult.tags.length > 0) {
          return addPersonTags(fubPersonId!, geoResult.tags)
        }
      }).catch((e) => console.warn('[seller-lp] geocode failed (non-blocking):', e))

      // 5. Record the assignment in our local ledger for the next round-robin.
      await recordSellerAssignment({
        broker: assignment.broker,
        userId: assignment.userId,
        fubPersonId,
        tier: classification,
        source: lpSource,
      })
    }

    // ─── 5-min realtime task for hot leads only ────────────────────────────
    if (classification === 'hot' && fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email || 'unknown'
      void createRealtimeTask({
        personId: fubPersonId,
        taskName: `Hot seller LP lead — call within 5 min: ${who} (${parsed.full})`,
        taskType: 'Call',
        dueInMinutes: 5,
      }).catch((e) => console.warn('[seller-lp] realtime task error:', e))
    }

    // ─── Canonical CMA request — queue the brain action ───────────────────
    // The LP form submission creates two rows:
    //   - public.cmas (status='draft') — the broker sees it in /admin/cmas
    //   - public.marketing_brain_actions (action_type='content:cma') — the
    //     brain dispatcher picks it up and runs the canonical CMA producer
    //     (marketing_brain_skills/producers/cma/SKILL.md), which builds the
    //     15-page HTML, renders the PDF, and ships it via /api/cma/[slug]/email.
    // Broker gets a notification email immediately; lead gets a confirmation
    // so they know we received their request and the CMA is in flight.
    if (email) {
      const created = await createCmaRequest({
        rawAddress: parsed.full,
        parsedStreet: parsed.street,
        parsedCity: parsed.city,
        parsedState: parsed.state,
        parsedPostalCode: parsed.postalCode,
        leadEmail: email,
        leadName: name || null,
        leadPhone: phone || null,
        leadTimeline: timeline ?? null,
        leadClassification: classification,
        fubPersonId,
      })
      if (!created.ok) {
        console.warn('[seller-lp] createCmaRequest failed:', created.error)
      }
    }

    // ─── Always-on Matt alert (Resend email) ──────────────────────────────
    // Matt 2026-05-18: "Once they land in Follow Up Boss as a new user,
    // I need to always make sure I'm getting an alert." Fire a dedicated
    // email to MATT_ALERT_EMAIL on every new seller LP submission, in
    // addition to the broker-assignment email from createCmaRequest.
    // Fire-and-forget — lead capture is the priority.
    try {
      const headersList = await headers()
      const referer = headersList.get('referer') ?? ''
      let utmSource: string | null = null
      let utmMedium: string | null = null
      let utmCampaign: string | null = null
      let utmContent: string | null = null
      try {
        const refUrl = new URL(referer)
        utmSource = refUrl.searchParams.get('utm_source')
        utmMedium = refUrl.searchParams.get('utm_medium')
        utmCampaign = refUrl.searchParams.get('utm_campaign')
        utmContent = refUrl.searchParams.get('utm_content')
      } catch {
        // Referer not parseable — no UTMs to capture.
      }
      void sendSellerLeadAlertEmail({
        fubPersonId,
        email: email || null,
        phone: phone || null,
        name: name || null,
        address: parsed.full,
        timeline: timeline ?? null,
        classification,
        assignedBroker: assignment.broker,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        alreadyKnown,
      }).catch((e) => console.warn('[seller-lp] Matt alert email failed:', e))
    } catch (e) {
      console.warn('[seller-lp] Matt alert prep failed:', e)
    }

    // ─── Meta CAPI Lead $500 with dedup event_id ──────────────────────────
    const eventId = generateEventId()
    const capiCookies = await cookies()
    const capiSourceUrl = isListNowLp
      ? `${siteUrl}/lp/sell-your-home`
      : `${siteUrl}/lp/seller-home-value`
    const capiContentName = isListNowLp ? 'seller_lp_list_now' : 'seller_lp_home_value'
    void fetch(`${siteUrl}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email: email || undefined,
        phone: phone || undefined,
        firstName,
        lastName,
        eventId,
        eventSourceUrl: capiSourceUrl,
        fbp: capiCookies.get('_fbp')?.value,
        // Fall back to the middleware-captured rr_fbc (derived from ?fbclid) when
        // the Meta pixel never set _fbc, so paid clicks attribute. See middleware.
        fbc: capiCookies.get('_fbc')?.value ?? capiCookies.get('rr_fbc')?.value,
        customData: {
          content_name: capiContentName,
          lead_type: isListNowLp ? 'seller_listing_intent' : 'seller_valuation',
          property_address: parsed.full,
          timeline: timeline ?? 'unspecified',
          classification,
          assigned_broker: assignment.broker,
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => {
      console.warn('[seller-lp] CAPI call failed:', err)
    })

    // ─── GA4 Measurement Protocol mirror — server-side generate_lead ──────
    // Mirrors the client-side generate_lead event so ad blockers don't drop
    // attribution. Same payload taxonomy as the client tracker. Uses the
    // GA4 client_id from the `_ga` cookie when present so attribution stays
    // tied to the same session — fresh uuid otherwise.
    try {
      const cookieStore = await cookies()
      const headersList = await headers()
      const referer = headersList.get('referer') ?? ''
      let utmSource: string | undefined
      let utmMedium: string | undefined
      let utmCampaign: string | undefined
      let utmContent: string | undefined
      try {
        const refUrl = new URL(referer)
        utmSource = refUrl.searchParams.get('utm_source') ?? undefined
        utmMedium = refUrl.searchParams.get('utm_medium') ?? undefined
        utmCampaign = refUrl.searchParams.get('utm_campaign') ?? undefined
        utmContent = refUrl.searchParams.get('utm_content') ?? undefined
      } catch {
        // Referer not parseable — no UTMs.
      }
      const ga4ClientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
      void fireGa4Event({
        eventName: 'generate_lead',
        clientId: ga4ClientId,
        eventParams: {
          lp_variant: isListNowLp ? 'sell-your-home' : 'seller-home-value',
          lp_source: utmSource,
          lp_medium: utmMedium,
          lp_campaign: utmCampaign,
          lp_content: utmContent,
          broker_slug: assignment.broker,
          lead_classification: classification,
          lead_type: 'seller',
          value: 500,
          currency: 'USD',
          event_id: eventId,
        },
        userProperties: {
          assigned_broker: assignment.broker,
        },
      })
    } catch (e) {
      console.warn('[seller-lp] GA4 MP fire prep failed:', e)
    }

    return {
      success: true,
      eventId,
      classification,
      alreadyKnown,
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[seller-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong submitting your request. Please try again or call us at 541.703.3095.' }
  }
}
