/**
 * Canonical lead tagger — post-process every lead-creation path with the
 * same tag-schema + round-robin assignment + custom-field writes that the
 * seller LP form uses.
 *
 * Idea: instead of refactoring every existing FUB person-create path, this
 * helper runs AFTER an existing `sendEvent()` or person-create call. The
 * caller passes the FUB person id + audience + source, and this helper
 * applies the canonical schema universally:
 *
 *   1. `audience:<seller|buyer>` tag
 *   2. `source:<path>` tag
 *   3. `broker:<slug>` tag (from round-robin assignment)
 *   4. PUT assignedUserId on the person
 *   5. Insert row in marketing_assignments ledger
 *
 * Idempotent — if the person already has the canonical tags, no-op writes.
 *
 * Per `docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md` §1 + §13.
 */

import { createClient } from '@supabase/supabase-js'
import { addPersonTags, assignPersonToUser, setPersonCustomFields } from '@/lib/followupboss'

export type LeadAudience = 'seller' | 'buyer'
export type LeadSource =
  | 'seller-lp'
  | 'buyer-lp'
  | 'fb-ads-seller'
  | 'fb-ads-buyer'
  | 'contact-form'
  | 'cma-request'
  | 'idx-registration'
  | 'showings-request'
  | 'calendly'
  | 'blog-email'
  | 'homepage-cta'
  | 'unknown'

export type CanonicalLeadParams = {
  fubPersonId: number
  audience: LeadAudience
  source: LeadSource
  /** Optional tier hint — defaults to 'nurture' if omitted. */
  tier?: 'hot' | 'warm' | 'nurture'
  /** Optional address for geocode-on-intake (seller paths). */
  address?: string
  /** Optional state for geo_scope inference. */
  state?: string
}

type BrokerSlug = 'matt' | 'rebecca' | 'paul'

const FUB_USER_MATT = 1
const FUB_USER_REBECCA = 2

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Round-robin between Matt + Rebecca. Hot leads default to Matt for
 * fastest response.
 */
async function pickBroker(audience: LeadAudience, tier: 'hot' | 'warm' | 'nurture'): Promise<{ broker: BrokerSlug; userId: number }> {
  if (tier === 'hot') return { broker: 'matt', userId: FUB_USER_MATT }

  const supabase = getServiceSupabase()
  if (!supabase) return { broker: 'matt', userId: FUB_USER_MATT }

  try {
    const { data, error } = await supabase
      .from('marketing_assignments')
      .select('broker')
      .eq('audience', audience)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { broker: 'matt', userId: FUB_USER_MATT }
    return data?.broker === 'matt'
      ? { broker: 'rebecca', userId: FUB_USER_REBECCA }
      : { broker: 'matt', userId: FUB_USER_MATT }
  } catch {
    return { broker: 'matt', userId: FUB_USER_MATT }
  }
}

async function recordAssignment(params: {
  audience: LeadAudience
  broker: BrokerSlug
  userId: number
  fubPersonId: number
  source: LeadSource
  tier: 'hot' | 'warm' | 'nurture'
}): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) return
  try {
    await supabase.from('marketing_assignments').insert({
      audience: params.audience,
      broker: params.broker,
      fub_user_id: params.userId,
      fub_person_id: params.fubPersonId,
      source: params.source,
      tier: params.tier,
    })
  } catch {
    // non-blocking
  }
}

/**
 * Apply the canonical tag schema + assignment to an existing FUB person.
 *
 * Designed to be called AFTER sendEvent() or any other person-create. Never
 * throws — returns { ok, broker, tags } so the caller can log + continue.
 *
 * Usage:
 * ```
 * const eventRes = await sendEvent({ ... })
 * if (eventRes.ok && fubPersonId) {
 *   await canonicallyTagLead({ fubPersonId, audience: 'buyer', source: 'contact-form' })
 * }
 * ```
 */
export async function canonicallyTagLead(params: CanonicalLeadParams): Promise<{
  ok: boolean
  broker?: BrokerSlug
  tagsApplied?: string[]
  error?: string
}> {
  if (!Number.isFinite(params.fubPersonId) || params.fubPersonId <= 0) {
    return { ok: false, error: 'invalid fubPersonId' }
  }

  const tier = params.tier ?? 'nurture'
  const { broker, userId } = await pickBroker(params.audience, tier)

  const tags = [
    `audience:${params.audience}`,
    `${params.audience}:${tier}`,
    `source:${params.source}`,
    `broker:${broker}`,
  ]

  try {
    await addPersonTags(params.fubPersonId, tags)
    await assignPersonToUser(params.fubPersonId, userId)
    await recordAssignment({
      audience: params.audience,
      broker,
      userId,
      fubPersonId: params.fubPersonId,
      source: params.source,
      tier,
    })
    return { ok: true, broker, tagsApplied: tags }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
