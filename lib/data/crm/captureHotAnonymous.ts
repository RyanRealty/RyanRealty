import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { stitchVisitorIdentity } from '@/lib/visitor-backfill'
import {
  evaluateSustainedHotAnonymous,
  type SustainedHotAnonymousSignals,
  type SustainedHotAnonymousThresholds,
} from './isSustainedHotAnonymous'
import { buildNativePersonRow } from './nativeCreate'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * captureHotAnonymous — convert a SUSTAINED HOT ANONYMOUS visitor into a durable
 * tracked record (CONTACT360 Phase 0.3).
 *
 * Today a hot anonymous visitor only triggers an alert email + sets
 * hot_lead_fired_at (app/api/cron/visitor-hot-lead-escalation/route.ts); nothing
 * durable is written, so a high-intent shopper who never submits a form is lost
 * the moment their cookie clears. This DAL closes that leak: given a durable
 * visitor (an rr_vid), it reads the visitor's signals, runs the PURE
 * isSustainedHotAnonymous rule, and on a qualify:
 *
 *   1. Creates ONE native crm_people { source:'hot-anonymous', stage:'Lead' }
 *      lead via buildNativePersonRow — the canonical native-create chokepoint,
 *      which stamps the inbound entry stage (G3) and the source tag. No email/phone yet —
 *      this is a behavior-only lead, tagged so it is queryable +
 *      remarketing-addressable, routed to the default broker.
 *   2. Stitches the rr_vid -> known-record link through the EXISTING identity-map
 *      write path (stitchVisitorIdentity), recording identify_source so the
 *      visitor is marked captured and the same upsert-on-rr_vid row is enriched.
 *
 * The durable rr_vid -> crm_person bridge is `visitor_identity_map.crm_person_id`
 * (live column). stitchVisitorIdentity writes it in lockstep with the legacy person column
 * using the native crm_people.id created above.
 *
 * Idempotent on the identity side: stitchVisitorIdentity upserts on rr_vid, and
 * we re-read the latest identity before creating so a second run for a now-known
 * visitor is a no-op. The rule's already-identified guard is the primary defense.
 *
 * DAL boundary (G1): every raw .from() read/write lives here, inside lib/data/.
 */

/** crm_people.source stamped on a behavior-only anonymous-hot lead. */
export const HOT_ANONYMOUS_SOURCE = 'hot-anonymous'

/** Default-broker rule for an unstaffed anonymous-hot lead (routes to Matt). */
const DEFAULT_BROKER: CrmBrokerSlug = 'matt'

export type CaptureHotAnonymousResult =
  /** The rule did not fire; nothing written. `reason` explains why (for logs). */
  | { status: 'skipped'; reason: string }
  /** A tracked lead already existed for this visitor; nothing created. */
  | { status: 'already_tracked'; crmPersonId: number }
  /** A new behavior-only lead was created + the identity map stitched. */
  | { status: 'created'; crmPersonId: number; listingViewsInWindow: number; distinctSessionsInWindow: number }

type SessionRow = {
  session_id: string
  identified_at: string | null
  fub_person_id: number | null
}

type IdentityMapRow = {
  email: string | null
  fub_person_id: number | null
  crm_person_id: number | null
  user_id: string | null
}

/**
 * Read every signal for one durable visitor (by rr_vid) and assemble the rule's
 * input bundle. Returns null when the visitor has no sessions at all (nothing to
 * evaluate). The identity bundle unions the identity-map row (rr_vid keyed) with
 * any identified_at / fub_person_id stamped on the visitor's sessions, so a
 * visitor who identified via either path is correctly seen as already-tracked.
 */
async function loadSignalsByRrVid(
  rrVid: string,
): Promise<{ signals: SustainedHotAnonymousSignals; sessionIds: string[] } | null> {
  const sb = createServiceClient()

  // Sessions tied to this durable visitor.
  const { data: sessionRows } = await sb
    .from('visitor_sessions')
    .select('session_id, identified_at, fub_person_id')
    .eq('rr_vid', rrVid)
    .limit(500)
  const sessions = (sessionRows ?? []) as SessionRow[]
  const sessionIds = sessions.map((s) => s.session_id).filter(Boolean)
  if (sessionIds.length === 0) return null

  // The identity-map row for this visitor (rr_vid is its PK). Yields a captured
  // email / fub person / auth user if the visitor was ever stitched.
  const { data: idmapRow } = await sb
    .from('visitor_identity_map')
    .select('email, fub_person_id, crm_person_id, user_id')
    .eq('rr_vid', rrVid)
    .maybeSingle()
  const idmap = (idmapRow ?? null) as IdentityMapRow | null

  // listing_view events across the visitor's sessions.
  const { data: eventRows } = await sb
    .from('visitor_events')
    .select('session_id, event_at')
    .in('session_id', sessionIds)
    .eq('event_type', 'listing_view')
    .order('event_at', { ascending: false })
    .limit(1000)

  const listingViewEvents = (eventRows ?? []).map((e) => ({
    sessionId: String(e.session_id),
    eventAt: String(e.event_at),
  }))

  // Identity flags: any session marked identified, OR any captured map signal.
  const sessionIdentifiedAt = sessions.map((s) => s.identified_at).find((v): v is string => !!v) ?? null
  const sessionFubPersonId = sessions.map((s) => s.fub_person_id).find((v): v is number => typeof v === 'number' && v > 0) ?? null

  const signals: SustainedHotAnonymousSignals = {
    listingViewEvents,
    identity: {
      identifiedAt: sessionIdentifiedAt,
      fubPersonId: idmap?.fub_person_id ?? sessionFubPersonId,
      email: idmap?.email ?? null,
      authUserId: idmap?.user_id ?? null,
      existingCrmPersonId: idmap?.crm_person_id ?? null,
    },
  }

  return { signals, sessionIds }
}

/**
 * Evaluate one durable visitor (rr_vid) and, on a qualify, create a tracked
 * behavior-only lead + stitch the identity map. Never throws on a DB hiccup — it
 * logs and returns a structured result so a cron tick can keep processing the
 * rest of the batch.
 *
 * @param rrVid       the durable first-party visitor id (visitor_sessions.rr_vid)
 * @param overrides   threshold overrides (tuning without a deploy)
 * @param now         injectable clock for the recency window (tests)
 */
export async function captureHotAnonymous(
  rrVid: string,
  overrides: Partial<SustainedHotAnonymousThresholds> = {},
  now: Date = new Date(),
): Promise<CaptureHotAnonymousResult> {
  const vid = String(rrVid ?? '').trim()
  if (!vid) return { status: 'skipped', reason: 'missing_rr_vid' }

  let loaded: Awaited<ReturnType<typeof loadSignalsByRrVid>>
  try {
    loaded = await loadSignalsByRrVid(vid)
  } catch (e) {
    console.warn('[captureHotAnonymous] signal load failed:', e instanceof Error ? e.message : String(e))
    return { status: 'skipped', reason: 'signal_load_failed' }
  }
  if (!loaded) return { status: 'skipped', reason: 'no_sessions' }

  const evaluation = evaluateSustainedHotAnonymous(loaded.signals, overrides, now)
  if (evaluation.alreadyIdentified) {
    return { status: 'skipped', reason: 'already_identified' }
  }
  if (!evaluation.qualifies) {
    return { status: 'skipped', reason: 'below_threshold' }
  }

  const sb = createServiceClient()

  // Create the behavior-only native lead through the canonical builder so it
  // satisfies the native-create contract (stage 'Lead' — inbound entry; Nurture
  // is earned by sequence-enroll or first-outbound). No email/phone yet — this
  // lead is identified by behavior + the rr_vid bridge, so it carries no
  // crm_contact_points. buildNativePersonRow stamps the source:<x> tag. The
  // identity-map crm_person_id write below is the durable rr_vid bridge.
  const personRow = buildNativePersonRow({
    name: `Anonymous shopper ${vid.slice(0, 8)}`,
    first_name: null,
    last_name: null,
    source: HOT_ANONYMOUS_SOURCE,
    assignedBroker: DEFAULT_BROKER,
    tags: ['audience:anonymous-hot', `rr_vid:${vid}`],
  })
  let crmPersonId: number
  try {
    const { data: created, error: createError } = await sb
      .from('crm_people')
      .insert(personRow)
      .select('id')
      .single()
    if (createError || !created) {
      console.warn('[captureHotAnonymous] crm_people insert failed:', createError?.message)
      return { status: 'skipped', reason: 'create_failed' }
    }
    crmPersonId = created.id as number
  } catch (e) {
    console.warn('[captureHotAnonymous] crm_people insert threw:', e instanceof Error ? e.message : String(e))
    return { status: 'skipped', reason: 'create_failed' }
  }

  // Stitch the durable rr_vid -> known-record link, including crm_person_id.
  await stitchVisitorIdentity({
    rrVid: vid,
    fubPersonId: crmPersonId,
    sessionId: loaded.sessionIds[0] ?? null,
    source: HOT_ANONYMOUS_SOURCE,
  })

  return {
    status: 'created',
    crmPersonId,
    listingViewsInWindow: evaluation.listingViewsInWindow,
    distinctSessionsInWindow: evaluation.distinctSessionsInWindow,
  }
}
