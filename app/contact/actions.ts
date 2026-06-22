'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { sendEvent, findPersonByEmail } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'
import { canonicallyTagLead, type LeadAudience } from '@/lib/canonical-lead-tagger'
import { backfillSessionToFub } from '@/lib/visitor-backfill'
import { fireLeadGenerated } from '@/lib/lead-tracking'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ContactFormState = { error?: string; success?: boolean; eventId?: string }

/**
 * Infer the audience (seller vs buyer) from the inquiry type. Defaults
 * to buyer because property inquiries are buyer-side by default. Sellers
 * are explicit via "seller" / "valuation" / "home value" keywords.
 */
function inferAudience(inquiryType: string): LeadAudience {
  const lower = inquiryType.toLowerCase()
  if (/seller|valuation|home value|sell|list my|appraisal/.test(lower)) return 'seller'
  return 'buyer'
}

export async function submitContactForm(formData: FormData): Promise<ContactFormState> {
  const name = formData.get('name')?.toString()?.trim() ?? ''
  const email = formData.get('email')?.toString()?.trim() ?? ''
  const phone = formData.get('phone')?.toString()?.trim() ?? ''
  const inquiryType = formData.get('inquiryType')?.toString()?.trim() ?? 'General Inquiry'
  const message = formData.get('message')?.toString()?.trim() ?? ''
  const sessionId = formData.get('sessionId')?.toString()?.trim() ?? ''
  // A2P/TCPA fail-closed: SMS only when the consent box was actively checked.
  const smsConsent = formData.get('smsConsent') === 'yes'

  if (!email) return { error: 'Email is required' }

  // Listing tour/question CTAs pass ?listingKey=. Resolve which home so the FUB
  // lead names the property (a broker shouldn't have to guess which listing).
  const listingKey = formData.get('listingKey')?.toString()?.trim() ?? ''
  let listingLabel = ''
  if (listingKey) {
    try {
      const { getListingsByKeys } = await import('@/app/actions/listings')
      const [tile] = await getListingsByKeys([listingKey])
      if (tile) {
        const street = [tile.StreetNumber, tile.StreetName].filter(Boolean).join(' ').trim()
        const where = [street, tile.City].filter(Boolean).join(', ')
        listingLabel = (where || 'a listing') + (tile.ListNumber ? ` (MLS ${tile.ListNumber})` : '')
      } else {
        listingLabel = `listing ${listingKey}`
      }
    } catch {
      listingLabel = `listing ${listingKey}`
    }
  }
  const messageTag = listingLabel ? `${inquiryType} — ${listingLabel}` : inquiryType

  // Inbound attribution UTMs (so sendEvent can carry campaign attribution)
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
    // malformed referer — no UTMs
  }

  const res = await sendEvent({
    type: 'General Inquiry',
    person: {
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone && { phones: [{ value: phone }] }),
    },
    source,
    sourceUrl: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/contact` : undefined,
    message: `[${messageTag}] ${message || '(no message)'}`,
    campaign: originUtmSource
      ? {
          source: originUtmSource,
          ...(originUtmMedium && { medium: originUtmMedium }),
          ...(originUtmCampaign && { campaign: originUtmCampaign }),
          ...(originUtmContent && { content: originUtmContent }),
        }
      : undefined,
  })

  if (!res.ok) return { error: res.error ?? 'Failed to send' }

  await sendContactNotification({ name, email, phone, inquiryType, message }).catch(() => {})

  // Canonical tagging — apply audience:* + source:* + broker:* + round-robin
  // assignment to whatever FUB person sendEvent just touched. Fire-and-forget
  // so it doesn't block the response. Per docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md §1.
  // after() keeps the serverless function alive until tagging/assignment/enroll/
  // backfill finish — a bare fire-and-forget IIFE can be frozen on return, which
  // dropped contact leads into FUB unassigned + un-enrolled.
  after(async () => {
    try {
      const found = await findPersonByEmail(email)
      if (found?.id) {
        const audience = inferAudience(inquiryType)
        await canonicallyTagLead({
          fubPersonId: found.id,
          audience,
          source: 'contact-form',
          originContext: {
            source: 'contact-form',
            sourceLabel: `Contact form (${inquiryType})`,
            landingPage: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/contact` : '/contact',
            audience,
            ...(message ? { want: message } : {}),
          },
        })
        // Instant CRM mirror + auto-enroll (kills the 30-min delta-cron lag).
        const { autoEnrollByFubId } = await import('@/lib/crm/enroll')
        await autoEnrollByFubId(found.id, { smsConsent }).catch((e: unknown) =>
          console.warn('[contact-form] instant auto-enroll failed:', e),
        )
        // Stitch this visitor's prior anonymous browsing history to the FUB
        // person. Idempotent; only replays when a real session id came through.
        if (sessionId && UUID_V4_RE.test(sessionId)) {
          await backfillSessionToFub({
            sessionId,
            fubPersonId: found.id,
            email,
            identifiedVia: 'form_submit',
          })
        }
      }
    } catch (err) {
      console.warn('[contact-form] canonical tagging failed (non-blocking):', err)
    }
  })

  // Send to Meta CAPI for deduplication with browser pixel.
  // Every Lead carries an estimated value so Meta's bid algorithm can
  // optimize for higher-value conversions. Property inquiries are higher
  // intent than general inquiries; fold that into the value tier.
  const eventId = generateEventId()
  const inquiryLower = inquiryType.toLowerCase()
  const leadValue = listingKey || inquiryLower.includes('property') || inquiryLower.includes('listing')
    ? 300
    : inquiryLower.includes('seller') || inquiryLower.includes('valuation')
      ? 500
      : 200
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/api/meta-capi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName: 'Lead',
      email,
      phone,
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      eventId,
      customData: {
        inquiry_type: inquiryType,
        value: leadValue,
        currency: 'USD',
      },
      eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/contact`,
    }),
  }).catch((err) => {
    console.warn('[Contact Form] CAPI call failed:', err)
  })

  // GA4 Measurement Protocol mirror — server-side generate_lead so the
  // conversion still lands when gtag is blocked (ad blockers, denied consent).
  const leadType = listingKey || inquiryLower.includes('property') || inquiryLower.includes('listing')
    ? 'listing_inquiry'
    : inquiryLower.includes('seller') || inquiryLower.includes('valuation')
      ? 'seller'
      : 'general'
  await fireLeadGenerated({
    lp_variant: 'contact',
    lead_type: leadType,
    value: leadValue,
    event_id: eventId,
    extra: { inquiry_type: inquiryType },
  })

  return { success: true, eventId }
}
