'use server'

import type { LeadCapturePayload } from '@/components/site/LeadCaptureBlock'
import { submitSellerLPForm } from '@/app/lp/seller-home-value/actions'

/**
 * Broker-landing-page lead submit. Adapts the LeadCaptureBlock 'seller' payload
 * to the seller LP action, which creates the FUB person, applies the seller
 * tag taxonomy, and routes the lead to the ATTRIBUTED broker — the
 * BrokerAttributionSetter on the page set the attribution cookie to this broker,
 * so a lead from Rebecca's page lands in FUB assigned to Rebecca. Reuses the
 * tested seller pipeline rather than a parallel one.
 */
export async function submitBrokerSellerLead(
  payload: LeadCapturePayload,
): Promise<{ ok: boolean; message?: string }> {
  if (payload.variant !== 'seller') {
    return { ok: false, message: 'Unexpected form variant.' }
  }
  if (!payload.address?.trim()) {
    return { ok: false, message: 'A property address is required.' }
  }
  if (!payload.name?.trim() || !payload.email?.trim()) {
    return { ok: false, message: 'Name and email are required.' }
  }

  const result = await submitSellerLPForm({
    address: payload.address.trim(),
    name: payload.name.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim() || undefined,
    // The block's free-text timeline + notes carry through as motivation context.
    motivation: [payload.timeline, payload.notes].map((s) => s?.trim()).filter(Boolean).join(' · ') || undefined,
    source: 'seller-lp',
  })

  if (result.success) {
    return { ok: true, message: 'Got it. Your broker will reach out personally with a valuation.' }
  }
  return { ok: false, message: result.error || 'Something went wrong. Please try again.' }
}
