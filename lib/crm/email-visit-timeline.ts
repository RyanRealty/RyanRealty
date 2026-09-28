/**
 * A site visit that arrived from an email link, as a crm_timeline row.
 *
 * visitor_sessions.session_id lives in localStorage for weeks, so one session
 * covers many email clicks. Dedupe per (session, campaign, landing path) so a
 * refresh of /sell is a no-op while /reviews in the same session is its own row.
 *
 * Pure decision + a non-blocking write. The track route calls this; a failure
 * never breaks the 200.
 */

export type EmailVisitTimelineInput = {
  eventType: string
  sessionId: string
  pageUrl: string
  utmMedium?: string | null
  utmSource?: string | null
  utmCampaign?: string | null
  personId: number
  broker?: string | null
  /** True only when a verified person token produced identify / already / rotate. */
  tokenVerified: boolean
  automated?: boolean
}

export type EmailVisitTimelineRow = {
  person_id: number
  kind: 'web_event'
  source: 'email-visit'
  broker: string | null
  title: string
  body: string | null
  payload: {
    sessionId: string
    path: string
    utmSource: string | null
    utmCampaign: string | null
    emailKey?: string
    pageUrl: string
  }
  dedupe_key: string
}

function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return null
  }
}

function utmFromUrl(url: string, key: string): string | null {
  try {
    return new URL(url).searchParams.get(key)
  } catch {
    return null
  }
}

function isAdminOrApiPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/') || path === '/api' || path.startsWith('/api/')
}

function isCmaVisit(source: string, campaign: string): boolean {
  const src = source.toLowerCase()
  const camp = campaign.toLowerCase()
  return src === 'cma' || camp.startsWith('cma-')
}

/** Pure: the timeline row to write, or null when this view must not record. */
export function buildEmailVisitTimelineRow(input: EmailVisitTimelineInput): EmailVisitTimelineRow | null {
  if (input.eventType !== 'page_view') return null
  if (!input.tokenVerified) return null
  if (input.automated) return null
  if (!Number.isFinite(input.personId) || input.personId <= 0) return null
  const pageUrl = (input.pageUrl ?? '').trim()
  if (!pageUrl) return null

  const path = pathOf(pageUrl)
  if (!path || isAdminOrApiPath(path)) return null

  const medium = (input.utmMedium || utmFromUrl(pageUrl, 'utm_medium') || '').trim().toLowerCase()
  if (medium !== 'email') return null

  const utmSource = (input.utmSource || utmFromUrl(pageUrl, 'utm_source') || '').trim() || null
  const utmCampaign = (input.utmCampaign || utmFromUrl(pageUrl, 'utm_campaign') || '').trim() || null
  const source = utmSource ?? ''
  const campaign = utmCampaign ?? ''
  const cma = isCmaVisit(source, campaign)
  const from = cma ? 'CMA email' : 'email'
  const title = `Visited ${path} from ${from}`

  return {
    person_id: input.personId,
    kind: 'web_event',
    source: 'email-visit',
    broker: input.broker ?? null,
    title,
    body: null,
    payload: {
      sessionId: input.sessionId,
      path,
      utmSource,
      utmCampaign,
      ...(cma && campaign ? { emailKey: `cma:${campaign}` } : {}),
      pageUrl,
    },
    dedupe_key: `track:email-visit:${input.sessionId}:${campaign}:${path}`,
  }
}

type TimelineWriter = {
  from: (table: string) => {
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => unknown
  }
}

/** Idempotent upsert. Never throws. */
export async function recordEmailVisitTimeline(
  sb: TimelineWriter,
  row: EmailVisitTimelineRow,
): Promise<void> {
  try {
    const result = (await sb.from('crm_timeline').upsert(
      {
        person_id: row.person_id,
        kind: row.kind,
        source: row.source,
        broker: row.broker,
        title: row.title,
        body: row.body,
        payload: row.payload,
        dedupe_key: row.dedupe_key,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )) as { error?: { message?: string } | null } | null
    if (result?.error?.message) console.warn('[email-visit] timeline upsert failed:', result.error.message)
  } catch (e) {
    console.warn('[email-visit] timeline threw:', e instanceof Error ? e.message : e)
  }
}
