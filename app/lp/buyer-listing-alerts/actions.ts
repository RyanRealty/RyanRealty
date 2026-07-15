'use server'

import { createClient } from '@supabase/supabase-js'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import {
  sendEvent,
  findPersonByEmail,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { backfillSessionToFub } from '@/lib/visitor-backfill'
import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { buildLeadOriginNote, type LeadOriginContext } from '@/lib/fub-lead-origin-note'
import { resolveLeadSource, resolvePaidAttributionTags } from '@/lib/crm/lead-source'
import { cookies, headers } from 'next/headers'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

const FUB_USER_MATT = 1
// Rebecca (id 2) + Paul (id 3) remain in FUB but no auto-route per Matt
// 2026-05-17. Manual reassignment via FUB UI only.

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number; reason: string }

export type BuyerLPTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type BuyerLPSubmission = {
  /** A2P/TCPA: true only when the lead actively checked the SMS consent box. */
  smsConsent?: boolean
  name?: string
  email: string
  phone?: string
  budgetMin?: number
  budgetMax?: number
  searchAreas?: string[]  // neighborhood slugs
  bedsMin?: number
  timeline?: BuyerLPTimeline
  notes?: string
  /** Anonymous visitor session id (uuid v4) from localStorage. When present,
   *  we stitch this lead's prior browsing history to the FUB person. */
  sessionId?: string
}

export type BuyerLPResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' | 'unknown'; alreadyKnown: boolean; assignedBroker: BrokerSlug | null }
  | { success: false; error: string }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function classifyTimeline(t: BuyerLPTimeline | undefined): {
  classification: 'hot' | 'warm' | 'nurture' | 'unknown'
  tierTag: string
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'buyer:hot' }
    case 'next-3-6':
      return { classification: 'warm', tierTag: 'buyer:warm' }
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'buyer:warm' }
    case 'exploring':
      return { classification: 'nurture', tierTag: 'buyer:nurture' }
    default:
      return { classification: 'unknown', tierTag: 'buyer:nurture' }
  }
}

/**
 * Broker assignment for buyer LP leads.
 *
 * Same logic as seller LP: default to Matt unless `?agent=<slug>` cookie
 * routes to a specific broker. See app/lp/seller-home-value/actions.ts
 * for the full rationale.
 */
async function assignBuyerLead(
  _classification: 'hot' | 'warm' | 'nurture' | 'unknown',
): Promise<BrokerAssignment> {
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId, reason: 'agent attribution' }
  return { broker: 'matt', userId: FUB_USER_MATT, reason: 'default routing' }
}

async function recordBuyerAssignment(params: {
  broker: BrokerSlug
  userId: number
  fubPersonId: number | null
  tier: 'hot' | 'warm' | 'nurture' | 'unknown'
  source: string
}): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) return
  const { error } = await supabase.from('marketing_assignments').insert({
    audience: 'buyer',
    broker: params.broker,
    fub_user_id: params.userId,
    fub_person_id: params.fubPersonId,
    source: params.source,
    tier: params.tier === 'unknown' ? 'nurture' : params.tier,
  })
  if (error) console.warn('[buyer-lp] marketing_assignments insert failed:', error.message)
}

/**
 * Submit the dedicated buyer landing page form.
 *
 * Per docs/FUB_BUYER_WORKFLOW_2026-05-17.md:
 *  1. Resolve or create FUB person (email match > cookie > new)
 *  2. Round-robin assign to Matt or Rebecca via marketing_assignments
 *  3. Apply canonical tags: audience:buyer + buyer:tier + source:buyer-lp + broker:slug
 *  4. Write 5 custom fields (budget min/max, search areas, beds min, timeline)
 *  5. Create 5-min realtime task for hot leads
 *  6. Fire Meta CAPI Lead $300 event
 *
 * Downstream: canonicallyTagLead applies `audience:buyer` and the native
 * CRM auto-enrolls the lead in its buyer sequence (FUB decommissioned
 * 2026-06-24; the old FUB action-plan + pause-on-reply cron are gone —
 * pause-on-reply now lives in the native sequence engine).
 */
export async function submitBuyerLPForm(submission: BuyerLPSubmission): Promise<BuyerLPResult> {
  try {
    const email = submission.email?.trim().toLowerCase() ?? ''
    if (!email) return { success: false, error: 'Email is required' }

    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const timeline = submission.timeline
    const { classification, tierTag } = classifyTimeline(timeline)

    const budgetMin = submission.budgetMin
    const budgetMax = submission.budgetMax
    const searchAreasArr = submission.searchAreas ?? []
    const bedsMin = submission.bedsMin
    const notes = submission.notes?.trim() ?? ''

    // ─── Resolve the FUB person ────────────────────────────────────────────
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
      const cookiePersonId = await getPersonIdFromCookie()
      if (cookiePersonId) {
        fubPersonId = cookiePersonId
        alreadyKnown = true
      }
    }

    // ─── Round-robin broker assignment ─────────────────────────────────────
    const assignment = await assignBuyerLead(classification)

    // ─── FUB Buyer Inquiry event ───────────────────────────────────────────
    const firstName = name.split(/\s+/)[0] || undefined
    const lastName = name.split(/\s+/).slice(1).join(' ') || undefined

    const person: FubEventPerson = fubPersonId
      ? { id: fubPersonId }
      : {
          firstName,
          lastName,
          emails: [{ value: email }],
          ...(phone ? { phones: [{ value: phone }] } : {}),
        }

    const budgetStr = budgetMin || budgetMax
      ? `$${budgetMin ?? '?'}–$${budgetMax ?? '?'}`
      : 'unspecified'
    const areasStr = searchAreasArr.length ? searchAreasArr.join(', ') : 'unspecified'

    // ─── Inbound attribution UTMs (hoisted so sendEvent can use them) ──────
    // FUB's /v1/people exposes sourceUrl but NOT utmContent/utmCampaign, so the
    // only way to attribute a buyer lead back to the ad that produced it is to
    // carry the utm params INTO the FUB sourceUrl. The buyer-lead-attribution
    // cron parses utm_content (= the action_id) back out. Mirrors the seller LP.
    let leadSourceUrl = `${siteUrl}/lp/buyer-listing-alerts`
    let originUtmSource: string | undefined
    let originUtmMedium: string | undefined
    let originUtmCampaign: string | undefined
    let originUtmContent: string | undefined
    try {
      const referer = (await headers()).get('referer') ?? ''
      if (referer) {
        const refUrl = new URL(referer)
        originUtmSource = refUrl.searchParams.get('utm_source') ?? undefined
        originUtmMedium = refUrl.searchParams.get('utm_medium') ?? undefined
        originUtmCampaign = refUrl.searchParams.get('utm_campaign') ?? undefined
        originUtmContent = refUrl.searchParams.get('utm_content') ?? undefined
        const passthrough = new URLSearchParams()
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const v = refUrl.searchParams.get(k)
          if (v) passthrough.set(k, v)
        }
        const qs = passthrough.toString()
        if (qs) leadSourceUrl = `${siteUrl}/lp/buyer-listing-alerts?${qs}`
      }
    } catch {}

    const eventResult = await sendEvent({
      type: 'Property Inquiry',
      person,
      source: resolveLeadSource(originUtmSource, source),
      sourceUrl: leadSourceUrl,
      pageTitle: 'Buyer LP - Listing Alerts',
      message: `Buyer LP submission. Budget: ${budgetStr}. Areas: ${areasStr}. Beds min: ${bedsMin ?? 'unspecified'}. Timeline: ${timeline ?? 'unspecified'}. Tier: ${classification}. Assigned: ${assignment.broker}. ${notes ? `Notes: ${notes}` : ''}`,
      campaign: originUtmSource
        ? {
            source: originUtmSource,
            ...(originUtmMedium && { medium: originUtmMedium }),
            ...(originUtmCampaign && { campaign: originUtmCampaign }),
            ...(originUtmContent && { content: originUtmContent }),
          }
        : undefined,
    })

    if (!eventResult.ok) {
      console.warn('[buyer-lp] native capture failed:', eventResult.error)
    }

    // ─── Resolve the native CRM person id (post-FUB cutover) ───────────────
    // sendEvent captures natively (crm_people) and returns the personId, this
    // MUST run on the happy path. Previously fubPersonId was only resolved
    // via a dead FUB-only findPersonByEmail call below, which always no-ops
    // post-decommission, so every new buyer lead was silently skipping all
    // enrichment (tags, custom fields, broker assignment, origin note,
    // hot-lead task). Fixed 2026-07-09.
    if (eventResult.ok && eventResult.personId) {
      fubPersonId = eventResult.personId
    }

    // ─── Native-capture fallback (belt-and-suspenders) ─────────────────────
    // If sendEvent still could not resolve a person id, record the buyer
    // lead directly so it is NEVER lost. ensureNativeLead is idempotent.
    if (!fubPersonId) {
      try {
        const native = await ensureNativeLead({
          name,
          email,
          phone,
          source: 'buyer-lp',
          assignedBroker: assignment.broker,
          tags: ['audience:buyer', tierTag, 'source:buyer-lp', `broker:${assignment.broker}`, 'fub-fallback'],
        })
        if (native.created || native.personId > 0) {
          console.warn(
            `[buyer-lp] FUB push failed; native fallback lead ${native.created ? 'created' : 'reused'} crm person ${native.personId}`,
          )
        }
      } catch (e) {
        console.warn('[buyer-lp] native fallback lead failed:', e)
      }
    }

    // ─── Stitch anonymous browsing history to this FUB person ──────────────
    // Replays prior anonymous visitor_events for this session into FUB and
    // marks the visitor_sessions row identified. Non-blocking, idempotent.
    if (fubPersonId && submission.sessionId && UUID_V4_RE.test(submission.sessionId)) {
      void backfillSessionToFub({
        sessionId: submission.sessionId,
        fubPersonId,
        email,
        identifiedVia: 'form_submit',
      }).catch((e) => console.warn('[buyer-lp] session backfill failed (non-blocking):', e))
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    // Skip workflow enrollment if person carries hard-stop tags.
    // See docs/FUB_OPTIMIZATION_AUDIT_2026-05-17 §7.
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[buyer-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Native enrichment: tags + broker + custom fields + origin note ────
    // Ported off the dead FUB-only path (addPersonTags/assignPersonToUser/
    // setPersonCustomFields/postLeadOriginNote all no-op post-decommission)
    // onto the same native enrichNativeLead() the other three LPs use.
    if (fubPersonId && !hardStopped) {
      const tags: string[] = [
        'audience:buyer',
        tierTag,
        'source:buyer-lp',
        `broker:${assignment.broker}`,
        ...resolvePaidAttributionTags({ utmSource: originUtmSource, utmCampaign: originUtmCampaign, utmContent: originUtmContent }),
      ]

      const wantParts: string[] = []
      if (budgetMin || budgetMax) wantParts.push(`Budget ${budgetStr}`)
      if (searchAreasArr.length) wantParts.push(`Areas ${areasStr}`)
      if (typeof bedsMin === 'number') wantParts.push(`Beds ${bedsMin}+`)
      if (timeline) wantParts.push(`Timeline ${timeline}`)
      const originContext: LeadOriginContext = {
        source: 'buyer-lp',
        sourceLabel: 'Buyer LP (Listing Alerts)',
        landingPage: '/lp/buyer-listing-alerts',
        audience: 'buyer',
        tier: classification,
        tierReason: timeline ? `timeline ${timeline}` : undefined,
        want: wantParts.length ? wantParts.join(', ') : undefined,
        assignedAgent: assignment.broker,
        assignmentReason: assignment.reason,
      }

      await enrichNativeLead({
        personId: fubPersonId,
        tags,
        custom: {
          leadTier: classification,
          buyerMoveTimeline: timeline ?? 'unspecified',
          ...(typeof budgetMin === 'number' ? { buyerBudgetMin: budgetMin } : {}),
          ...(typeof budgetMax === 'number' ? { buyerBudgetMax: budgetMax } : {}),
          ...(searchAreasArr.length ? { buyerSearchAreas: searchAreasArr.join(',') } : {}),
          ...(typeof bedsMin === 'number' ? { buyerBedsMin: bedsMin } : {}),
        },
        assignedBroker: assignment.broker,
        originNote: { title: 'Buyer LP lead', body: buildLeadOriginNote(originContext) },
      })

      await recordBuyerAssignment({
        broker: assignment.broker,
        userId: assignment.userId,
        fubPersonId,
        tier: classification,
        source: 'buyer-lp',
      })

      // Instant CRM mirror + auto-enroll (kills the 30-min delta-cron lag).
      void import('@/lib/crm/enroll')
        .then(({ autoEnrollByFubId }) => autoEnrollByFubId(fubPersonId, { smsConsent: submission.smsConsent }))
        .catch((e) => console.warn('[buyer-lp] instant auto-enroll failed:', e))
    }

    // ─── 5-min realtime task for hot leads ─────────────────────────────────
    if (classification === 'hot' && fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email
      void createNativeTask({
        personId: fubPersonId,
        name: `Hot buyer LP lead - call within 5 min: ${who} (${budgetStr}, ${areasStr})`,
        type: 'Call',
        dueInMinutes: 5,
        assignedBroker: assignment.broker,
      }).catch((e) => console.warn('[buyer-lp] realtime task error:', e))
    }

    // ─── Meta CAPI Lead $300 ───────────────────────────────────────────────
    const eventId = generateEventId()
    const capiCookies = await cookies()
    void fetch(`${siteUrl}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email,
        phone: phone || undefined,
        firstName,
        lastName,
        eventId,
        eventSourceUrl: `${siteUrl}/lp/buyer-listing-alerts`,
        fbp: capiCookies.get('_fbp')?.value,
        // Fall back to the middleware-captured rr_fbc (derived from ?fbclid) when
        // the Meta pixel never set _fbc, so paid clicks attribute. See middleware.
        fbc: capiCookies.get('_fbc')?.value ?? capiCookies.get('rr_fbc')?.value,
        customData: {
          content_name: 'buyer_lp_listing_alerts',
          lead_type: 'buyer_listing_alerts',
          budget_min: budgetMin,
          budget_max: budgetMax,
          search_areas: searchAreasArr,
          timeline: timeline ?? 'unspecified',
          classification,
          assigned_broker: assignment.broker,
          value: 300,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[buyer-lp] CAPI call failed:', err))

    // ─── GA4 Measurement Protocol mirror ───────────────────────────────────
    // Server-side generate_lead so attribution survives ad-blockers.
    await fireLeadGenerated({
      lp_variant: 'buyer-listing-alerts',
      lead_type: 'buyer',
      lead_classification: classification,
      broker_slug: assignment.broker,
      value: 300,
      event_id: eventId,
      fub_person_id: fubPersonId,
      extra: {
        timeline: timeline ?? 'unspecified',
        budget_min: budgetMin,
        budget_max: budgetMax,
        search_area_count: searchAreasArr.length,
        beds_min: bedsMin,
      },
    })

    return {
      success: true,
      eventId,
      classification,
      alreadyKnown,
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[buyer-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong. Please try again or call us at 541.703.3095.' }
  }
}
