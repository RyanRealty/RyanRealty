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
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const source = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || 'ryan-realty.com'

const FUB_USER_MATT = 1
// Rebecca (id 2) + Paul (id 3) remain in FUB but no auto-route per Matt
// 2026-05-17. Manual reassignment via FUB UI only.

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

export type BuyerLPTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type BuyerLPSubmission = {
  name?: string
  email: string
  phone?: string
  budgetMin?: number
  budgetMax?: number
  searchAreas?: string[]  // neighborhood slugs
  bedsMin?: number
  timeline?: BuyerLPTimeline
  notes?: string
}

export type BuyerLPResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' | 'unknown'; alreadyKnown: boolean; assignedBroker: BrokerSlug | null }
  | { success: false; error: string }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function classifyTimeline(t: BuyerLPTimeline | undefined): {
  classification: 'hot' | 'warm' | 'nurture' | 'unknown'
  tierTag: string
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'buyer:hot' }
    case 'next-3-6':
      return { classification: 'warm', tierTag: 'buyer:warm' }
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'buyer:warm' }
    case 'exploring':
      return { classification: 'nurture', tierTag: 'buyer:nurture' }
    default:
      return { classification: 'unknown', tierTag: 'buyer:nurture' }
  }
}

/**
 * Broker assignment for buyer LP leads.
 *
 * Same logic as seller LP: default to Matt unless `?agent=<slug>` cookie
 * routes to a specific broker. See app/lp/seller-home-value/actions.ts
 * for the full rationale.
 */
async function assignBuyerLead(
  _classification: 'hot' | 'warm' | 'nurture' | 'unknown',
): Promise<BrokerAssignment> {
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId }
  return { broker: 'matt', userId: FUB_USER_MATT }
}

async function recordBuyerAssignment(params: {
  broker: BrokerSlug
  userId: number
  fubPersonId: number | null
  tier: 'hot' | 'warm' | 'nurture' | 'unknown'
  source: string
}): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) return
  const { error } = await supabase.from('marketing_assignments').insert({
    audience: 'buyer',
    broker: params.broker,
    fub_user_id: params.userId,
    fub_person_id: params.fubPersonId,
    source: params.source,
    tier: params.tier === 'unknown' ? 'nurture' : params.tier,
  })
  if (error) console.warn('[buyer-lp] marketing_assignments insert failed:', error.message)
}

/**
 * Submit the dedicated buyer landing page form.
 *
 * Per docs/FUB_BUYER_WORKFLOW_2026-05-17.md:
 *  1. Resolve or create FUB person (email match > cookie > new)
 *  2. Round-robin assign to Matt or Rebecca via marketing_assignments
 *  3. Apply canonical tags: audience:buyer + buyer:tier + source:buyer-lp + broker:slug
 *  4. Write 5 custom fields (budget min/max, search areas, beds min, timeline)
 *  5. Create 5-min realtime task for hot leads
 *  6. Fire Meta CAPI Lead $300 event
 *
 * Downstream: a FUB Automation Rule listens for `audience:buyer` and
 * enrolls the lead in action plan id 70 (`Buyer Lead — Master Workflow`).
 * FUB's engine fires email + SMS touches on schedule. Pause-on-reply is
 * handled by the 15-min cron at /api/cron/seller-workflow-pause (extended
 * to handle both audiences).
 */
export async function submitBuyerLPForm(submission: BuyerLPSubmission): Promise<BuyerLPResult> {
  try {
    const email = submission.email?.trim().toLowerCase() ?? ''
    if (!email) return { success: false, error: 'Email is required' }

    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const timeline = submission.timeline
    const { classification, tierTag } = classifyTimeline(timeline)

    const budgetMin = submission.budgetMin
    const budgetMax = submission.budgetMax
    const searchAreasArr = submission.searchAreas ?? []
    const bedsMin = submission.bedsMin
    const notes = submission.notes?.trim() ?? ''

    // ─── Resolve the FUB person ────────────────────────────────────────────
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

    // ─── Round-robin broker assignment ─────────────────────────────────────
    const assignment = await assignBuyerLead(classification)

    // ─── FUB Buyer Inquiry event ───────────────────────────────────────────
    const firstName = name.split(/\s+/)[0] || undefined
    const lastName = name.split(/\s+/).slice(1).join(' ') || undefined

    const person: FubEventPerson = fubPersonId
      ? { id: fubPersonId }
      : {
          firstName,
          lastName,
          emails: [{ value: email }],
          ...(phone ? { phones: [{ value: phone }] } : {}),
        }

    const budgetStr = budgetMin || budgetMax
      ? `$${budgetMin ?? '?'}–$${budgetMax ?? '?'}`
      : 'unspecified'
    const areasStr = searchAreasArr.length ? searchAreasArr.join(', ') : 'unspecified'

    const eventResult = await sendEvent({
      type: 'Property Inquiry',
      person,
      source,
      sourceUrl: `${siteUrl}/lp/buyer-listing-alerts`,
      pageTitle: 'Buyer LP — Listing Alerts',
      message: `Buyer LP submission. Budget: ${budgetStr}. Areas: ${areasStr}. Beds min: ${bedsMin ?? 'unspecified'}. Timeline: ${timeline ?? 'unspecified'}. Tier: ${classification}. Assigned: ${assignment.broker}. ${notes ? `Notes: ${notes}` : ''}`,
    })

    if (!eventResult.ok) {
      console.warn('[buyer-lp] FUB sendEvent failed:', eventResult.error)
    }

    // ─── Resolve final FUB person id ───────────────────────────────────────
    if (!fubPersonId && email) {
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) fubPersonId = newlyCreated.id
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    // Skip workflow enrollment if person carries hard-stop tags.
    // See docs/FUB_OPTIMIZATION_AUDIT_2026-05-17 §7.
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[buyer-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Apply canonical tags + assign broker + write custom fields ────────
    if (fubPersonId && !hardStopped) {
      const tags: string[] = [
        'audience:buyer',
        tierTag,
        'source:buyer-lp',
        `broker:${assignment.broker}`,
      ]
      await addPersonTags(fubPersonId, tags)
      await assignPersonToUser(fubPersonId, assignment.userId)

      // Custom fields — buyer schema per FUB_BUYER_WORKFLOW_2026-05-17 §6
      const customFields: Record<string, string | number | undefined> = {
        customLeadTier: classification,
        customBuyerMoveTimeline: timeline ?? 'unspecified',
      }
      if (typeof budgetMin === 'number') customFields.customBuyerBudgetMin = budgetMin
      if (typeof budgetMax === 'number') customFields.customBuyerBudgetMax = budgetMax
      if (searchAreasArr.length) customFields.customBuyerSearchAreas = searchAreasArr.join(',')
      if (typeof bedsMin === 'number') customFields.customBuyerBedsMin = bedsMin
      await setPersonCustomFields(fubPersonId, customFields)

      await recordBuyerAssignment({
        broker: assignment.broker,
        userId: assignment.userId,
        fubPersonId,
        tier: classification,
        source: 'buyer-lp',
      })
    }

    // ─── 5-min realtime task for hot leads ─────────────────────────────────
    if (classification === 'hot' && fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email
      void createRealtimeTask({
        personId: fubPersonId,
        taskName: `Hot buyer LP lead — call within 5 min: ${who} (${budgetStr}, ${areasStr})`,
        taskType: 'Call',
        dueInMinutes: 5,
      }).catch((e) => console.warn('[buyer-lp] realtime task error:', e))
    }

    // ─── Meta CAPI Lead $300 ───────────────────────────────────────────────
    const eventId = generateEventId()
    void fetch(`${siteUrl}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email,
        phone: phone || undefined,
        firstName,
        lastName,
        eventId,
        eventSourceUrl: `${siteUrl}/lp/buyer-listing-alerts`,
        customData: {
          content_name: 'buyer_lp_listing_alerts',
          lead_type: 'buyer_listing_alerts',
          budget_min: budgetMin,
          budget_max: budgetMax,
          search_areas: searchAreasArr,
          timeline: timeline ?? 'unspecified',
          classification,
          assigned_broker: assignment.broker,
          value: 300,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[buyer-lp] CAPI call failed:', err))

    return {
      success: true,
      eventId,
      classification,
      alreadyKnown,
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[buyer-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong. Please try again or call us at (541) 703-3095.' }
  }
}
