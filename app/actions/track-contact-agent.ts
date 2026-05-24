'use server'

import { createClient } from '@supabase/supabase-js'
import { trackContactAgentInquiry, findPersonByEmail } from '@/lib/followupboss'
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

export async function trackContactAgentEmail(params: TrackContactAgentParams): Promise<void> {
  await trackContactAgentInquiry({
    ...params,
    message: 'Contact agent - email',
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

/** Submit showing request or ask-a-question form; writes to Supabase and triggers FUB. */
export async function submitListingInquiry(params: SubmitListingInquiryParams): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Server not configured' }
  const supabase = createClient(url, serviceKey)
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
  // Fire-and-forget: FUB tracking must never cause the user to see an error after successful DB write
  trackContactAgentInquiry({
    listingUrl: params.listingUrl,
    userEmail: params.userEmail ?? params.email ?? null,
    fubPersonId: params.fubPersonId ?? null,
    property: {
      street: params.listingAddress?.split(',')[0]?.trim(),
      mlsNumber: params.mlsNumber ?? undefined,
      price: params.listPrice ?? undefined,
    },
    message: params.type === 'showing' ? 'Schedule a showing' : `Ask a question: ${(params.message ?? '').slice(0, 200)}`,
  }).catch((err) => console.error('[submitListingInquiry] FUB tracking failed:', err))

  // Canonical tagging — listing inquiries are always buyer-side. Source is
  // 'showings-request' for schedule-a-showing and 'idx-registration' for the
  // ask-a-question modal (mirrors the FUB canonical source taxonomy).
  void (async () => {
    try {
      const emailForLookup = params.email?.trim() || params.userEmail?.trim() || null
      if (!emailForLookup) return
      const found = await findPersonByEmail(emailForLookup)
      if (found?.id) {
        await canonicallyTagLead({
          fubPersonId: found.id,
          audience: 'buyer',
          source: params.type === 'showing' ? 'showings-request' : 'idx-registration',
          tier: 'warm',
        })
      }
    } catch (err) {
      console.warn('[submitListingInquiry] canonical tagging failed (non-blocking):', err)
    }
  })()

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
