'use server'

import { sendEvent, type LeadEventPerson } from '@/lib/crm/send-event'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'
import { cookies } from 'next/headers'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead, type LeadSource } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'

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

/**
 * Submit a contextual page CTA lead (email/phone capture from city, community, or content pages).
 * Creates a General Inquiry in the CRM.
 */

/**
 * First-party identity stitch for a captured lead (G2): link the durable
 * rr_vid cookie to the person sendEvent returned, so this browser's prior and
 * future browsing lands on their CRM trail. Restored 2026-09-01 — the only
 * stitch call in this file rode the removed submitExitIntentLead, leaving the
 * three live doors capturing leads with no identity link. Non-blocking.
 */
async function stitchCapturedLead(personId: number | null | undefined, email: string | null | undefined): Promise<void> {
  try {
    if (!personId || !email) return
    const rrVid = (await cookies()).get('rr_vid')?.value ?? null
    await stitchFormSubmitIdentity({ personId, email, rrVid, sessionId: null })
  } catch (err) {
    console.warn('[lead-capture] identity stitch failed (non-blocking):', err)
  }
}

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

    let person: LeadEventPerson
    if (email) {
      person = { emails: [{ value: email }], ...(phone ? { phones: [{ value: phone }] } : {}) }
    } else if (phone) {
      person = { phones: [{ value: phone }] }
    } else {
      return { error: 'Contact information required' }
    }

    const eventType = input.leadType === 'seller' ? 'Seller Inquiry' : 'General Inquiry'

    const result = await sendEvent({
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

    // Canonical tagging + ledger row against the native person id sendEvent
    // returned. Awaited (a void IIFE gets killed when the lambda freezes on
    // return); the try/catch keeps a tagging blip from failing the capture.
    try {
      if (result.ok && result.personId) {
        const audience = input.leadType === 'seller' ? 'seller' : 'buyer'
        const source: LeadSource = input.leadType === 'seller'
          ? 'homepage-cta'
          : input.leadType === 'newsletter'
            ? 'blog-email'
            : 'homepage-cta'
        await canonicallyTagLead({
          fubPersonId: result.personId,
          audience,
          source,
        })
      }
    } catch (err) {
      console.warn('[page-cta] canonical tagging failed (non-blocking):', err)
    }

    await stitchCapturedLead(result.ok ? result.personId : null, email)

    // GA4 Measurement Protocol mirror.
    await fireLeadGenerated({
      lp_variant: `page-cta-${input.leadType ?? 'general'}${input.area ? `-${input.area}` : ''}`,
      lead_type: input.leadType === 'seller' ? 'seller' : input.leadType === 'buyer' ? 'buyer' : 'page_cta',
      value,
      extra: {
        area: input.area,
        context: input.context,
      },
    })

    return { error: null }
  } catch (err) {
    console.error('[submitPageCTA]', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Rental property calculator lead — a visitor running the numbers on a rental
 * asks a Ryan Realty broker to pull real rent comps + underwrite a deal. An
 * investor is a buyer-side lead, so audience:'buyer', source:'contact-form',
 * tier:'nurture' (researching, not yet hot), plus 'rental-calculator'/'investor'
 * context tags. Routes to Matt by default (canonicallyTagLead handles routing).
 *
 * Mirrors submitTetherowLead's CRM-event -> Meta-CAPI -> canonical-tags -> GA4
 * pattern, with the property + analysis context in the message.
 */
export async function submitRentalLead(input: {
  name?: string
  email?: string
  phone?: string
  /** Property address from the calculator, when launched from a listing. */
  propertyLabel?: string
  listingKey?: string
  /** One-line analysis context, e.g. "$650K · cash flow -$1,431/mo · cap 3.7%". */
  contextNote?: string
  pageUrl?: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim()
  if (!email && !phone) return { ok: false, error: 'Email or phone is required' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address' }
  }
  try {
    const fullName = input.name?.trim() || ''
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || undefined
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

    let person: LeadEventPerson
    if (email) {
      person = {
        emails: [{ value: email }],
        ...(phone ? { phones: [{ value: phone }] } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    } else {
      person = {
        phones: [{ value: phone! }],
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    }

    const pageUrl = input.pageUrl?.trim() || `${SITE_URL}/tools/rental-property-calculator`
    const message = `Rental calculator lead. ${[input.propertyLabel, input.contextNote].filter(Boolean).join(' · ') || 'standalone tool'}`

    const result = await sendEvent({
      type: 'General Inquiry',
      person,
      source: websiteSource(),
      sourceUrl: pageUrl,
      pageUrl,
      pageTitle: 'Rental Property Calculator',
      message,
    })

    await fireCapiLead({
      eventName: 'Lead', email, phone, firstName, lastName,
      eventSourceUrl: pageUrl,
      contentName: 'rental_calculator_lead',
      value: 300,
    })

    // Canonical tags MUST be awaited on serverless (the lambda freezes on return).
    // Runs against the native person id sendEvent returned; the context tags
    // ride extraTags so enrichNativeLead unions them in one write.
    try {
      if (result.ok && result.personId) {
        await canonicallyTagLead({
          fubPersonId: result.personId,
          audience: 'buyer',
          source: 'contact-form',
          tier: 'nurture',
          extraTags: ['rental-calculator', 'investor'],
          originContext: {
            source: 'rental-calculator',
            sourceLabel: 'Rental property calculator',
            landingPage: pageUrl,
            audience: 'buyer',
            tier: 'nurture',
            ...(input.propertyLabel || input.contextNote
              ? { want: [input.propertyLabel, input.contextNote].filter(Boolean).join(' · ') }
              : {}),
          },
        })
      }
    } catch (err) {
      console.warn('[rental-lead] canonical tagging failed (non-blocking):', err)
    }

    await stitchCapturedLead(result.ok ? result.personId : null, email)

    await fireLeadGenerated({
      lp_variant: 'rental-calculator',
      lead_type: 'buyer',
      value: 300,
      extra: { listing_key: input.listingKey, property: input.propertyLabel },
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
  } catch (err) {
    console.error('[submitRentalLead]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Tetherow landing-page lead capture (buyer showings/alerts/guide + seller
 * valuation + exit-intent). The /api/cma POST endpoint calls this.
 *
 * BUG FIX 2026-05-31: all 5 Tetherow forms POSTed to /api/cma, which had no
 * top-level route handler (only /api/cma/[slug]/* existed) — so every luxury
 * paid-traffic lead 404'd and was silently lost while the form showed a fake
 * green success. This restores capture: CRM event -> Meta CAPI -> CANONICAL
 * tags (audience:seller|buyer — NOT the old 'seller-intent' string that never
 * triggered the CRM workflow) -> GA4 mirror. Tetherow is high-intent paid
 * traffic, so tier='hot'.
 */
export async function submitTetherowLead(input: {
  intent: 'buyer' | 'seller'
  name?: string
  email?: string
  phone?: string
  resort?: string
  campaign?: string
  /** comma-separated context tags from the form (resort:*, lp:*, etc.) */
  contextTags?: string
  // seller context
  address?: string
  subdivision?: string
  timing?: string
  bedrooms?: string
  bathrooms?: string
  // buyer context
  property?: string
  pageUrl?: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim()
  if (!email && !phone) return { ok: false, error: 'Email or phone is required' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address' }
  }
  try {
    const fullName = input.name?.trim() || ''
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || undefined
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

    let person: LeadEventPerson
    if (email) {
      person = {
        emails: [{ value: email }],
        ...(phone ? { phones: [{ value: phone }] } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    } else {
      person = {
        phones: [{ value: phone! }],
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    }

    const isSeller = input.intent === 'seller'
    const eventType = isSeller ? 'Seller Inquiry' : 'General Inquiry'
    const ctxBits = isSeller
      ? [input.address, input.subdivision, input.timing,
         input.bedrooms ? `${input.bedrooms} bd` : '', input.bathrooms ? `${input.bathrooms} ba` : '']
      : [input.property]
    const message = `Tetherow ${input.intent} lead. ${ctxBits.filter(Boolean).join(' · ') || 'no extra detail'}`
    const pageUrl = input.pageUrl?.trim() || `${SITE_URL}/lp/tetherow/`

    const result = await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl: pageUrl,
      pageUrl,
      pageTitle: 'Tetherow Landing Page',
      message,
    })

    // Luxury Tetherow paid leads are high-value.
    const value = isSeller ? 1000 : 600
    await fireCapiLead({
      eventName: 'Lead', email, phone, firstName, lastName,
      eventSourceUrl: pageUrl,
      contentName: `tetherow_${input.intent}`,
      value,
    })

    // Canonical tags (correct audience trigger) + preserved resort context.
    // MUST be awaited: on Vercel serverless the lambda freezes the instant the
    // handler returns, so a fire-and-forget here was being killed mid-flight —
    // leads landed with only the bare sendEvent default tag and lost their
    // resort:tetherow / audience:seller tagging. Awaiting guarantees the tags
    // write before the function returns. The inner try/catch preserves the
    // original intent (a tagging blip never fails the capture itself).
    try {
      if (result.ok && result.personId) {
        // Keep the resort/campaign context tags, but DROP the legacy
        // 'seller-intent'/'buyer-intent' strings (they never triggered the
        // workflow — canonicallyTagLead applies the real audience:* trigger).
        const ctx = (input.contextTags ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t && !/-intent$/.test(t))
        ctx.push('resort:tetherow', 'lp:tetherow-landing-v1')
        await canonicallyTagLead({
          fubPersonId: result.personId,
          audience: isSeller ? 'seller' : 'buyer',
          source: isSeller ? 'seller-lp' : 'buyer-lp',
          tier: 'hot',
          extraTags: [...new Set(ctx)],
          ...(isSeller && input.address ? { address: input.address, state: 'OR' } : {}),
        })
      }
    } catch (err) {
      console.warn('[tetherow-lead] canonical tagging failed (non-blocking):', err)
    }

    await stitchCapturedLead(result.ok ? result.personId : null, email)

    await fireLeadGenerated({
      lp_variant: 'tetherow-landing-v1',
      lead_type: isSeller ? 'seller' : 'buyer',
      value,
      extra: { resort: input.resort ?? 'tetherow', campaign: input.campaign, intent: input.intent },
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
  } catch (err) {
    console.error('[submitTetherowLead]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
