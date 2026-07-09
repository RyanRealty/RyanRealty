'use server'

import {
  type FubEventPerson,
  sendEvent,
} from '@/lib/followupboss'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { resolveLeadSource, resolvePaidAttributionTags } from '@/lib/crm/lead-source'
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

    // Send natively so a new lead is created if not already known; existing
    // leads are deduped by email match. sendEvent() returns the native
    // crm_people id directly — this is the correct id to use downstream, not
    // the old findPersonByEmail() re-lookup (a dead FUB-API call since the
    // 2026-06-24 decommission, which always returned null and meant this
    // page's tag/assign/task block silently never ran). Fixed 2026-07-09.
    const eventResult = await sendEvent({
      source: resolveLeadSource(originUtmSource, 'cma-request'),
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

    const existing = eventResult.ok && eventResult.personId ? { id: eventResult.personId } : null
    if (existing?.id) {
      await createNativeTask({
        personId: existing.id,
        name: `Heath CMA: ${input.address}`,
        type: 'Follow Up',
        dueInMinutes: 24 * 60,
        assignedBroker: attribution?.broker,
      })

      // Canonical schema layer — adds audience:seller + source:cma-request +
      // broker:slug, writes the marketing_assignments ledger row, and (fixed
      // 2026-07-09) applies the paid-channel attribution tags too.
      await canonicallyTagLead({
        fubPersonId: existing.id,
        audience: 'seller',
        source: 'cma-request',
        tier: classification,
        address: input.address,
        extraTags: resolvePaidAttributionTags({ utmSource: originUtmSource, utmCampaign: originUtmCampaign, utmContent: originUtmContent }),
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
