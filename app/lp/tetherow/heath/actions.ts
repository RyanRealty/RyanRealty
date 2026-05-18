'use server'

import {
  addPersonTags,
  createRealtimeTask,
  findPersonByEmail,
  assignPersonToUser,
  type FubEventPerson,
  sendEvent,
} from '@/lib/followupboss'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { generateEventId } from '@/lib/meta-pixel-helpers'

/**
 * Heath at Tetherow CMA form server action.
 *
 * FUB tag schema (per Matt 2026-05-17):
 *   seller-intent
 *   resort:tetherow
 *   subdivision:heath          <-- precision so sub-plat lead routing works
 *   lp:tetherow-heath-landing-v1
 *   cma-requested
 *   seller:<tier> derived from timeline
 *
 * Routes by default to Matt (FUB user id 1) unless an agent attribution
 * cookie is set on the visitor (rr_agent_attribution).
 */

const FUB_USER_MATT = 1

export type HeathCmaTimeline = 'ready-now' | 'next-3-6' | 'next-6-12' | 'exploring'

export type HeathCmaSubmission = {
  address: string
  name?: string
  email?: string
  phone?: string
  bedrooms?: string
  bathrooms?: string
  timeline: HeathCmaTimeline
}

export type HeathCmaResult =
  | { success: true; eventId: string; classification: 'hot' | 'warm' | 'nurture' }
  | { success: false; error: string }

function classifyTimeline(t: HeathCmaTimeline): {
  classification: 'hot' | 'warm' | 'nurture'
  tierTag: string
} {
  switch (t) {
    case 'ready-now':
      return { classification: 'hot', tierTag: 'seller:hot' }
    case 'next-3-6':
    case 'next-6-12':
      return { classification: 'warm', tierTag: 'seller:warm' }
    case 'exploring':
    default:
      return { classification: 'nurture', tierTag: 'seller:nurture' }
  }
}

export async function submitHeathCmaForm(
  input: HeathCmaSubmission
): Promise<HeathCmaResult> {
  const eventId = generateEventId()

  // Basic validation
  if (!input.email || !input.address) {
    return { success: false, error: 'Email and address are required.' }
  }
  if (!input.email.includes('@')) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  const { classification, tierTag } = classifyTimeline(input.timeline)

  // Agent attribution: if the visitor came from a per-broker ad URL
  // (?agent=rebecca etc.) the cookie has been set by AgentAttributionBridge.
  const attribution = await readAttributedAgentServer()
  const assignedUserId = attribution?.userId ?? FUB_USER_MATT

  const tags = [
    'seller-intent',
    'resort:tetherow',
    'subdivision:heath',
    'lp:tetherow-heath-landing-v1',
    'cma-requested',
    tierTag,
  ]

  const firstName = (input.name ?? '').split(' ')[0]?.trim() || undefined
  const lastName = (input.name ?? '').split(' ').slice(1).join(' ').trim() || undefined

  const person: FubEventPerson = {
    firstName,
    lastName,
    emails: [{ value: input.email.trim() }],
    phones: input.phone ? [{ value: input.phone.trim() }] : undefined,
    tags,
    source: 'ryan-realty.com',
  }

  try {
    // Send to FUB. Use sendEvent so a new lead is created if not already
    // known; existing leads are deduped by email match.
    await sendEvent({
      source: 'ryan-realty.com',
      type: 'Seller Inquiry',
      message: [
        `Heath at Tetherow CMA request`,
        `Property: ${input.address}`,
        input.bedrooms ? `Bedrooms: ${input.bedrooms}` : null,
        input.bathrooms ? `Bathrooms: ${input.bathrooms}` : null,
        `Timeline: ${input.timeline}`,
        `Classification: ${classification}`,
      ]
        .filter(Boolean)
        .join('\n'),
      person,
    })

    // Re-look-up + tag + assign + open a task for the broker.
    const existing = await findPersonByEmail(input.email.trim())
    if (existing?.id) {
      await addPersonTags(existing.id, tags)
      await assignPersonToUser(existing.id, assignedUserId)
      await createRealtimeTask({
        personId: existing.id,
        taskName: `Heath CMA: ${input.address}`,
        taskType: 'Follow Up',
        dueInMinutes: 24 * 60,
      })
    }
  } catch (err) {
    console.error('[heath-cma] FUB submit failed', err)
    return { success: false, error: 'Could not submit. Try again shortly or call 541.213.6706.' }
  }

  return { success: true, eventId, classification }
}
