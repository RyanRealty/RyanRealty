'use server'

/**
 * "Email me this payment" — the listing page's payment calculator, sent to the
 * person who just built it (SITE-06).
 *
 * ── WHY THE SERVER RECOMPUTES ──────────────────────────────────────────────
 * CLAUDE.md §0: a figure that leaves this shop is verified against the source,
 * and a number the browser calculated is not a source. So the client sends only
 * the FOUR knobs a visitor can turn — price, down payment %, rate, term, plus an
 * optional insurance quote — and this action re-derives the payment here with
 * `computeMonthlyPitiBreakdown`, the same one formula the face estimate, the
 * calculator and the tile all use. Property tax and HOA are NOT accepted from
 * the client at all: they are facts about the house and they are read back off
 * the listing row through the DAL, so a posted payload cannot email a made-up
 * tax bill under our name.
 *
 * ── WHY IT IS NOT AN APPROVAL CLASS ────────────────────────────────────────
 * "A same-minute system confirmation to a visitor who just submitted their own
 * request is a system confirmation, not a broker send" (CLAUDE.md §1, Matt
 * 2026-09-07). This sends ONLY to the address typed into this form, in the same
 * request, once, and it promises nothing further — there is no cadence to state
 * and no subscription to unsubscribe from. It goes through the governed rail
 * (`lib/comms/site-confirmations.ts` -> sendGovernedEmail, initiator system),
 * which is what keeps `ci:governed-send` green and what runs the suppression
 * and consent checks.
 *
 * Hardening is the same as the alert captures: honeypot, per-IP limit that fails
 * closed in production, email validation, native dedup through sendEvent.
 */

import { getListingDetail } from '@/lib/data'
import { getAuthLimiter } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { sendEvent } from '@/lib/crm/send-event'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { nativeCrmPersonId } from '@/lib/alerts/enroll-identity'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { listingByKeyPath } from '@/lib/slug'
import { listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { formatPriceExact } from '@/lib/format/money'
import {
  computeMonthlyPitiBreakdown,
  DEFAULT_PITI_DOWN_PAYMENT_PCT,
  DEFAULT_PITI_RATE,
  DEFAULT_PITI_TERM_YEARS,
} from '@/lib/listing-tier1'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PaymentEmailResult = { ok: true } | { ok: false; error: string }

/** The visitor's own knobs. Every one is bounded here, not trusted. */
export type PaymentInputs = {
  price: number
  downPct: number
  ratePct: number
  termYears: number
  /** Their own insurance quote in dollars per year, or null for our assumption. */
  insuranceAnnual: number | null
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function submitListingPaymentEmail(input: {
  email: string
  listingKey: string
  inputs: PaymentInputs
  /** Honeypot, a hidden field humans never fill. */
  company?: string
}): Promise<PaymentEmailResult> {
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: true }
  }

  const isProd = process.env.NODE_ENV === 'production'
  try {
    const limiter = getAuthLimiter()
    if (!limiter) {
      if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
    } else {
      const h = await headers()
      const ip =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        h.get('cf-connecting-ip') ||
        '127.0.0.1'
      const { success } = await limiter.limit(`search-alert:${ip}`)
      if (!success) return { ok: false, error: 'Too many requests. Please try again in a minute.' }
    }
  } catch {
    if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  const listingKey = (input.listingKey ?? '').trim()
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(listingKey)) {
    return { ok: false, error: 'That listing could not be identified. Try again from the listing page.' }
  }

  // The house's own facts come from the house, never from the payload.
  const listing = await getListingDetail(listingKey).catch(() => null)
  if (!listing) {
    return { ok: false, error: 'That listing could not be identified. Try again from the listing page.' }
  }
  const address = listingMlsStreetLine(listing) || 'this home'

  const raw = input.inputs ?? ({} as PaymentInputs)
  const price = clamp(raw.price, 1_000, 100_000_000, listing.listPrice ?? 0)
  if (!(price > 0)) return { ok: false, error: 'We could not price that home.' }
  const downPct = clamp(raw.downPct, 0, 100, DEFAULT_PITI_DOWN_PAYMENT_PCT)
  const ratePct = clamp(raw.ratePct, 0.1, 25, DEFAULT_PITI_RATE * 100)
  const termYears = Math.round(clamp(raw.termYears, 1, 50, DEFAULT_PITI_TERM_YEARS))
  const insuranceAnnual =
    raw.insuranceAnnual == null ? null : clamp(raw.insuranceAnnual, 0, 500_000, 0)

  const breakdown = computeMonthlyPitiBreakdown({
    listPrice: price,
    taxAnnual: listing.taxAnnualAmount ?? null,
    hoaMonthly: listing.hoaMonthly ?? null,
    mortgageRate: ratePct,
    financedFraction: Math.min(1, Math.max(0, 1 - downPct / 100)),
    termMonths: termYears * 12,
    insuranceAnnual,
  })
  if (!breakdown) return { ok: false, error: 'We could not price that home.' }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const listingUrl = `${base}${listingByKeyPath(listingKey)}`
  const totalLine = `${formatPriceExact(Math.round(breakdown.total))} per month`
  const lines = [
    `  Principal and interest: ${formatPriceExact(Math.round(breakdown.pi))}`,
    `  Property taxes: ${formatPriceExact(Math.round(breakdown.taxMonthly))}`,
    `  Homeowners insurance: ${formatPriceExact(Math.round(breakdown.insuranceMonthly))}`,
    ...(breakdown.hoaMonthly > 0
      ? [`  HOA dues: ${formatPriceExact(Math.round(breakdown.hoaMonthly))}`]
      : []),
  ]
  const assumptions = `${formatPriceExact(price)} at ${downPct}% down, ${ratePct}% over ${termYears} years`

  let crmPersonId: number | null = null
  try {
    const attributed = await readAttributedAgentServer()
    const result = await sendEvent({
      type: 'Property Inquiry',
      person: { emails: [{ value: email }] },
      source: base.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com',
      system: 'Ryan Realty Website',
      sourceUrl: listingUrl,
      message: `Asked for the payment on ${address} (listingKey ${listingKey}) — ${totalLine}, ${assumptions}`,
      brokerAttribution: attributed ? { brokerSlug: attributed.broker } : undefined,
    })
    crmPersonId = result.ok ? nativeCrmPersonId(result.personId) : null
    if (crmPersonId) {
      await canonicallyTagLead({
        fubPersonId: crmPersonId,
        audience: 'buyer',
        source: 'idx-registration',
        tier: 'warm',
        originContext: {
          source: 'listing-payment-email',
          sourceLabel: 'Emailed themselves the payment',
          landingPage: listingUrl,
          audience: 'buyer',
          tier: 'warm',
          want: `Payment on ${address} (listingKey ${listingKey})`,
        },
      }).catch(() => {})
    }
  } catch {
    // Best-effort. A capture blip must not stop the visitor getting what they asked for.
  }

  if (crmPersonId == null) {
    // No CRM person means no consent record to check the send against, and the
    // chokepoint is keyed on a person. Say so rather than pretending it sent.
    return { ok: false, error: 'We could not send that right now. Try again in a moment.' }
  }

  const { sendPaymentEstimate } = await import('@/lib/comms/site-confirmations')
  const ack = await sendPaymentEstimate({
    personId: crmPersonId,
    leadEmail: email,
    address,
    listingUrl,
    totalLine,
    lines,
    assumptions,
  })
  console.log(
    `[response-clock] payment estimate person ${crmPersonId}: ${ack.ok ? 'sent' : 'not sent'} (${ack.via}${ack.error ? ` — ${ack.error}` : ''})`,
  )

  try {
    await fireLeadGenerated({
      lp_variant: 'listing-payment-email',
      lead_type: 'buyer',
      value: 0,
      fub_person_id: crmPersonId,
    })
  } catch {
    // best-effort
  }

  if (!ack.ok) return { ok: false, error: 'We could not send that right now. Try again in a moment.' }
  return { ok: true }
}
