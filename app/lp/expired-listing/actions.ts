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
  postLeadOriginNote,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { saveAnonymousPartialAddress } from '@/lib/data'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { backfillSessionToFub } from '@/lib/visitor-backfill'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { cookies, headers } from 'next/headers'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

const FUB_USER_MATT = 1

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

export type ExpiredLPSubmission = {
  /** A2P/TCPA: true only when the lead actively checked the SMS consent box. */
  smsConsent?: boolean
  name?: string
  email: string
  phone?: string
  /** The expired listing address (the property they previously listed). */
  address?: string
  /** What they want — audit, call, or in-person walkthrough. */
  contactPath?: 'audit' | 'phone' | 'walkthrough'
  /** Optional notes. */
  notes?: string
  /** Anonymous visitor session id (uuid v4) from localStorage. When present,
   *  we stitch this lead's prior browsing history to the FUB person. */
  sessionId?: string
}

export type ExpiredLPResult =
  | { success: true; eventId: string; alreadyKnown: boolean; assignedBroker: BrokerSlug }
  | { success: false; error: string }

async function assignExpiredLead(): Promise<BrokerAssignment> {
  // Honor ?agent= attribution; default to Matt.
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId }
  return { broker: 'matt', userId: FUB_USER_MATT }
}

/**
 * Lightweight partial-address capture for the expired LP step-1 advance.
 * Fires when the homeowner enters their prior listing address and clicks
 * Continue — before they fill out contact info. Anonymous-safe: writes
 * a visitor_event row keyed by sessionId via the DAL.
 * Never throws. The UI step change must never wait on this.
 */
export async function saveExpiredPartialAddress(params: {
  address: string
  sessionId: string | undefined
}): Promise<void> {
  const rawAddress = params.address?.trim() ?? ''
  if (!rawAddress) return
  void saveAnonymousPartialAddress({
    sessionId: params.sessionId,
    address: rawAddress,
    lpSurface: 'expired-lp',
  }).catch(() => {/* swallowed */})
}

/**
 * Submit the expired-listing landing page form.
 *
 * Expired listings are seller leads with extra context. We tag them
 * audience:seller + seller:hot (they're a recent expired = hot prospect) +
 * source:expired-lp + the expired-listing intent tag so they get the
 * full seller workflow PLUS a broker priority alert.
 *
 * Per docs/FUB_BUYER_WORKFLOW_2026-05-17.md mirror + research from
 * docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md task 2.
 */
export async function submitExpiredLPForm(submission: ExpiredLPSubmission): Promise<ExpiredLPResult> {
  try {
    const email = submission.email?.trim().toLowerCase() ?? ''
    if (!email) return { success: false, error: 'Email is required' }

    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const address = submission.address?.trim() ?? ''
    const contactPath = submission.contactPath ?? 'audit'
    const notes = submission.notes?.trim() ?? ''

    // ─── Resolve FUB person ────────────────────────────────────────────────
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

    const assignment = await assignExpiredLead()

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

    // ─── Inbound attribution UTMs (hoisted so sendEvent can use them) ──────
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
      }
    } catch {}

    const eventResult = await sendEvent({
      type: 'Seller Inquiry',
      person,
      source,
      sourceUrl: `${siteUrl}/lp/expired-listing`,
      pageTitle: 'Expired Listing LP',
      message: `Expired listing audit request. ${address ? `Property: ${address}. ` : ''}Path: ${contactPath}. Assigned: ${assignment.broker}. ${notes ? `Notes: ${notes}` : ''}`,
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
      console.warn('[expired-lp] FUB sendEvent failed:', eventResult.error)
    }

    if (!fubPersonId && email) {
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) fubPersonId = newlyCreated.id
    }

    // ─── Native-capture fallback on a FUB push failure (CONTACT360 Phase 0.2)
    // FUB down → record the expired-listing lead natively so a hot seller is NEVER
    // lost (critical for the FollowUpBoss cutover — this LP previously had no
    // fallback). Routes to the agent-attributed broker. Happy path unchanged.
    if (!eventResult.ok && !fubPersonId) {
      try {
        const native = await ensureNativeLead({
          name,
          email,
          phone,
          source: 'expired-lp',
          assignedBroker: assignment.broker,
          tags: ['audience:seller', 'seller:hot', 'source:expired-lp', 'intent:expired', `broker:${assignment.broker}`, 'fub-fallback'],
        })
        if (native.created || native.personId > 0) {
          console.warn(
            `[expired-lp] FUB push failed; native fallback lead ${native.created ? 'created' : 'reused'} crm person ${native.personId}`,
          )
        }
      } catch (e) {
        console.warn('[expired-lp] native fallback lead failed:', e)
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
      }).catch((e) => console.warn('[expired-lp] session backfill failed (non-blocking):', e))
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[expired-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Apply canonical tags + assign + custom fields ─────────────────────
    if (fubPersonId && !hardStopped) {
      // Expired listings are HOT seller leads — they had real intent recently
      // (within the last X months) and they're warm to a re-list conversation.
      const tags: string[] = [
        'audience:seller',
        'seller:hot',
        'source:expired-lp',
        'intent:expired-listing',
        `broker:${assignment.broker}`,
      ]
      await addPersonTags(fubPersonId, tags)
      await assignPersonToUser(fubPersonId, assignment.userId)

      // Internal "why this lead came in" note Matt reads in the FUB timeline.
      // No-op-safe (guards id, skips header-only, swallows errors), so it never
      // blocks lead creation. Only fields actually present here are passed.
      await postLeadOriginNote(fubPersonId, {
        source: 'expired-lp',
        sourceLabel: 'Expired listing landing page',
        landingPage: `${siteUrl}/lp/expired-listing`,
        audience: 'seller',
        tier: 'hot',
        tierReason: 'recently expired listing, warm re-list intent',
        want: address
          ? `Expired property audit. ${address}. Path: ${contactPath}.`
          : `Expired property audit. Path: ${contactPath}.`,
        assignedAgent: assignment.broker,
        assignmentReason: 'expired LP routing (attributed agent or Matt by default)',
        extra: notes ? `Notes: ${notes}` : undefined,
      })

      await setPersonCustomFields(fubPersonId, {
        customLeadTier: 'hot',
        customMoveTimeline: 'ready-now',
        customSellerPropertyAddress: address || 'unspecified',
      })

      // Instant CRM mirror + auto-enroll (kills the 30-min delta-cron lag).
      void import('@/lib/crm/enroll')
        .then(({ autoEnrollByFubId }) => autoEnrollByFubId(fubPersonId, { smsConsent: submission.smsConsent }))
        .catch((e) => console.warn('[expired-lp] instant auto-enroll failed:', e))

      // Mirror the canonical assignment ledger row used by the gold-standard
      // seller LP. Dashboards (Conversions broker split, Funnel step 6) read
      // from marketing_assignments — without this row the lead never shows
      // up in the broker-attribution view.
      const supabase = getServiceSupabase()
      if (supabase) {
        const { error: insertError } = await supabase.from('marketing_assignments').insert({
          audience: 'seller',
          broker: assignment.broker,
          fub_user_id: assignment.userId,
          fub_person_id: fubPersonId,
          source: 'expired-lp',
          tier: 'hot',
        })
        if (insertError) {
          console.warn('[expired-lp] marketing_assignments insert failed:', insertError.message)
        }
      }

      // Queue a CMA for the property — same as the seller + FSBO LP and the
      // expired-detection cron. Stamps custom.cmaLink, which the Expired
      // Recovery sequence's CMA text links to. notifyLead=false: the owner
      // never asked us for a report.
      if (address) {
        void import('@/lib/cma-request')
          .then(({ createCmaRequest }) =>
            createCmaRequest({
              rawAddress: address,
              parsedStreet: null,
              parsedCity: null,
              parsedState: 'OR',
              parsedPostalCode: null,
              leadEmail: email || null,
              leadName: name || null,
              leadPhone: phone || null,
              leadTimeline: 'ready-now',
              leadClassification: 'hot',
              fubPersonId,
              requestSource: 'expired-listing-cron',
              notifyLead: false,
            }),
          )
          .catch((e) => console.warn('[expired-lp] CMA request failed:', e))
      }
    }

    // ─── 5-min realtime task for ALL expired LP leads (hot category) ──────
    if (fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email
      void createRealtimeTask({
        personId: fubPersonId,
        taskName: `Hot expired-listing lead — call within 5 min: ${who} (${address || 'no address'})`,
        taskType: 'Call',
        dueInMinutes: 5,
      }).catch((e) => console.warn('[expired-lp] realtime task error:', e))
    }

    // ─── Meta CAPI Lead $500 (high-intent seller signal) ──────────────────
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
        eventSourceUrl: `${siteUrl}/lp/expired-listing`,
        fbp: capiCookies.get('_fbp')?.value,
        fbc: capiCookies.get('_fbc')?.value,
        customData: {
          content_name: 'expired_listing_lp',
          lead_type: 'expired_listing',
          property_address: address || 'unspecified',
          contact_path: contactPath,
          assigned_broker: assignment.broker,
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[expired-lp] CAPI call failed:', err))

    // ─── GA4 Measurement Protocol mirror ───────────────────────────────────
    // Expired listings are high-intent seller leads. Mirror generate_lead
    // server-side so attribution survives ad-blockers.
    await fireLeadGenerated({
      lp_variant: 'expired-listing',
      lead_type: 'seller',
      lead_classification: 'hot',
      broker_slug: assignment.broker,
      value: 500,
      event_id: eventId,
      fub_person_id: fubPersonId,
      extra: {
        contact_path: contactPath,
        property_address: address || undefined,
      },
    })

    return {
      success: true,
      eventId,
      alreadyKnown,
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[expired-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong. Please try again or call us at (541) 703-3095.' }
  }
}
