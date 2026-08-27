import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { classifyChannel, originLabel, type ChannelGroup, type SessionSignals } from './channel-grouping'

/**
 * Lead sources — which channels produce people, not just pageviews.
 *
 * WHY THIS EXISTS. /admin/analytics "Acquisition" reads GA4, and GA4 cannot
 * answer this: 99.5% of visitors never answer the cookie banner, so Consent
 * Mode sends a cookieless ping carrying no traffic source. Measured 2026-08-26,
 * GA4 reported `(not set)` for 15,188 of ~15,600 sessions. No GA4 setting fixes
 * that — a denied-consent ping is not allowed to carry the source.
 *
 * `visitor_sessions` does have it, because a referrer and a campaign tag
 * describe the LINK, not the person, and are recorded at every consent tier.
 *
 * FIRST TOUCH, NOT LAST. A person is credited to the channel that brought them
 * the FIRST time. Last-touch flatters whatever sits closest to the form and
 * would credit "Direct" for people that social or a mailer actually earned.
 *
 * DERIVED, NOT STAMPED. Attribution is computed from sessions rather than
 * copied onto the person, so there is one source of truth. A copied value is
 * correct the day it is written and silently wrong afterwards.
 *
 * HONEST COVERAGE. The result always reports how many people could NOT be
 * attributed. A lead-source report that quietly drops what it cannot explain is
 * how a channel gets defunded for someone else's missing data.
 */

export type LeadSourceRow = {
  channel: ChannelGroup
  /** Sessions that started in this channel inside the window. */
  sessions: number
  /** Sessions that resolved to a known person. */
  identifiedSessions: number
  /** Distinct people whose FIRST EVER touch was this channel. */
  people: number
  /** Of those people, how many are still an open lead vs converted. */
  topOrigins: Array<{ origin: string; sessions: number }>
}

export type LeadSourceReport = {
  rangeStart: string
  rangeEnd: string
  rows: LeadSourceRow[]
  totals: {
    sessions: number
    identifiedSessions: number
    attributedPeople: number
    /** People created in the window we could NOT tie to any session. */
    unattributedPeople: number
    /** The ceiling: sessions we could never attribute because nobody consented. */
    directSessions: number
  }
  /** Set when something upstream is broken enough that the numbers would mislead. */
  warnings: string[]
}

type SessionRow = {
  session_id: string
  crm_person_id: number | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  fbclid: string | null
  first_seen_at: string
}

const PAGE = 1000

/** PostgREST caps a select at 1000 rows; this window routinely exceeds it. */
async function readAllSessions(startIso: string, endIso: string): Promise<SessionRow[]> {
  const sb = createServiceClient()
  const out: SessionRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('visitor_sessions')
      .select('session_id,crm_person_id,referrer,utm_source,utm_medium,utm_campaign,fbclid,first_seen_at')
      .gte('first_seen_at', startIso)
      .lte('first_seen_at', endIso)
      // .order() is not optional — an unordered range() reshuffles between
      // requests and silently drops rows.
      .order('first_seen_at', { ascending: true })
      .order('session_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`visitor_sessions read failed: ${error.message}`)
    const page = (data ?? []) as SessionRow[]
    out.push(...page)
    if (page.length < PAGE) break
  }
  return out
}

function signalsOf(r: SessionRow): SessionSignals {
  return {
    referrer: r.referrer,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    fbclid: r.fbclid,
  }
}

export async function getLeadSources(startIso: string, endIso: string): Promise<LeadSourceReport> {
  const sb = createServiceClient()
  const sessions = await readAllSessions(startIso, endIso)

  const byChannel = new Map<
    ChannelGroup,
    { sessions: number; identified: number; people: Set<number>; origins: Map<string, number> }
  >()
  // A person is credited to their EARLIEST session in the window, so a returning
  // visitor does not get counted under whatever they touched most recently.
  const firstTouchByPerson = new Map<number, { at: string; channel: ChannelGroup }>()

  for (const r of sessions) {
    const channel = classifyChannel(signalsOf(r))
    const bucket = byChannel.get(channel) ?? {
      sessions: 0,
      identified: 0,
      people: new Set<number>(),
      origins: new Map<string, number>(),
    }
    bucket.sessions += 1
    const origin = originLabel(signalsOf(r))
    bucket.origins.set(origin, (bucket.origins.get(origin) ?? 0) + 1)
    if (r.crm_person_id) {
      bucket.identified += 1
      const prior = firstTouchByPerson.get(r.crm_person_id)
      if (!prior || r.first_seen_at < prior.at) {
        firstTouchByPerson.set(r.crm_person_id, { at: r.first_seen_at, channel })
      }
    }
    byChannel.set(channel, bucket)
  }

  for (const [personId, touch] of firstTouchByPerson) {
    byChannel.get(touch.channel)?.people.add(personId)
  }

  const rows: LeadSourceRow[] = [...byChannel.entries()]
    .map(([channel, b]) => ({
      channel,
      sessions: b.sessions,
      identifiedSessions: b.identified,
      people: b.people.size,
      topOrigins: [...b.origins.entries()]
        .map(([origin, n]) => ({ origin, sessions: n }))
        .sort((x, y) => y.sessions - x.sessions)
        .slice(0, 5),
    }))
    .sort((a, b) => b.people - a.people || b.sessions - a.sessions)

  // People created in the window that no session explains. This is the number
  // that says how much of the book the web cannot account for.
  const { count: createdCount, error: createdErr } = await sb
    .from('crm_people')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startIso)
    .lte('created_at', endIso)
  if (createdErr) throw new Error(`crm_people count failed: ${createdErr.message}`)

  const attributedPeople = firstTouchByPerson.size
  const totalSessions = sessions.length
  const identifiedSessions = sessions.filter((r) => r.crm_person_id).length
  const directSessions = byChannel.get('Direct')?.sessions ?? 0

  const warnings: string[] = []
  if (totalSessions > 0 && identifiedSessions / totalSessions < 0.01) {
    warnings.push(
      `Only ${identifiedSessions} of ${totalSessions} sessions resolve to a known person, so per-channel LEAD counts are a floor, not a total. ` +
        `Every link in an outbound email or text now stamps the recipient, which is what raises this.`,
    )
  }
  if (totalSessions > 0 && directSessions / totalSessions > 0.5) {
    warnings.push(
      `${Math.round((directSessions / totalSessions) * 100)}% of sessions arrive with no referrer and no campaign tag. ` +
        `A browser withholding the referrer is indistinguishable from a genuine direct visit; neither can be recovered after the fact. ` +
        `Tagging every link we publish is the only thing that moves this.`,
    )
  }

  return {
    rangeStart: startIso,
    rangeEnd: endIso,
    rows,
    totals: {
      sessions: totalSessions,
      identifiedSessions,
      attributedPeople,
      unattributedPeople: Math.max(0, (createdCount ?? 0) - attributedPeople),
      directSessions,
    },
    warnings,
  }
}
