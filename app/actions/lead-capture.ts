'use server'

import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { findPersonByEmail, sendEvent, type FubEventPerson } from '@/lib/followupboss'
import { recordPartnerReferral } from '@/app/actions/partnership-revenue'
import { generateEventId } from '@/lib/meta-pixel-helpers'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

async function fireCapiLead(args: {
  eventName: 'Lead' | 'ViewContent'
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  eventSourceUrl: string
  contentName: string
  value: number
}): Promise<string | null> {
  const eventId = generateEventId()
  try {
    await fetch(`${SITE_URL}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: args.eventName,
        email: args.email ?? undefined,
        phone: args.phone ?? undefined,
        firstName: args.firstName ?? undefined,
        lastName: args.lastName ?? undefined,
        eventId,
        eventSourceUrl: args.eventSourceUrl,
        customData: {
          content_name: args.contentName,
          value: args.value,
          currency: 'USD',
        },
      }),
    })
    return eventId
  } catch (err) {
    console.warn(`[lead-capture CAPI ${args.eventName}]`, err)
    return null
  }
}

type CampaignInput = {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

function websiteSource(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
}

function partnerSlugFromCampaign(source?: string): 'lender_referral' | 'relocation_referral' | null {
  const value = source?.trim().toLowerCase() ?? ''
  if (!value) return null
  if (value.includes('lender') || value.includes('mortgage')) return 'lender_referral'
  if (value.includes('relocation')) return 'relocation_referral'
  return null
}

export async function trackHomeValuationCta(campaign?: CampaignInput): Promise<void> {
  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const email = session?.user?.email?.trim() ?? null
  let person: FubEventPerson | null = null
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubPersonId != null && fubPersonId > 0) {
    person = { id: fubPersonId }
  }
  if (!person) return

  await sendEvent({
    type: 'Seller Inquiry',
    person,
    source: websiteSource(),
    sourceUrl: `${SITE_URL}/sell/valuation`,
    pageTitle: 'Home Valuation CTA',
    message: 'home-valuation-cta',
    campaign,
  })

  await fireCapiLead({
    eventName: 'ViewContent',
    email,
    eventSourceUrl: `${SITE_URL}/sell/valuation`,
    contentName: 'home_valuation_cta_click',
    value: 0,
  })

  const partnerSlug = partnerSlugFromCampaign(campaign?.source)
  if (partnerSlug) {
    await recordPartnerReferral({
      partnerSlug,
      leadSource: 'home_valuation_cta',
      leadIdentifier: email ?? (fubPersonId ? String(fubPersonId) : null),
      campaignSource: campaign?.source ?? null,
      campaignMedium: campaign?.medium ?? null,
      estimatedValue: partnerSlug === 'lender_referral' ? 300 : 2500,
      notes: 'Auto-attributed from valuation CTA campaign source.',
    })
  }
}

export async function submitExitIntentLead(input: {
  email: string
  context?: string
  pageUrl?: string
  campaign?: CampaignInput
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Invalid email' }
  }

  const existing = await findPersonByEmail(email)
  const person: FubEventPerson = existing ? { id: existing.id } : { emails: [{ value: email }] }

  const result = await sendEvent({
    type: 'Registration',
    person,
    source: websiteSource(),
    sourceUrl: input.pageUrl?.trim() || `${SITE_URL}/`,
    pageUrl: input.pageUrl?.trim(),
    pageTitle: 'Exit Intent Lead',
    message: input.context?.trim() || 'exit-intent-popup',
    campaign: input.campaign,
  })

  await fireCapiLead({
    eventName: 'Lead',
    email,
    eventSourceUrl: input.pageUrl?.trim() || `${SITE_URL}/`,
    contentName: 'exit_intent_popup',
    value: 100,
  })

  const partnerSlug = partnerSlugFromCampaign(input.campaign?.source)
  if (partnerSlug) {
    await recordPartnerReferral({
      partnerSlug,
      leadSource: 'exit_intent_popup',
      leadIdentifier: email,
      campaignSource: input.campaign?.source ?? null,
      campaignMedium: input.campaign?.medium ?? null,
      estimatedValue: partnerSlug === 'lender_referral' ? 300 : 2500,
      notes: 'Auto-attributed from exit intent campaign source.',
    })
  }

  return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
}

/**
 * Submit a contextual page CTA lead (email/phone capture from city, community, or content pages).
 * Creates a General Inquiry in FUB.
 */
export async function submitPageCTA(input: {
  email?: string
  phone?: string
  leadType?: 'general' | 'buyer' | 'seller' | 'newsletter'
  context?: string
  area?: string
}): Promise<{ error: string | null }> {
  try {
    const email = input.email?.trim().toLowerCase()
    const phone = input.phone?.trim()

    if (!email && !phone) {
      return { error: 'Please provide an email or phone number' }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please enter a valid email address' }
    }

    let person: FubEventPerson
    if (email) {
      const existing = await findPersonByEmail(email)
      person = existing
        ? { id: existing.id }
        : { emails: [{ value: email }], ...(phone ? { phones: [{ value: phone }] } : {}) }
    } else if (phone) {
      person = { phones: [{ value: phone }] }
    } else {
      return { error: 'Contact information required' }
    }

    const eventType = input.leadType === 'seller' ? 'Seller Inquiry' : 'General Inquiry'

    await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl: `${SITE_URL}/`,
      pageTitle: `Page CTA${input.area ? ` — ${input.area}` : ''}`,
      message: input.context ?? 'page-cta',
    })

    const value =
      input.leadType === 'seller' ? 500 :
      input.leadType === 'buyer' ? 300 :
      input.leadType === 'newsletter' ? 50 :
      150
    await fireCapiLead({
      eventName: 'Lead',
      email,
      phone,
      eventSourceUrl: `${SITE_URL}/`,
      contentName: `page_cta_${input.leadType ?? 'general'}${input.area ? `_${input.area}` : ''}`,
      value,
    })

    return { error: null }
  } catch (err) {
    console.error('[submitPageCTA]', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
