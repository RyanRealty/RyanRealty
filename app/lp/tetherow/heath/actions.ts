'use server'

import {
  addPersonTags,
  createRealtimeTask,
  findPersonByEmail,
  assignPersonToUser,
  type FubEventPerson,
  sendEvent,
} from '@/lib/followupboss'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { cookies, headers } from 'next/headers'

/**
 * Heath at Tetherow CMA form server action.
 *
 * FUB tag schema (per Matt 2026-05-17):
 *   seller-intent
 *   resort:tetherow
 *   subdivision:heath          <-- precision so sub-plat lead routing works
 *   lp:tetherow-heath-landing-v1
 *   cma-requested
 *   seller:<tier> derived from timeline
 *
 * Routes by default to Matt (FUB user id 1) unless an agent attribution
 * cookie is set on the visitor (rr_agent_attribution).
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

const FUB_USER_MATT = 1

export type HeathCmaTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type HeathCmaSubmission = {
  address: string
  name?: string
  email?: string
  phone?: string
  bedrooms?: string
  bathrooms?: string
  timeline: HeathCmaTimeline
}

export type HeathCmaResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' }
  | { success: false; error: string }

function classifyTimeline(t: HeathCmaTimeline): {
  classification: 'hot' | 'warm' | 'nurture'
  tierTag: string
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'seller:hot' }
    case 'next-3-6':
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'exploring':
    default:
      return { classification: 'nurture', tierTag: 'seller:nurture' }
  }
}

export async function submitHeathCmaForm(
  input: HeathCmaSubmission
): Promise<HeathCmaResult> {
  const eventId = generateEventId()

  // Basic validation
  if (!input.email || !input.address) {
    return { success: false, error: 'Email and address are required.' }
  }
  if (!input.email.includes('@')) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  const { classification, tierTag } = classifyTimeline(input.timeline)

  // Agent attribution: if the visitor came from a per-broker ad URL
  // (?agent=rebecca etc.) the cookie has been set by AgentAttributionBridge.
  const attribution = await readAttributedAgentServer()
  const assignedUserId = attribution?.userId ?? FUB_USER_MATT

  const tags = [
    'seller-intent',
    'resort:tetherow',
    'subdivision:heath',
    'lp:tetherow-heath-landing-v1',
    'cma-requested',
    tierTag,
  ]

  const firstName = (input.name ?? '').split(' ')[0]?.trim() || undefined
  const lastName = (input.name ?? '').split(' ').slice(1).join(' ').trim() || undefined

  const person: FubEventPerson = {
    firstName,
    lastName,
    emails: [{ value: input.email.trim() }],
    phones: input.phone ? [{ value: input.phone.trim() }] : undefined,
    tags,
  }

  try {
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

    // Send to FUB. Use sendEvent so a new lead is created if not already
    // known; existing leads are deduped by email match.
    await sendEvent({
      source: 'ryan-realty.com',
      type: 'Seller Inquiry',
      message: [
        `Heath at Tetherow CMA request`,
        `Property: ${input.address}`,
        input.bedrooms ? `Bedrooms: ${input.bedrooms}` : null,
        input.bathrooms ? `Bathrooms: ${input.bathrooms}` : null,
        `Timeline: ${input.timeline}`,
        `Classification: ${classification}`,
      ]
        .filter(Boolean)
        .join('\n'),
      person,
      campaign: originUtmSource
        ? {
            source: originUtmSource,
            ...(originUtmMedium && { medium: originUtmMedium }),
            ...(originUtmCampaign && { campaign: originUtmCampaign }),
            ...(originUtmContent && { content: originUtmContent }),
          }
        : undefined,
    })

    // Re-look-up + tag + assign + open a task for the broker.
    const existing = await findPersonByEmail(input.email.trim())
    if (existing?.id) {
      await addPersonTags(existing.id, tags)
      await assignPersonToUser(existing.id, assignedUserId)
      await createRealtimeTask({
        personId: existing.id,
        taskName: `Heath CMA: ${input.address}`,
        taskType: 'Follow Up',
        dueInMinutes: 24 * 60,
      })

      // Canonical schema layer — adds audience:seller + source:cma-request +
      // broker:slug and writes the marketing_assignments ledger row.
      // Idempotent against the manual tags above; lets the canonical FUB
      // automation rule pick this lead up the same way it picks up
      // /lp/seller-home-value submissions.
      await canonicallyTagLead({
        fubPersonId: existing.id,
        audience: 'seller',
        source: 'cma-request',
        tier: classification,
        address: input.address,
      })
    }

    // GA4 Measurement Protocol mirror — server-side generate_lead.
    await fireLeadGenerated({
      lp_variant: 'tetherow-heath-cma',
      lead_type: 'seller',
      lead_classification: classification,
      broker_slug: attribution?.broker ?? 'matt',
      value: 500,
      event_id: eventId,
      fub_person_id: existing?.id ?? null,
      extra: {
        property_address: input.address,
        timeline: input.timeline,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
      },
    })

    // ─── Meta CAPI Lead $500 with dedup event_id ──────────────────────────
    // Heath is the highest-value resort seller path. Previously this action
    // fired NO Meta conversion (only GA4) — the orphaned eventId meant any ad
    // pointing here optimized against a missing signal. Fire the server-side
    // Lead so Meta records the conversion even when the browser Pixel is
    // blocked; shares `eventId` with the client fbq('Lead') for dedup, and
    // forwards the visitor's _fbp/_fbc for advanced matching.
    const capiCookies = await cookies()
    void fetch(`${siteUrl}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email: input.email,
        phone: input.phone || undefined,
        firstName,
        lastName,
        eventId,
        eventSourceUrl: `${siteUrl}/lp/tetherow/heath`,
        fbp: capiCookies.get('_fbp')?.value,
        fbc: capiCookies.get('_fbc')?.value,
        customData: {
          content_name: 'tetherow_heath_cma',
          lead_type: 'seller_valuation',
          property_address: input.address,
          timeline: input.timeline,
          classification,
          assigned_broker: attribution?.broker ?? 'matt',
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[heath-cma] CAPI call failed:', err))
  } catch (err) {
    console.error('[heath-cma] FUB submit failed', err)
    return { success: false, error: 'Could not submit. Try again shortly or call 541.213.6706.' }
  }

  return { success: true, eventId, classification }
}
