'use server'

import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { findPersonByEmail, sendEvent, type FubEventPerson } from '@/lib/followupboss'

export type TrackCtaClickParams = {
  label: string
  destination: string
  pageUrl?: string
  context?: string
  brokerSlug?: string
}

/**
 * Track CTA clicks in Follow Up Boss when we can identify a contact
 * from signed-in email or identity-bridge cookie.
 */
export async function trackCtaClickAction(params: TrackCtaClickParams): Promise<void> {
  const label = params.label?.trim()
  const destination = params.destination?.trim()
  if (!label || !destination) return

  const [session, fubPersonId] = await Promise.all([getSession(), getPersonIdFromCookie()])
  const email = session?.user?.email?.trim() || null

  let person: FubEventPerson | null = null
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubPersonId != null && fubPersonId > 0) {
    person = { id: fubPersonId }
  }
  if (!person) return

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const messageParts = [
    `CTA click: ${label}`,
    `Destination: ${destination}`,
    params.context?.trim() ? `Context: ${params.context.trim()}` : '',
    params.brokerSlug?.trim() ? `Broker: ${params.brokerSlug.trim()}` : '',
  ].filter(Boolean)

  await sendEvent({
    type: 'Visited Website',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.pageUrl?.trim() || destination,
    pageUrl: params.pageUrl?.trim() || destination,
    pageTitle: 'CTA Click',
    message: messageParts.join('\n'),
    brokerAttribution: params.brokerSlug?.trim()
      ? {
          brokerSlug: params.brokerSlug.trim().toLowerCase(),
        }
      : undefined,
  })
}
