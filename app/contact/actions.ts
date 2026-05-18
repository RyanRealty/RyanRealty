'use server'

import { generateEventId } from '@/lib/meta-pixel-helpers'
import { sendEvent, findPersonByEmail } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'
import { canonicallyTagLead, type LeadAudience } from '@/lib/canonical-lead-tagger'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

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

  if (!email) return { error: 'Email is required' }

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
    message: `[${inquiryType}] ${message || '(no message)'}`,
  })

  if (!res.ok) return { error: res.error ?? 'Failed to send' }

  await sendContactNotification({ name, email, phone, inquiryType, message }).catch(() => {})

  // Canonical tagging — apply audience:* + source:* + broker:* + round-robin
  // assignment to whatever FUB person sendEvent just touched. Fire-and-forget
  // so it doesn't block the response. Per docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md §1.
  void (async () => {
    try {
      const found = await findPersonByEmail(email)
      if (found?.id) {
        await canonicallyTagLead({
          fubPersonId: found.id,
          audience: inferAudience(inquiryType),
          source: 'contact-form',
        })
      }
    } catch (err) {
      console.warn('[contact-form] canonical tagging failed (non-blocking):', err)
    }
  })()

  // Send to Meta CAPI for deduplication with browser pixel.
  // Every Lead carries an estimated value so Meta's bid algorithm can
  // optimize for higher-value conversions. Property inquiries are higher
  // intent than general inquiries; fold that into the value tier.
  const eventId = generateEventId()
  const inquiryLower = inquiryType.toLowerCase()
  const leadValue = inquiryLower.includes('property') || inquiryLower.includes('listing')
    ? 300
    : inquiryLower.includes('seller') || inquiryLower.includes('valuation')
      ? 500
      : 200
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://localhost:3000'}/api/meta-capi`, {
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
      eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://localhost:3000'}/contact`,
    }),
  }).catch((err) => {
    console.warn('[Contact Form] CAPI call failed:', err)
  })

  return { success: true, eventId }
}
