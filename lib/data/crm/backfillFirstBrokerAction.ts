/**
 * One-shot / periodic backfill of custom.first_broker_action_at from timeline
 * for people created in a window who still lack the stamp (P12 measurement).
 *
 * Safe to re-run: only fills empty stamps; never overwrites.
 *
 * FIRST BROKER ACTION IS A HUMAN'S (SITE-09, Matt 2026-09-07; FUNNEL-5 /
 * TRACK-8, 2026-09-23). The send rails already refuse to stamp for a system
 * initiator, but this backfill took the first outbound row of ANY kind, so the
 * site's own same-minute confirmation became the broker's first action: of the
 * 143 people carrying a stamp at 2026-09-23T02:48Z, 86 were stamped from a
 * machine row (28 contact confirmations, 21 alert confirmations, 36 drip emails,
 * 1 drip text), and the
 * /admin/oversight speed-to-lead read seconds. It now stamps only from the first
 * row that passes isHumanTouch (lib/crm/response-clock.ts), the one definition
 * of a human touch. A person nobody has touched stays unstamped.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { stampFirstBrokerActionIfEmpty } from '@/lib/crm/first-broker-action'
import { HUMAN_TOUCH_KINDS, firstHumanTouchRow, type TimelineRowLike } from '@/lib/crm/response-clock'

/** Outbound rows read per page while looking for the first human one. */
const TOUCH_PAGE = 200
/** Hard stop per person: no one has thousands of outbound rows in 30 days. */
const TOUCH_MAX = 2000

export async function backfillFirstBrokerActionStamps(opts?: {
  /** How far back to look for people missing the stamp. Default 30 days. */
  sinceDays?: number
  limit?: number
}): Promise<{ scanned: number; stamped: number }> {
  const sinceDays = Math.min(Math.max(opts?.sinceDays ?? 30, 1), 180)
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000)
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
  const sb = createServiceClient()

  const { data: people, error } = await sb
    .from('crm_people')
    .select('id, custom')
    .eq('deleted', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`backfill people read: ${error.message}`)

  let stamped = 0
  let scanned = 0
  for (const p of people ?? []) {
    scanned += 1
    const custom = (p.custom as Record<string, unknown> | null) ?? {}
    if (typeof custom.first_broker_action_at === 'string' && custom.first_broker_action_at) continue

    // Oldest first, paged: the human row can sit behind any number of
    // confirmations and drip sends.
    let touch: (TimelineRowLike & { kind: string; ts: string }) | null = null
    for (let offset = 0; offset < TOUCH_MAX && !touch; offset += TOUCH_PAGE) {
      const { data: events, error: tlErr } = await sb
        .from('crm_timeline')
        .select('kind, ts, broker, source, payload')
        .eq('person_id', p.id)
        .in('kind', [...HUMAN_TOUCH_KINDS])
        .order('ts', { ascending: true })
        .range(offset, offset + TOUCH_PAGE - 1)
      if (tlErr || !events?.length) break
      touch = firstHumanTouchRow(events as Array<TimelineRowLike & { kind: string; ts: string }>)
      if (events.length < TOUCH_PAGE) break
    }
    if (!touch) continue

    const ok = await stampFirstBrokerActionIfEmpty(sb, Number(p.id), {
      kind: String(touch.kind),
      at: String(touch.ts),
      broker: (touch.broker as string | null) ?? null,
    })
    if (ok) stamped += 1
  }

  return { scanned, stamped }
}
