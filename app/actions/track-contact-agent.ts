'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEvent } from '@/lib/followupboss'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'

export type TrackContactAgentParams = {
  listingUrl: string
  userEmail?: string | null
  fubPersonId?: number | null
  property: {
    street?: string
    city?: string
    state?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
  }
}

const websiteSource = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

/**
 * Record a "contact agent about this listing" inquiry against the native CRM.
 * sendEvent captures via ensureNativeLead (FUB decommissioned 2026-06-24) and
 * returns the native crm_people id, which gates the canonical buyer tagging.
 * Replaces the dead FUB trackContactAgentInquiry + findPersonByEmail pair.
 */
async function captureContactAgentInquiry(params: TrackContactAgentParams & {
  message: string
  tagSource: 'showings-request' | 'idx-registration'
}): Promise<void> {
  const email = params.userEmail?.trim()
  const cookieId = params.fubPersonId
  const person = email
    ? { emails: [{ value: email }] }
    : cookieId != null && cookieId > 0
      ? { id: cookieId }
      : null
  if (!person) return

  const result = await sendEvent({
    type: 'Property Inquiry',
    person,
    source: websiteSource(),
    system: 'Ryan Realty Website',
    sourceUrl: params.listingUrl,
    message: params.message,
    property: {
      street: params.property.street,
      city: params.property.city,
      state: params.property.state,
      mlsNumber: params.property.mlsNumber,
      price: params.property.price,
      url: params.listingUrl,
      bedrooms: params.property.bedrooms != null ? String(params.property.bedrooms) : undefined,
      bathrooms: params.property.bathrooms != null ? String(params.property.bathrooms) : undefined,
    },
  })

  // Canonical tagging against the native person id sendEvent returned —
  // listing inquiries are always buyer-side. Falls back to the identity-bridge
  // cookie id for signed-out repeat visitors sendEvent could not resolve.
  const personId = (result.ok ? result.personId : null) ?? (cookieId && cookieId > 0 ? cookieId : null)
  if (personId) {
    await canonicallyTagLead({
      fubPersonId: personId,
      audience: 'buyer',
      source: params.tagSource,
      tier: 'warm',
    }).catch((err) => console.warn('[contact-agent] canonical tagging failed (non-blocking):', err))
  }
}

export async function trackContactAgentEmail(params: TrackContactAgentParams): Promise<void> {
  await captureContactAgentInquiry({
    ...params,
    message: 'Contact agent - email',
    tagSource: 'idx-registration',
  })
}

export type SubmitListingInquiryParams = {
  type: 'showing' | 'question'
  listingKey: string
  listingUrl: string
  listingAddress: string
  mlsNumber?: string | null
  listPrice?: number | null
  name?: string | null
  email?: string | null
  phone?: string | null
  message?: string | null
  userEmail?: string | null
  fubPersonId?: number | null
}

/** Submit showing request or ask-a-question form; writes to Supabase and captures the lead natively. */
export async function submitListingInquiry(params: SubmitListingInquiryParams): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Server not configured' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('listing_inquiries').insert({
    listing_key: params.listingKey,
    type: params.type,
    name: params.name?.trim() || null,
    email: params.email?.trim() || null,
    phone: params.phone?.trim() || null,
    message: params.message?.trim() || null,
    listing_url: params.listingUrl,
    listing_address: params.listingAddress,
    mls_number: params.mlsNumber ?? null,
  })
  if (error) return { ok: false, error: error.message }

  // Native lead capture + canonical buyer tagging. Awaited (a fire-and-forget
  // IIFE gets killed when the serverless lambda freezes on return); the inner
  // catch keeps a capture blip from failing the already-persisted inquiry.
  // Source is 'showings-request' for schedule-a-showing and 'idx-registration'
  // for the ask-a-question modal (mirrors the canonical source taxonomy).
  await captureContactAgentInquiry({
    listingUrl: params.listingUrl,
    userEmail: params.email ?? params.userEmail ?? null,
    fubPersonId: params.fubPersonId ?? null,
    property: {
      street: params.listingAddress?.split(',')[0]?.trim(),
      mlsNumber: params.mlsNumber ?? undefined,
      price: params.listPrice ?? undefined,
    },
    message: params.type === 'showing' ? 'Schedule a showing' : `Ask a question: ${(params.message ?? '').slice(0, 200)}`,
    tagSource: params.type === 'showing' ? 'showings-request' : 'idx-registration',
  }).catch((err) => console.error('[submitListingInquiry] lead capture failed (non-blocking):', err))

  // GA4 Measurement Protocol — listing_inquiry event (distinct from
  // generate_lead so dashboard pivots can break it out from form-fill leads).
  await fireLeadGenerated({
    event_name: 'listing_inquiry',
    lp_variant: 'listing-detail',
    lead_type: 'listing_inquiry',
    value: 300,
    fub_person_id: params.fubPersonId ?? null,
    extra: {
      inquiry_type: params.type,
      mls_number: params.mlsNumber ?? undefined,
      list_price: params.listPrice ?? undefined,
      listing_key: params.listingKey,
    },
  })

  return { ok: true }
}
