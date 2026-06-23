import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { stitchVisitorIdentity } from '@/lib/visitor-backfill'
import {
  evaluateSustainedHotAnonymous,
  type SustainedHotAnonymousSignals,
  type SustainedHotAnonymousThresholds,
} from './isSustainedHotAnonymous'
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
 *      lead (no email/phone yet — this is a behavior-only lead), tagged so it is
 *      queryable + remarketing-addressable, routed to the default broker.
 *   2. Stitches the rr_vid -> known-record link through the EXISTING identity-map
 *      write path (stitchVisitorIdentity), recording identify_source so the
 *      visitor is marked captured and the same upsert-on-rr_vid row is enriched.
 *
 * PHASE 1.1 DEPENDENCY (FLAGGED, load-bearing)
 * --------------------------------------------
 * The durable rr_vid -> crm_person bridge is `visitor_identity_map.crm_person_id`,
 * which is a FLAGGED, NOT-YET-APPLIED Phase 1.1 column. It does NOT exist in the
 * live schema today. This function MUST NOT write it (a write would 400 the
 * upsert). Instead we stitch via stitchVisitorIdentity, which only sets columns
 * that exist today (rr_vid, identify_source, identified_at, and email/fub/user
 * when present). The new crm_people.id is returned + recorded on the person row's
 * own tags so the bridge is reconstructable; once Phase 1.1 lands its migration
 * + backfill (crm_people.fub_legacy_id / rr_vid join), the rr_vid -> crm_person
 * link is materialized as a column and resolvePersonIdentity reads it directly.
 * Until then the link is best-effort via the identity map + the source tag.
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
    .select('email, fub_person_id, user_id')
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
      // The rr_vid -> crm_person bridge column is Phase 1.1 (not yet applied), so
      // there is no existing-crm-person flag to read today. Left null; the
      // already-identified guard above still catches every known-record case.
      existingCrmPersonId: null,
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

  // Create the behavior-only native lead. No email/phone yet — this lead is
  // identified by behavior + the rr_vid bridge, so it carries no crm_contact_points.
  // The source tag makes it queryable; the rr_vid tag carries the bridge until
  // the Phase 1.1 crm_person_id column materializes it as a real FK.
  const tags = [
    `source:${HOT_ANONYMOUS_SOURCE}`,
    'audience:anonymous-hot',
    `rr_vid:${vid}`,
  ]
  let crmPersonId: number
  try {
    const { data: created, error: createError } = await sb
      .from('crm_people')
      .insert({
        name: `Anonymous shopper ${vid.slice(0, 8)}`,
        stage: 'Lead',
        source: HOT_ANONYMOUS_SOURCE,
        assigned_broker: DEFAULT_BROKER,
        tags,
      })
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

  // Stitch the durable rr_vid -> known-record link through the EXISTING identity
  // map write path. This upserts on rr_vid and sets identify_source + identified_at
  // (and never clobbers a previously-captured email/fub/user). It intentionally
  // does NOT write crm_person_id — that column is the FLAGGED Phase 1.1 bridge and
  // does not exist in the live schema yet. stitchVisitorIdentity never throws.
  await stitchVisitorIdentity({
    rrVid: vid,
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
