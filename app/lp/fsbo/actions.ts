'use server'

import { createClient } from '@supabase/supabase-js'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import {
  sendEvent,
  findPersonByEmail,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { saveAnonymousPartialAddress } from '@/lib/data'
import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { buildLeadOriginNote, type LeadOriginContext } from '@/lib/fub-lead-origin-note'
import { createCmaRequest } from '@/lib/cma-request'
import { backfillSessionToFub } from '@/lib/visitor-backfill'
import { geocodeAndTagLead } from '@/lib/lead-geocode'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { sendSellerLeadAlertEmail } from '@/lib/seller-lead-alert'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { cookies, headers } from 'next/headers'

/**
 * FSBO landing page server actions for /lp/fsbo.
 *
 * Modeled on app/lp/seller-home-value/actions.ts (the gold-standard seller
 * path). FSBO owners are HOT seller leads with a distinct intent tag:
 *
 *   audience:seller + seller:hot + source:fsbo-lp + intent:fsbo + broker:<slug>
 *
 * intent:fsbo routes the lead into the CRM's FSBO Recovery sequence via
 * lib/crm/enroll.ts (FUB plan 72). autoEnrollByFubId fires instantly here
 * so the 30-min delta-cron lag never applies. The pricing report the LP
 * promises is a canonical CMA request (public.cmas draft + brain action),
 * same as the seller LP.
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

const FUB_USER_MATT = 1

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

export type FsboLPSubmission = {
  /** A2P/TCPA: true only when the lead actively checked the SMS consent box. */
  smsConsent?: boolean
  /** The property the owner is selling themselves. */
  address: string
  name?: string
  email?: string
  phone?: string
  /** Optional notes ("listed 3 weeks, two showings, no offers"). */
  notes?: string
  /** rr_session_id (uuid v4 from localStorage) for anonymous-history stitch. */
  sessionId?: string
}

export type FsboLPResult =
  | { success: true; eventId: string; alreadyKnown: boolean; assignedBroker: BrokerSlug }
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

async function assignFsboLead(): Promise<BrokerAssignment> {
  // Honor ?agent= attribution cookie; default to Matt (2026-05-17 directive).
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId }
  return { broker: 'matt', userId: FUB_USER_MATT }
}

/**
 * Lightweight partial-address capture for the FSBO LP step-1 advance.
 * Anonymous-safe (visitor_events row keyed by sessionId via the DAL).
 * Never throws. The UI step change must never wait on this.
 */
export async function saveFsboPartialAddress(params: {
  address: string
  sessionId: string | undefined
}): Promise<void> {
  const rawAddress = params.address?.trim() ?? ''
  if (!rawAddress) return
  void saveAnonymousPartialAddress({
    sessionId: params.sessionId,
    address: rawAddress,
    lpSurface: 'fsbo-lp',
  }).catch(() => {/* swallowed */})
}

/**
 * Submit the FSBO landing page form.
 */
export async function submitFsboLPForm(submission: FsboLPSubmission): Promise<FsboLPResult> {
  try {
    const rawAddress = submission.address?.trim() ?? ''
    if (!rawAddress) return { success: false, error: 'Property address is required' }

    const email = submission.email?.trim().toLowerCase() ?? ''
    if (!email) return { success: false, error: 'Email is required' }

    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const notes = submission.notes?.trim() ?? ''
    const parsed = parseAddress(rawAddress)

    // ─── Resolve the FUB person (email match > cookie > new) ───────────────
    let fubPersonId: number | null = null
    let alreadyKnown = false

    const existing = await findPersonByEmail(email)
    if (existing?.id) {
      fubPersonId = existing.id
      alreadyKnown = true
    }
    if (!fubPersonId) {
      const cookiePersonId = await getFubPersonIdFromCookie()
      if (cookiePersonId) {
        fubPersonId = cookiePersonId
        alreadyKnown = true
      }
    }

    const assignment = await assignFsboLead()

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
    } catch {
      // malformed referer — no UTMs to capture
    }

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

    // ─── FUB Seller Inquiry event ─────────────────────────────────────────
    const eventResult = await sendEvent({
      type: 'Seller Inquiry',
      person,
      source,
      sourceUrl: `${siteUrl}/lp/fsbo`,
      pageTitle: 'FSBO LP. Pricing report',
      message: `FSBO pricing-report request. Property: ${parsed.full}. Assigned: ${assignment.broker}.${notes ? ` Notes: ${notes}` : ''}`,
      property: {
        street: parsed.street ?? undefined,
        city: parsed.city ?? undefined,
        state: parsed.state ?? undefined,
        code: parsed.postalCode ?? undefined,
      },
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
      console.warn('[fsbo-lp] native capture failed:', eventResult.error)
    }

    // ─── Resolve the native CRM person id (post-FUB cutover) ───────────────
    // sendEvent captures natively and returns the personId — the working id for
    // all downstream enrichment.
    if (eventResult.ok && eventResult.personId) {
      fubPersonId = eventResult.personId
    }

    // ─── Native-capture fallback ───────────────────────────────────────────
    // If sendEvent could not resolve a person id, capture the FSBO lead (a hot
    // seller) directly so it is NEVER dropped. ensureNativeLead is idempotent.
    if (!fubPersonId) {
      try {
        const native = await ensureNativeLead({
          name,
          email,
          phone,
          source: 'fsbo-lp',
          assignedBroker: assignment.broker,
          tags: ['audience:seller', 'seller:hot', 'source:fsbo-lp', 'intent:fsbo', `broker:${assignment.broker}`],
        })
        if (native.personId > 0) {
          fubPersonId = native.personId
        }
      } catch (e) {
        console.warn('[fsbo-lp] native fallback lead failed:', e)
      }
    }

    // ─── Anonymous-to-known backfill (non-blocking, idempotent) ────────────
    if (fubPersonId && submission.sessionId && UUID_V4_RE.test(submission.sessionId)) {
      void backfillSessionToFub({
        sessionId: submission.sessionId,
        fubPersonId,
        email,
        identifiedVia: 'form_submit',
      }).catch((e) => console.warn('[fsbo-lp] session backfill failed (non-blocking):', e))
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[fsbo-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Native enrichment: tags + broker + custom fields + origin note ────
    if (fubPersonId && !hardStopped) {
      // Canonical kebab-case namespaced tag schema. intent:fsbo routes the
      // CRM auto-enroll into the FSBO Recovery sequence (lib/crm/enroll.ts).
      const originContext: LeadOriginContext = {
        source: 'source:fsbo-lp',
        sourceLabel: 'FSBO landing page',
        landingPage: `${siteUrl}/lp/fsbo`,
        audience: 'seller',
        tier: 'hot',
        tierReason: 'active FSBO, selling now',
        want: `Free FSBO pricing report for ${parsed.full}`,
        assignedAgent: assignment.broker,
        assignmentReason: 'FSBO LP routing (attributed agent or Matt by default)',
        extra: notes ? `Notes: ${notes}` : undefined,
      }
      await enrichNativeLead({
        personId: fubPersonId,
        tags: ['audience:seller', 'seller:hot', 'source:fsbo-lp', 'intent:fsbo', `broker:${assignment.broker}`],
        custom: { leadTier: 'hot', sellerPropertyAddress: parsed.full },
        assignedBroker: assignment.broker,
        originNote: { title: 'FSBO LP lead', body: buildLeadOriginNote(originContext) },
      })

      // Geocode + neighborhood/city tags, unioned natively (fire-and-forget).
      const geoPersonId = fubPersonId
      void geocodeAndTagLead({
        fubPersonId: geoPersonId,
        address: parsed.full,
        sourceType: 'lp-form',
        state: parsed.state ?? undefined,
      }).then((geoResult) => {
        if (geoResult.ok && geoResult.tags.length > 0) {
          return enrichNativeLead({ personId: geoPersonId, tags: geoResult.tags })
        }
      }).catch((e) => console.warn('[fsbo-lp] geocode failed (non-blocking):', e))

      // Assignment ledger row (dashboards read marketing_assignments).
      const supabase = getServiceSupabase()
      if (supabase) {
        const { error: insertError } = await supabase.from('marketing_assignments').insert({
          audience: 'seller',
          broker: assignment.broker,
          fub_user_id: assignment.userId,
          fub_person_id: fubPersonId,
          source: 'fsbo-lp',
          tier: 'hot',
        })
        if (insertError) {
          console.warn('[fsbo-lp] marketing_assignments insert failed:', insertError.message)
        }
      }

      // Instant CRM mirror + auto-enroll. intent:fsbo already routes to the
      // FSBO Recovery sequence. Awaited so the CMA link can stamp onto the
      // CRM person for sequence merge fields (mirrors the seller LP order).
      const { autoEnrollByFubId } = await import('@/lib/crm/enroll')
      await autoEnrollByFubId(fubPersonId, { smsConsent: submission.smsConsent }).catch((e: unknown) =>
        console.warn('[fsbo-lp] instant auto-enroll failed:', e),
      )
    }

    // ─── 5-min hot-lead call task (native crm_tasks). Every FSBO lead is hot ─
    if (fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email
      void createNativeTask({
        personId: fubPersonId,
        name: `Hot FSBO lead, call within 5 min: ${who} (${parsed.full})`,
        type: 'Call',
        dueInMinutes: 5,
        assignedBroker: assignment.broker,
      }).catch((e) => console.warn('[fsbo-lp] hot-lead task error:', e))
    }

    // ─── Canonical CMA request. The promised free pricing report ───────────
    const created = await createCmaRequest({
      rawAddress: parsed.full,
      parsedStreet: parsed.street,
      parsedCity: parsed.city,
      parsedState: parsed.state,
      parsedPostalCode: parsed.postalCode,
      leadEmail: email,
      leadName: name || null,
      leadPhone: phone || null,
      leadTimeline: null,
      leadClassification: 'hot',
      fubPersonId,
      requestSource: 'fsbo-lp',
    })
    if (!created.ok) {
      console.warn('[fsbo-lp] createCmaRequest failed:', created.error)
    }

    // ─── Always-on Matt alert (Resend email). Fire-and-forget ─────────────
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
        // Referer not parseable. No UTMs to capture.
      }
      void sendSellerLeadAlertEmail({
        fubPersonId,
        email: email || null,
        phone: phone || null,
        name: name || null,
        address: parsed.full,
        timeline: 'FSBO, selling now',
        classification: 'hot',
        assignedBroker: assignment.broker,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        alreadyKnown,
      }).catch((e) => console.warn('[fsbo-lp] Matt alert email failed:', e))
    } catch (e) {
      console.warn('[fsbo-lp] Matt alert prep failed:', e)
    }

    // ─── Meta CAPI Lead $500 with dedup event_id ──────────────────────────
    const eventId = generateEventId()
    const capiCookies = await cookies()
    const capiReqHeaders = await headers()
    const capiClientIp = capiReqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const capiClientUa = capiReqHeaders.get('user-agent') || undefined
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
        eventSourceUrl: `${siteUrl}/lp/fsbo`,
        fbp: capiCookies.get('_fbp')?.value,
        fbc: capiCookies.get('_fbc')?.value ?? capiCookies.get('rr_fbc')?.value,
        clientIp: capiClientIp,
        clientUserAgent: capiClientUa,
        customData: {
          content_name: 'fsbo_lp_pricing_report',
          lead_type: 'fsbo_seller',
          property_address: parsed.full,
          assigned_broker: assignment.broker,
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[fsbo-lp] CAPI call failed:', err))

    // ─── GA4 Measurement Protocol mirror ───────────────────────────────────
    await fireLeadGenerated({
      lp_variant: 'fsbo',
      lead_type: 'seller',
      lead_classification: 'hot',
      broker_slug: assignment.broker,
      value: 500,
      event_id: eventId,
      fub_person_id: fubPersonId,
      extra: {
        property_address: parsed.full,
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
    console.error('[fsbo-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong. Please try again or call us at 541.703.3095.' }
  }
}
