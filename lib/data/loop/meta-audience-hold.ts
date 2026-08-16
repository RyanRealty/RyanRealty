/**
 * Meta audience 7-day hold (INT-007 / G11).
 * Packet + heartbeat + /admin/audiences read this — not a second query.
 * reachability: collectCompanyScoreboardSignals, loop-health-check, admin audiences
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** CRM custom audience written by /api/cron/meta-audience-sync (daily 09:00 UTC). */
export const CRM_AUDIENCE_ID = '120246504502300698'
/** West Side parcel audience written by /api/cron/meta-westside-audience (daily 14:00 UTC). */
export const WESTSIDE_AUDIENCE_ID = '120244510092910698'

/** First named green run in the G11 contract. */
export const META_AUDIENCE_HOLD_START = '2026-08-15'
/** Accept: consecutive streak must end on or after this UTC day. */
export const META_AUDIENCE_HOLD_END = '2026-08-22'
export const META_AUDIENCE_HOLD_DAYS = 7
/** Daily crons (09:00 CRM, 14:00 westside). 36h = cadence + slack. */
export const META_AUDIENCE_CURRENT_HOURS = 36

export type AudienceLogRow = {
  ran_at: string
  audience_id?: string | null
  dry_run?: boolean | null
}

export type MetaAudienceHold = {
  status: 'ok' | 'unreadable'
  rowCount: number
  lastRanAt: string | null
  firstRanAt: string | null
  consecutiveDays: number
  days: string[]
  lastDay: string | null
  holdMet: boolean
  current: boolean
  ageHours: number | null
  source: string
}

const SOURCE =
  'meta_audience_log.ran_at via computeAudienceHold (UTC days; hold = 7 consecutive ending ≥ 2026-08-22)'

export function utcDay(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toISOString().slice(0, 10)
}

export function ageHoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return (now.getTime() - t) / 3_600_000
}

export function isMetaAudienceCurrent(ageHours: number | null): boolean {
  return ageHours != null && ageHours < META_AUDIENCE_CURRENT_HOURS
}

function consecutiveUtcDays(daysAsc: string[]): number {
  if (daysAsc.length === 0) return 0
  let n = 1
  for (let i = daysAsc.length - 1; i > 0; i--) {
    const cur = Date.parse(`${daysAsc[i]}T00:00:00Z`)
    const prev = Date.parse(`${daysAsc[i - 1]}T00:00:00Z`)
    if (cur - prev === 86_400_000) n += 1
    else break
  }
  return n
}

export function computeAudienceHold(rows: AudienceLogRow[], now: Date = new Date()): MetaAudienceHold {
  const dated = rows
    .map((r) => ({ ...r, day: utcDay(r.ran_at) }))
    .filter((r) => r.day.length === 10)
    .sort((a, b) => Date.parse(a.ran_at) - Date.parse(b.ran_at))
  const days = [...new Set(dated.map((r) => r.day))]
  const lastRanAt = dated.length ? dated[dated.length - 1].ran_at : null
  const firstRanAt = dated.length ? dated[0].ran_at : null
  const lastDay = days.length ? days[days.length - 1] : null
  const consecutiveDays = consecutiveUtcDays(days)
  const ageHours = ageHoursSince(lastRanAt, now)
  const holdMet =
    consecutiveDays >= META_AUDIENCE_HOLD_DAYS && lastDay != null && lastDay >= META_AUDIENCE_HOLD_END
  return {
    status: 'ok',
    rowCount: rows.length,
    lastRanAt,
    firstRanAt,
    consecutiveDays,
    days,
    lastDay,
    holdMet,
    current: isMetaAudienceCurrent(ageHours),
    ageHours,
    source: SOURCE,
  }
}

const UNREAD: MetaAudienceHold = {
  status: 'unreadable',
  rowCount: 0,
  lastRanAt: null,
  firstRanAt: null,
  consecutiveDays: 0,
  days: [],
  lastDay: null,
  holdMet: false,
  current: false,
  ageHours: null,
  source: SOURCE,
}

export async function readMetaAudienceHold(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<MetaAudienceHold> {
  const { data, error } = await sb
    .from('meta_audience_log')
    .select('ran_at,audience_id,dry_run')
    .order('ran_at', { ascending: false })
    .limit(200)
  if (error) return { ...UNREAD }
  return computeAudienceHold((data ?? []) as AudienceLogRow[], now)
}
