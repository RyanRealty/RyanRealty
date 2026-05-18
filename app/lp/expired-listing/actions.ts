'use server'

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

type BrokerSlug = 'matt' | 'rebecca' | 'paul'
type BrokerAssignment = { broker: BrokerSlug; userId: number }

export type ExpiredLPSubmission = {
  name?: string
  email: string
  phone?: string
  /** The expired listing address (the property they previously listed). */
  address?: string
  /** What they want — audit, call, or in-person walkthrough. */
  contactPath?: 'audit' | 'phone' | 'walkthrough'
  /** Optional notes. */
  notes?: string
}

export type ExpiredLPResult =
  | { success: true; eventId: string; alreadyKnown: boolean; assignedBroker: BrokerSlug }
  | { success: false; error: string }

async function assignExpiredLead(): Promise<BrokerAssignment> {
  // Honor ?agent= attribution; default to Matt.
  const attributed = await readAttributedAgentServer()
  if (attributed) return { broker: attributed.broker, userId: attributed.userId }
  return { broker: 'matt', userId: FUB_USER_MATT }
}

/**
 * Submit the expired-listing landing page form.
 *
 * Expired listings are seller leads with extra context. We tag them
 * audience:seller + seller:hot (they're a recent expired = hot prospect) +
 * source:expired-lp + the expired-listing intent tag so they get the
 * full seller workflow PLUS a broker priority alert.
 *
 * Per docs/FUB_BUYER_WORKFLOW_2026-05-17.md mirror + research from
 * docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md task 2.
 */
export async function submitExpiredLPForm(submission: ExpiredLPSubmission): Promise<ExpiredLPResult> {
  try {
    const email = submission.email?.trim().toLowerCase() ?? ''
    if (!email) return { success: false, error: 'Email is required' }

    const name = submission.name?.trim() ?? ''
    const phone = submission.phone?.trim() ?? ''
    const address = submission.address?.trim() ?? ''
    const contactPath = submission.contactPath ?? 'audit'
    const notes = submission.notes?.trim() ?? ''

    // ─── Resolve FUB person ────────────────────────────────────────────────
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

    const assignment = await assignExpiredLead()

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

    const eventResult = await sendEvent({
      type: 'Seller Inquiry',
      person,
      source,
      sourceUrl: `${siteUrl}/lp/expired-listing`,
      pageTitle: 'Expired Listing LP',
      message: `Expired listing audit request. ${address ? `Property: ${address}. ` : ''}Path: ${contactPath}. Assigned: ${assignment.broker}. ${notes ? `Notes: ${notes}` : ''}`,
    })

    if (!eventResult.ok) {
      console.warn('[expired-lp] FUB sendEvent failed:', eventResult.error)
    }

    if (!fubPersonId && email) {
      const newlyCreated = await findPersonByEmail(email)
      if (newlyCreated?.id) fubPersonId = newlyCreated.id
    }

    // ─── Compliance gate ───────────────────────────────────────────────────
    const hardStopped = fubPersonId ? await isHardStopped(fubPersonId) : false
    if (hardStopped) {
      console.warn(`[expired-lp] person ${fubPersonId} is compliance hard-stopped, skipping workflow enrollment`)
    }

    // ─── Apply canonical tags + assign + custom fields ─────────────────────
    if (fubPersonId && !hardStopped) {
      // Expired listings are HOT seller leads — they had real intent recently
      // (within the last X months) and they're warm to a re-list conversation.
      const tags: string[] = [
        'audience:seller',
        'seller:hot',
        'source:expired-lp',
        'intent:expired-listing',
        `broker:${assignment.broker}`,
      ]
      await addPersonTags(fubPersonId, tags)
      await assignPersonToUser(fubPersonId, assignment.userId)

      await setPersonCustomFields(fubPersonId, {
        customLeadTier: 'hot',
        customMoveTimeline: 'ready-now',
        customSellerPropertyAddress: address || 'unspecified',
      })
    }

    // ─── 5-min realtime task for ALL expired LP leads (hot category) ──────
    if (fubPersonId) {
      const who = [firstName, lastName].filter(Boolean).join(' ') || email
      void createRealtimeTask({
        personId: fubPersonId,
        taskName: `Hot expired-listing lead — call within 5 min: ${who} (${address || 'no address'})`,
        taskType: 'Call',
        dueInMinutes: 5,
      }).catch((e) => console.warn('[expired-lp] realtime task error:', e))
    }

    // ─── Meta CAPI Lead $500 (high-intent seller signal) ──────────────────
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
        eventSourceUrl: `${siteUrl}/lp/expired-listing`,
        customData: {
          content_name: 'expired_listing_lp',
          lead_type: 'expired_listing',
          property_address: address || 'unspecified',
          contact_path: contactPath,
          assigned_broker: assignment.broker,
          value: 500,
          currency: 'USD',
        },
      }),
    }).catch((err) => console.warn('[expired-lp] CAPI call failed:', err))

    return {
      success: true,
      eventId,
      alreadyKnown,
      assignedBroker: assignment.broker,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[expired-lp] Unexpected error:', msg)
    return { success: false, error: 'Something went wrong. Please try again or call us at (541) 703-3095.' }
  }
}
