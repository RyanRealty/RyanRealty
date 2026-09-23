/**
 * Known-contact site activity: the pure shaping behind "who has been on the
 * site, and what exactly did they look at" (P7 identity loop, Matt 2026-09-23).
 *
 * Read by lib/data/crm/getSiteActivity.ts for /admin/visitors/live?filter=people
 * and the CRM person page. Pure so the rules below are unit-tested:
 *
 *   VISIT   a run of one browser session's events with no gap over 30 minutes
 *           (GA4's default session timeout; the same number the tracker uses
 *           for the GA4 visit id).
 *   TIME ON PAGE  the gap from a page view to the NEXT page view in the same
 *           visit. The last page of a visit has no next view, so its time is the
 *           gap to the last in-page event (scroll, section, click) when there is
 *           one, else unknown. This is the standard web-analytics definition; an
 *           exit page is not guessed at.
 *   SOURCE  how the visit arrived: the campaign params on its first page URL
 *           (stored with identity params already stripped), else, for the
 *           browser's first visit, the session's recorded first touch; a later
 *           visit with neither is a return visit.
 *
 *   SCRIPTED CONTACT  a person the intake screen (lib/crm/lead-quality.ts,
 *           p06) tagged quality:suspect is left off the Known people list, so
 *           the list is people, not form bots (see isSuspectContact).
 *
 * No I/O. Never throws on odd rows.
 */
import { listingMlsFromPath } from '@/lib/analytics/page-type'
import {
  QUALITY_SIGNAL_TAG_PREFIX,
  classifyLeadQuality,
  hasSuspectTag,
} from '@/lib/crm/lead-quality'
import { isPlaceholderLeadName, primaryValue } from '@/lib/crm/merge'

/**
 * Is this contact a scripted form submit rather than a person? The Known
 * people list leaves these out: in the 30 days to 2026-09-23 the form_submit
 * path identified 101 people and the p06 screen flagged 69 of 92 site-door
 * contacts as scripted (lib/crm/lead-quality.ts header), so without this the
 * list Matt reads first would be mostly bots.
 *
 *   1. quality:suspect tag            -> suspect (the intake screen's verdict)
 *   2. a quality:signal:* tag but no quality:suspect -> NOT suspect: the screen
 *      flagged it and a broker removed the flag, and the broker's call stands
 *   3. never screened (created before the screen): the same classifier on the
 *      stored name and primary email that the sequence engine's belt runs
 *      (app/api/cron/crm-sequence-engine/helpers.ts looksSuspect)
 */
export function isSuspectContact(person: {
  tags?: unknown
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  emails?: unknown
}): boolean {
  const tags = Array.isArray(person.tags) ? person.tags : []
  if (hasSuspectTag(tags)) return true
  if (tags.some((t) => typeof t === 'string' && t.startsWith(QUALITY_SIGNAL_TAG_PREFIX))) return false
  const typed =
    [person.first_name, person.last_name].filter((s) => typeof s === 'string' && s.trim()).join(' ').trim() ||
    (isPlaceholderLeadName(person.name) ? '' : String(person.name ?? '').trim())
  return classifyLeadQuality({ name: typed, email: primaryValue(person.emails) }).suspect
}

export const VISIT_GAP_MS = 30 * 60 * 1000
const VIEW_TYPES = new Set(['page_view', 'listing_view'])

export type ActivityEventRow = {
  sessionId: string
  at: string
  type: string
  url: string
  title: string | null
  listingMls: string | null
}

export type ActivitySessionRow = {
  sessionId: string
  firstSeenAt: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrer: string | null
  identifiedVia: string | null
}

export type ActivityPage = {
  at: string
  title: string
  path: string
  url: string
  /** MLS number when this was a listing page (from the event or the URL). */
  listingMls: string | null
  /** Seconds on the page, or null when it was the exit page with no later signal. */
  secondsOnPage: number | null
}

export type ActivityVisit = {
  sessionId: string
  startedAt: string
  endedAt: string
  source: string
  pages: ActivityPage[]
}

function ms(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname || '/'
  } catch {
    return url.split('?')[0] || '/'
  }
}

/** "Contact · Call, text… | Ryan Realty — Central Oregon" -> "Contact · Call, text…". */
export function cleanPageTitle(title: string | null | undefined, path: string): string {
  const raw = (title ?? '').trim()
  const cut = raw.replace(/\s*\|\s*Ryan Realty\b.*$/i, '').trim()
  if (cut) return cut.length > 120 ? `${cut.slice(0, 117)}…` : cut
  return path === '/' ? 'Home' : path
}

function param(url: string, key: string): string | null {
  try {
    const v = new URL(url).searchParams.get(key)
    return v && v.trim() ? v.trim().toLowerCase() : null
  } catch {
    return null
  }
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Human label for a source/medium/campaign triple. */
export function sourceLabel(source: string | null, medium: string | null, campaign: string | null, referrerHost?: string | null): string {
  const s = (source ?? '').toLowerCase()
  const m = (medium ?? '').toLowerCase()
  const c = (campaign ?? '').toLowerCase()
  if (m === 'sms') return 'Text from us'
  if (m === 'personal-link') return 'Personal link from a broker'
  if (s === 'cma' || m === 'document' || c.startsWith('cma-')) return 'CMA document'
  if (c.includes('newsletter') || s === 'newsletter') return 'Newsletter'
  if (c.includes('listing-alert') || c.includes('alert')) return 'Listing alert email'
  if (c.includes('market-report')) return 'Market report email'
  if (m === 'email' || s === 'crm') return 'Email from us'
  if (s === 'gbp') return 'Google Business Profile'
  if (m === 'cpc' || m === 'paid' || m === 'paid_social') return `Paid ad (${source ?? 'unknown'})`
  if (s === 'google' && m === 'organic') return 'Google search'
  if (m === 'organic') return `Search (${source})`
  if (s === 'facebook' || s === 'instagram') return `${s === 'facebook' ? 'Facebook' : 'Instagram'}`
  if (s.includes('chatgpt') || s.includes('perplexity') || s.includes('claude') || s.includes('gemini')) return `AI assistant (${source})`
  if (m === 'referral' && s) return `Referral from ${source}`
  if (s && s !== 'direct') return medium && medium !== 'none' ? `${source} / ${medium}` : String(source)
  if (referrerHost) return `Referral from ${referrerHost}`
  return 'Direct or bookmark'
}

/** Source for one visit: its landing URL's params, else the session first touch (first visit only). */
export function visitSource(firstUrl: string, session: ActivitySessionRow | undefined, isFirstVisitOfSession: boolean): string {
  const s = param(firstUrl, 'utm_source')
  const m = param(firstUrl, 'utm_medium')
  const c = param(firstUrl, 'utm_campaign')
  if (param(firstUrl, 'gclid')) return 'Paid ad (Google)'
  if (param(firstUrl, 'fbclid')) return 'Paid ad (Meta)'
  if (s || m || c) return sourceLabel(s, m, c)
  if (isFirstVisitOfSession && session) {
    return sourceLabel(session.utmSource, session.utmMedium, session.utmCampaign, hostOf(session.referrer))
  }
  return 'Came back on their own'
}

/**
 * Group events into visits (per session, 30-minute gap), compute time on page,
 * label each visit's source. Returns visits newest first, pages newest first.
 */
export function buildVisits(events: ActivityEventRow[], sessions: ActivitySessionRow[]): ActivityVisit[] {
  const bySession = new Map<string, ActivityEventRow[]>()
  for (const e of events) {
    if (!e || !e.sessionId || !e.at) continue
    const list = bySession.get(e.sessionId) ?? []
    list.push(e)
    bySession.set(e.sessionId, list)
  }
  const sessionById = new Map(sessions.map((s) => [s.sessionId, s]))
  const visits: ActivityVisit[] = []

  for (const [sessionId, list] of bySession) {
    list.sort((a, b) => ms(a.at) - ms(b.at))
    const session = sessionById.get(sessionId)
    const sessionStart = session?.firstSeenAt ? ms(session.firstSeenAt) : null

    // Split into visits on a >30-minute gap.
    const groups: ActivityEventRow[][] = []
    let current: ActivityEventRow[] = []
    for (const e of list) {
      const prev = current[current.length - 1]
      if (prev && ms(e.at) - ms(prev.at) > VISIT_GAP_MS) {
        groups.push(current)
        current = []
      }
      current.push(e)
    }
    if (current.length) groups.push(current)

    for (const g of groups) {
      const views = g.filter((e) => VIEW_TYPES.has(e.type))
      if (views.length === 0) continue
      const pages: ActivityPage[] = views.map((v, i) => {
        const next = views[i + 1]
        let seconds: number | null = null
        if (next) {
          seconds = Math.max(0, Math.round((ms(next.at) - ms(v.at)) / 1000))
        } else {
          const later = g.filter((e) => !VIEW_TYPES.has(e.type) && ms(e.at) > ms(v.at))
          const last = later[later.length - 1]
          if (last) seconds = Math.max(0, Math.round((ms(last.at) - ms(v.at)) / 1000))
        }
        const path = pathOf(v.url)
        return {
          at: v.at,
          title: cleanPageTitle(v.title, path),
          path,
          url: v.url,
          listingMls: v.listingMls ?? listingMlsFromPath(path),
          secondsOnPage: seconds,
        }
      })
      // The browser's first visit is the one that starts at (or within a
      // minute of) the session's first_seen_at.
      const isFirst = sessionStart == null ? groups[0] === g : Math.abs(ms(g[0].at) - sessionStart) < 60_000
      visits.push({
        sessionId,
        startedAt: g[0].at,
        endedAt: g[g.length - 1].at,
        source: visitSource(views[0].url, session, isFirst),
        pages: pages.reverse(),
      })
    }
  }
  visits.sort((a, b) => ms(b.startedAt) - ms(a.startedAt))
  return visits
}

const TRACKED_LINK_LABEL: Record<string, string> = {
  email: 'clicked an email we sent',
  sequence: 'clicked a follow-up email or text',
  newsletter: 'clicked the newsletter',
  alert: 'clicked a listing alert',
  report: 'clicked a market report',
  document: 'opened a CMA or report link',
  sms: 'clicked a text we sent',
  prospecting: 'clicked a prospecting message',
  personal: 'clicked their personal link',
  cookie: 'came back on a known browser',
}

/** Plain words for visitor_sessions.identified_via. */
export function identifiedViaLabel(via: string | null | undefined): string {
  const v = (via ?? '').trim()
  if (!v) return 'identified'
  if (v.startsWith('tracked_link:')) return TRACKED_LINK_LABEL[v.slice('tracked_link:'.length)] ?? 'clicked a link we sent'
  switch (v) {
    case 'email_click_pid':
    case 'email_click_fuid':
      return 'clicked an email we sent'
    case 'form_submit':
      return 'filled in a form'
    case 'rr_vid_carryover':
    case 'rr_pid_cookie':
      return 'came back on a known browser'
    case 'google':
    case 'auth_oauth':
      return 'signed in with Google'
    case 'facebook':
      return 'signed in with Facebook'
    case 'auth_email':
    case 'auth_recovery':
    case 'magic_link':
    case 'auth_session':
      return 'signed in'
    case 'hot-anonymous':
      return 'captured as a hot visitor'
    default:
      return v.replace(/[_:-]+/g, ' ')
  }
}

/** "45s", "3m 10s", "1h 2m"; null -> "exit page". */
export function formatSecondsOnPage(seconds: number | null): string {
  if (seconds == null) return 'exit page'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
