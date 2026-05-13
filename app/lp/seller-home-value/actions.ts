'use server'

import { createClient } from '@supabase/supabase-js'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import {
  sendEvent,
  addPersonTags,
  createRealtimeTask,
  findPersonByEmail,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

export type SellerLPTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type SellerLPSubmission = {
  address: string
  name?: string
  email?: string
  phone?: string
  timeline?: SellerLPTimeline
  /** Optional motivation field if the form ever surfaces it. */
  motivation?: string
}

export type SellerLPResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' | 'unknown'; alreadyKnown: boolean }
  | { success: false; error: string }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function parseAddress(raw: string): {
  street: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  full: string
} {
  const trimmed = raw.trim()
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  const street = parts[0] ?? null
  const city = parts[1] ?? null
  const stateZip = parts[2] ?? ''
  const m = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/)
  const state = m?.[1] ?? (stateZip.replace(/\d/g, '').trim() || null)
  const postalCode = m?.[2] ?? (parts[3]?.trim() || null)
  return { street, city, state, postalCode, full: trimmed }
}

function classifyTimeline(t: SellerLPTimeline | undefined): {
  classification: 'hot' | 'warm' | 'nurture' | 'unknown'
  sequenceTag: string
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', sequenceTag: 'auto:seller-seq:new' }
    case 'next-3-6':
      return { classification: 'warm', sequenceTag: 'auto:seller-seq:warm' }
    case 'next-6-12':
      return { classification: 'warm', sequenceTag: 'auto:seller-seq:warm' }
    case 'exploring':
      return { classification: 'nurture', sequenceTag: 'auto:seller-seq:watch' }
    default:
      return { classification: 'unknown', sequenceTag: 'auto:seller-seq:watch' }
  }
}

/**
 * Submit the dedicated seller landing page form.
 *
 * Multi-source intake: works whether the visitor is brand new (no identity),
 * already cookie-identified (fub_cid), or arriving with email/name from
 * an OAuth path. Always lands a FUB Seller Inquiry with audience:seller plus
 * a timeline classification tag, fires Meta CAPI Lead $500 with shared
 * event_id, and triggers a 5-min realtime task on hot leads.
 *
 * Reuses the same downstream contract as submitValuationRequest so the
 * existing weekly cron / outreach pipeline picks the lead up unchanged.
 */
export async function submitSellerLPForm(submission: SellerLPSubmission): Promise<SellerLPResult> {
  try {
    const rawAddress = submission.address?.trim() ?? ''
    if (!rawAddress) return { success: false, error: 'Property address is required' }

    const email = submission.email?.trim().toLowerCase() ?? ''
    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const timeline = submission.timeline
    const { classification, sequenceTag } = classifyTimeline(timeline)

    // ─── Resolve the FUB person ────────────────────────────────────────────
    // Priority: explicit email match > cookie-identified person id > new email-only.
    let fubPersonId: number | null = null
    let alreadyKnown = false

    if (email) {
      const existing = await findPersonByEmail(email)
      if (existing?.id) {
        fubPersonId = existing.id
        alreadyKnown = true
      }
    }
    if (!fubPersonId) {
      const cookiePersonId = await getFubPersonIdFromCookie()
      if (cookiePersonId) {
        fubPersonId = cookiePersonId
        alreadyKnown = true
      }
    }

    if (!email && !fubPersonId) {
      return {
        success: false,
        error: 'We need either an email or a prior identification to continue.',
      }
    }

    // ─── Address parsing for downstream property matching ──────────────────
    const parsed = parseAddress(rawAddress)

    // ─── Optional: persist the valuation request row ───────────────────────
    // Mirrors submitValuationRequest so the rest of the stack (auto-CMA, weekly
    // packets, dashboard ratios) treats this lead identically.
    const supabase = getServiceSupabase()
    if (supabase && email) {
      const { error: insertError } = await supabase.from('valuation_requests').insert({
        address_street: parsed.street,
        address_city: parsed.city,
        address_state: parsed.state,
        address_postal_code: parsed.postalCode,
        name: name || null,
        email,
        phone: phone || null,
        source_url: `${siteUrl}/lp/seller-home-value`,
      })
      if (insertError) {
        // Lead capture is the priority — don't fail the form on a DB hiccup.
        console.warn('[seller-lp] valuation_requests insert failed:', insertError.message)
      }
    }

    // ─── FUB Seller Inquiry event ─────────────────────────────────────────
    const firstName = name.split(/\s+/)[0] || undefined
    const lastName = name.split(/\s+/).slice(1).join(' ') || undefined

    const person: FubEventPerson = fubPersonId
      ? { id: fubPersonId }
      : {
          firstName,
          lastName,
          ...(email ? { emails: [{ value: email }] } : {}),
          ...(phone ? { phones: [{ value: phone }] } : {}),
        }

    const eventResult = await sendEvent({
      type: 'Seller Inquiry',
      person,
      source,
      sourceUrl: `${siteUrl}/lp/seller-home-value`,
      pageTitle: 'Seller LP — Home Value',
      message: `Seller LP submission. Address: ${parsed.full}. Timeline: ${timeline ?? 'unspecified'}. Classification: ${classification}.`,
      property: {
        street: parsed.street ?? undefined,
        city: parsed.city ?? undefined,
        state: parsed.state ?? undefined,
        code: parsed.postalCode ?? undefined,
      },
    })

    if (!eventResult.ok) {
      console.warn('[seller-lp] FUB sendEvent failed:', eventResult.error)
    }

    // ─── Apply audience + classification tags ─────────────────────────────
    // We need a numeric FUB id to tag. If we created via sendEvent we may not
    // have an id back; fall through gracefully — the weekly cron's
    // chooseOutreachPlan handles untagged seller leads as a 'watch' default.
    if (fubPersonId) {
      const tags: string[] = ['audience:seller', sequenceTag, 'source:seller-lp']
      if (classification === 'hot') tags.push('hot-seller')
      else if (classification === 'warm') tags.push('warm-seller')
      else if (classification === 'nurture') tags.push('nurture-only')
      await addPersonTags(fubPersonId, tags)
    } else if (email) {
      // Best effort: re-fetch by email a few hundred ms after sendEvent so the
      // tags land on the newly-created person.
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) {
        const tags: string[] = ['audience:seller', sequenceTag, 'source:seller-lp']
        if (classification === 'hot') tags.push('hot-seller')
        else if (classification === 'warm') tags.push('warm-seller')
        else if (classification === 'nurture') tags.push('nurture-only')
        await addPersonTags(newlyCreated.id, tags)
        fubPersonId = newlyCreated.id
      }
    }

    // ─── 5-min realtime task for hot leads only ────────────────────────────
    if (classification === 'hot' && fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email || 'unknown'
      void createRealtimeTask({
        personId: fubPersonId,
        taskName: `Hot seller LP lead — call within 5 min: ${who} (${parsed.full})`,
        taskType: 'Call',
        dueInMinutes: 5,
      }).catch((e) => console.warn('[seller-lp] realtime task error:', e))
    }

    // ─── Meta CAPI Lead $500 with dedup event_id ──────────────────────────
    const eventId = generateEventId()
    void fetch(`${siteUrl}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email: email || undefined,
        phone: phone || undefined,
        firstName,
        lastName,
        eventId,
        eventSourceUrl: `${siteUrl}/lp/seller-home-value`,
        customData: {
          content_name: 'seller_lp_home_value',
          lead_type: 'seller_valuation',
          property_address: parsed.full,
          timeline: timeline ?? 'unspecified',
          classification,
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => {
      console.warn('[seller-lp] CAPI call failed:', err)
    })

    return {
      success: true,
      eventId,
      classification,
      alreadyKnown,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[seller-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong submitting your request. Please try again or call us directly at (541) 703-3095.' }
  }
}
