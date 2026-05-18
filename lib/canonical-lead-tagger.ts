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
// Rebecca + Paul exist as FUB users (ids 2 + 3) but no auto-route to them
// per Matt's 2026-05-17 directive. Manual reassignment via FUB UI only.

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Broker assignment — ALL inbound leads route to Matt.
 *
 * Per Matt's 2026-05-17 directive: "no round robin. I will get all listings
 * and leads." Round-robin code was previously here; removed. Rebecca remains
 * in the FUB "Seller Leads" group and can have leads manually reassigned via
 * the FUB UI, but every NEW LP / contact-form / FB-ad submission auto-routes
 * to Matt.
 *
 * If the policy ever changes, restore the round-robin lookup against the
 * marketing_assignments ledger here. The ledger keeps recording every
 * assignment for audit + future flexibility.
 */
async function pickBroker(_audience: LeadAudience, _tier: 'hot' | 'warm' | 'nurture'): Promise<{ broker: BrokerSlug; userId: number }> {
  return { broker: 'matt', userId: FUB_USER_MATT }
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
 * Compliance / audience-exclusion check: if the person carries any hard-stop
 * tag we MUST NOT enroll them in any auto-touch workflow. Three categories:
 *
 *   1. Compliance / opt-out (sender reputation):
 *      do_not_email, do_not_text, compliance:hard-stop, bounced, unsubscribed,
 *      complained
 *
 *   2. Industry contacts (fellow realtors — NEVER drip these):
 *      realtor, real estate, real estate agent, industry:realtor
 *      Per Matt's 2026-05-17 directive: realtors who carry the Realtor tag
 *      (2,316 records as of audit) are competitors / industry contacts.
 *      They should never receive our seller/buyer drip emails.
 *
 *   3. Test pollution (defense-in-depth — we deleted obvious tests but new
 *      ones may show up):
 *      test record - delete, test-delete-me
 *
 * Per docs/FUB_OPTIMIZATION_AUDIT_2026-05-17 §7 + Matt 2026-05-17 realtor
 * directive. Tagging them `audience:seller` or `audience:buyer` would
 * trigger the FUB automation rule which would enroll them in the master
 * workflow and start blasting emails. The action plans themselves should
 * ALSO exclude these tags (Matt configures the audience filter in FUB UI),
 * but the belt-and-suspenders approach is to skip applying the canonical
 * audience tag in the first place.
 */
const HARD_STOP_TAGS = new Set([
  // Compliance / opt-out
  'do_not_email',
  'do_not_text',
  'compliance:hard-stop',
  'bounced',
  'unsubscribed',
  'complained',
  // Industry contacts — realtors / fellow brokers / agents
  'realtor',
  'real estate',
  'real estate agent',
  'real-estate-agent',
  'industry:realtor',
  // Test pollution
  'test record - delete',
  'test-delete-me',
])

export async function isHardStopped(personId: number): Promise<boolean> {
  try {
    const url = `https://api.followupboss.com/v1/people/${personId}?fields=id,tags`
    const key = process.env.FOLLOWUPBOSS_API_KEY?.trim()
    if (!key) return false
    const auth = Buffer.from(`${key}:`).toString('base64')
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store' })
    if (!res.ok) return false
    const p = (await res.json()) as { tags?: string[] }
    const lowerTags = (p.tags ?? []).map((t) => t.toLowerCase())
    return lowerTags.some((t) => HARD_STOP_TAGS.has(t))
  } catch {
    return false  // fail-open: don't block enrollment on a network blip
  }
}

/**
 * Apply the canonical tag schema + assignment to an existing FUB person.
 *
 * Designed to be called AFTER sendEvent() or any other person-create. Never
 * throws — returns { ok, broker, tags } so the caller can log + continue.
 *
 * Skips enrollment if the person carries a compliance hard-stop tag
 * (do_not_email, Bounced, Unsubscribed, compliance:hard-stop, etc.).
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
  skipped?: 'compliance-hard-stop'
}> {
  if (!Number.isFinite(params.fubPersonId) || params.fubPersonId <= 0) {
    return { ok: false, error: 'invalid fubPersonId' }
  }

  // Compliance check — skip enrollment if hard-stopped
  if (await isHardStopped(params.fubPersonId)) {
    console.warn(`[canonical-lead-tagger] Skipping enrollment for person ${params.fubPersonId}: compliance hard-stop tag present`)
    return { ok: false, skipped: 'compliance-hard-stop' }
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
