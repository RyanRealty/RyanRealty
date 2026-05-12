'use server'

import { sendEvent, type FubEventPerson } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'
import type { LeadLandingAudience } from '@/lib/lead-landing-content'
import { generateEventId } from '@/lib/meta-pixel-helpers'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function websiteSource(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
}

type SubmitLeadLandingInput = {
  audience: LeadLandingAudience
  pageTitle: string
  pagePath: string
  leadIntent: string
  name: string
  email: string
  phone?: string
  timeframe?: string
  message?: string
}

export async function submitLeadLandingForm(input: SubmitLeadLandingInput): Promise<{ error: string | null }> {
  try {
    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const phone = input.phone?.trim() || ''
    const timeframe = input.timeframe?.trim() || ''
    const message = input.message?.trim() || ''

    if (!name) return { error: 'Please enter your name' }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address' }

    const nameParts = name.split(/\s+/)
    const person: FubEventPerson = {
      firstName: nameParts[0] ?? undefined,
      lastName: nameParts.slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone ? { phones: [{ value: phone }] } : {}),
    }

    const eventType = input.audience === 'seller' ? 'Seller Inquiry' : 'General Inquiry'
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
    const sourceUrl = `${siteUrl}${input.pagePath}`
    const details = [
      `intent=${input.leadIntent}`,
      timeframe ? `timeframe=${timeframe}` : null,
      message ? `message=${message}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const result = await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl,
      pageUrl: sourceUrl,
      pageTitle: input.pageTitle,
      message: details || `intent=${input.leadIntent}`,
      campaign: {
        source: 'landing_page',
        medium: 'website',
        campaign: input.leadIntent,
        content: input.audience,
      },
    })
    if (!result.ok) return { error: result.error ?? 'Could not submit request right now' }

    const eventId = generateEventId()
    const leadValue = input.audience === 'seller' ? 500 : 300
    fetch(`${SITE_URL}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email,
        phone: phone || undefined,
        firstName: nameParts[0] ?? undefined,
        lastName: nameParts.slice(1).join(' ') || undefined,
        eventId,
        eventSourceUrl: sourceUrl,
        customData: {
          content_name: `lead_landing_${input.audience}`,
          lead_type: input.audience === 'seller' ? 'seller_inquiry' : 'buyer_inquiry',
          intent: input.leadIntent,
          value: leadValue,
          currency: 'USD',
        },
      }),
    }).catch((err) => {
      console.warn('[Lead Landing CAPI]', err)
    })

    await sendContactNotification({
      name,
      email,
      phone,
      inquiryType: input.audience === 'seller' ? 'Seller Lead Landing' : 'Buyer Lead Landing',
      message: `${input.pageTitle} | ${details || `intent=${input.leadIntent}`}`,
    }).catch(() => {})

    return { error: null }
  } catch (err) {
    console.error('[submitLeadLandingForm]', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
