'use server'

import { createClient } from '@supabase/supabase-js'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import {
  sendEvent,
  addPersonTags,
  createRealtimeTask,
  findPersonByEmail,
  assignPersonToUser,
  setPersonCustomFields,
  type FubEventPerson,
} from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { createCmaRequest } from '@/lib/cma-request'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

// ─── Broker routing constants ─────────────────────────────────────────────
// FUB user ids verified 2026-05-17 via /v1/identity + /v1/users. The
// FOLLOWUPBOSS_BROKER_USER_MAP env var can override these per-environment if
// a broker is added/removed/swapped between Matt's accounts.
const FUB_USER_MATT = 1
const FUB_USER_REBECCA = 2

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

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
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' | 'unknown'; alreadyKnown: boolean; assignedBroker: BrokerSlug | null }
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
  tierTag: string  // canonical tag: seller:hot | seller:warm | seller:nurture
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'seller:hot' }
    case 'next-3-6':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'exploring':
      return { classification: 'nurture', tierTag: 'seller:nurture' }
    default:
      return { classification: 'unknown', tierTag: 'seller:nurture' }
  }
}

/**
 * Round-robin between active brokers in the FUB "Seller Leads" group.
 *
 * Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md §6:
 *   - Hot leads default to Matt (override only if he's OOO — not implemented yet)
 *   - Warm + nurture round-robin between Matt + Rebecca
 *
 * Reads the most-recent row in public.marketing_assignments for audience='seller'
 * and picks the OTHER active broker. If no prior row exists, defaults to Matt.
 */
async function assignSellerLead(
  classification: 'hot' | 'warm' | 'nurture' | 'unknown',
): Promise<BrokerAssignment> {
  // Hot leads always go to Matt first (highest-value, fastest response).
  if (classification === 'hot') {
    return { broker: 'matt', userId: FUB_USER_MATT }
  }

  // Warm/nurture/unknown: round-robin between Matt + Rebecca.
  const supabase = getServiceSupabase()
  if (!supabase) {
    // Fail-safe: if Supabase is down, default to Matt so the lead is owned.
    return { broker: 'matt', userId: FUB_USER_MATT }
  }

  try {
    const { data, error } = await supabase
      .from('marketing_assignments')
      .select('broker')
      .eq('audience', 'seller')
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[seller-lp] marketing_assignments read failed:', error.message)
      return { broker: 'matt', userId: FUB_USER_MATT }
    }
    // If last seller assignment was Matt, give this one to Rebecca, and vice versa.
    if (data?.broker === 'matt') {
      return { broker: 'rebecca', userId: FUB_USER_REBECCA }
    }
    return { broker: 'matt', userId: FUB_USER_MATT }
  } catch (err) {
    console.warn('[seller-lp] assignment lookup failed:', err)
    return { broker: 'matt', userId: FUB_USER_MATT }
  }
}

async function recordSellerAssignment(params: {
  broker: BrokerSlug
  userId: number
  fubPersonId: number | null
  tier: 'hot' | 'warm' | 'nurture' | 'unknown'
  source: string
}): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) return
  const { error } = await supabase.from('marketing_assignments').insert({
    audience: 'seller',
    broker: params.broker,
    fub_user_id: params.userId,
    fub_person_id: params.fubPersonId,
    source: params.source,
    tier: params.tier === 'unknown' ? 'nurture' : params.tier,
  })
  if (error) {
    console.warn('[seller-lp] marketing_assignments insert failed:', error.message)
  }
}

/**
 * Submit the dedicated seller landing page form.
 *
 * Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md (locked 2026-05-17):
 *  1. Resolve or create FUB person (email match > cookie > new)
 *  2. Round-robin assign to Matt or Rebecca via public.marketing_assignments
 *  3. Apply canonical kebab-case namespaced tags:
 *       audience:seller + seller:{tier} + source:seller-lp + broker:{slug}
 *  4. Write 6 custom fields (move timeline, tier, property address, etc.)
 *  5. Create marketing_brain_actions row for the canonical CMA producer
 *  6. Fire Meta CAPI Lead $500 with shared event_id
 *  7. Create 5-min realtime task for hot leads
 *
 * Downstream: a FUB Automation Rule (configured in FUB UI) listens for the
 * `audience:seller` tag and enrolls the lead in the action plan
 * `Seller Lead — Master Workflow`. FUB's own engine fires all email + SMS
 * touches on schedule. Pause-on-reply is handled by the 15-min cron at
 * /api/cron/seller-workflow-pause.
 */
export async function submitSellerLPForm(submission: SellerLPSubmission): Promise<SellerLPResult> {
  try {
    const rawAddress = submission.address?.trim() ?? ''
    if (!rawAddress) return { success: false, error: 'Property address is required' }

    const email = submission.email?.trim().toLowerCase() ?? ''
    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const timeline = submission.timeline
    const { classification, tierTag } = classifyTimeline(timeline)

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

    // ─── Round-robin broker assignment (decided before FUB writes) ─────────
    const assignment = await assignSellerLead(classification)

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
      message: `Seller LP submission. Address: ${parsed.full}. Timeline: ${timeline ?? 'unspecified'}. Tier: ${classification}. Assigned: ${assignment.broker}.`,
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

    // ─── Resolve final FUB person id (in case sendEvent just created it) ──
    if (!fubPersonId && email) {
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) {
        fubPersonId = newlyCreated.id
      }
    }

    // ─── Apply canonical tags + assign broker + write custom fields ───────
    if (fubPersonId) {
      // 1. Tags — canonical kebab-case namespaced schema (see docs/FUB_SELLER_WORKFLOW_2026-05-17.md §4).
      const tags: string[] = [
        'audience:seller',
        tierTag,                         // seller:hot | seller:warm | seller:nurture
        'source:seller-lp',
        `broker:${assignment.broker}`,
      ]
      await addPersonTags(fubPersonId, tags)

      // 2. Broker assignment via FUB's assignedUserId.
      await assignPersonToUser(fubPersonId, assignment.userId)

      // 3. Custom fields — written via PUT /v1/people/{id} (see lib/followupboss.ts).
      await setPersonCustomFields(fubPersonId, {
        customMoveTimeline: timeline ?? 'unspecified',
        customLeadTier: classification,
        customIsSellerCurious: classification === 'nurture' ? 'true' : 'false',
        customSellerPropertyAddress: parsed.full,
      })

      // 4. Record the assignment in our local ledger for the next round-robin.
      await recordSellerAssignment({
        broker: assignment.broker,
        userId: assignment.userId,
        fubPersonId,
        tier: classification,
        source: 'seller-lp',
      })
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

    // ─── Canonical CMA request — queue the brain action ───────────────────
    // The LP form submission creates two rows:
    //   - public.cmas (status='draft') — the broker sees it in /admin/cmas
    //   - public.marketing_brain_actions (action_type='content:cma') — the
    //     brain dispatcher picks it up and runs the canonical CMA producer
    //     (marketing_brain_skills/producers/cma/SKILL.md), which builds the
    //     15-page HTML, renders the PDF, and ships it via /api/cma/[slug]/email.
    // Broker gets a notification email immediately; lead gets a confirmation
    // so they know we received their request and the CMA is in flight.
    if (email) {
      const created = await createCmaRequest({
        rawAddress: parsed.full,
        parsedStreet: parsed.street,
        parsedCity: parsed.city,
        parsedState: parsed.state,
        parsedPostalCode: parsed.postalCode,
        leadEmail: email,
        leadName: name || null,
        leadPhone: phone || null,
        leadTimeline: timeline ?? null,
        leadClassification: classification,
        fubPersonId,
      })
      if (!created.ok) {
        console.warn('[seller-lp] createCmaRequest failed:', created.error)
      }
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
          assigned_broker: assignment.broker,
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
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[seller-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong submitting your request. Please try again or call us at (541) 703-3095.' }
  }
}
