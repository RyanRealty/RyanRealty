import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { getNewsletter, type NewsletterRow } from '@/lib/data/newsletter'
import {
  builtFromOrAfter,
  editionBuildStamp,
  editionEmailMonth,
  isLiveEditionEmailMarker,
} from '@/lib/market-report/edition-email-marker'

/**
 * The issue a broker's one-click "send the newsletter" delivers, and the one
 * the send panel names before it sends: the current issue Matt approved.
 *
 * Approved means it went out to the subscriber list (sent, or sending now,
 * with list_send: a one-off test to a few inboxes does not count) or he
 * scheduled it, and it is not paused (a send he or the deliverability breaker
 * paused is on hold). A draft never qualifies, whoever wrote it: the monthly
 * Bend Brief and the monthly market report email draft themselves for his
 * per-issue approval, the admin Generate button writes one under his name,
 * and none of them is the brokerage's message until he approves it
 * (CLAUDE.md §1; Matt 2026-09-30 on the report email: nothing goes to anyone
 * until he approves that send). Before 2026-09-30 this fell back to the
 * newest draft, and the newest "sent" issue was a July integration-test probe.
 *
 * A monthly market report email qualifies only while its report is still the
 * build its figures came from (every citation's fetched_at against the
 * edition's generated_at, lib/market-report/edition-email-marker.ts): once the
 * report is republished, an email that already went out keeps the figures it
 * was sent with, so it is not sent again to someone new. Its open draft is
 * replaced or re-stamped by the draft writer (lib/market-report/edition-email-draft.ts).
 *
 * Current means it went out in the last CURRENT_DAYS: both issues are
 * monthly (the Bend Brief on the 1st, the market report on the 8th), and an
 * older one carries last season's figures. The newest send leads (by when it
 * started), so an issue still going out outranks last month's. With nothing
 * current, the next scheduled issue. On 2026-09-30 that is none: the only
 * sent issues are three July 2026 Bend Brief sends to Matt's own inboxes and
 * one contact, one-offs all.
 *
 * One selection for the send action (app/actions/contact-newsletter.ts, which
 * loads the whole row) and the panel (getLatestNewsletterIssue, which needs
 * only the reference), so the panel always names what sends.
 */
export const CURRENT_DAYS = 45

/** Candidates read per query: the newest ones, some of which may be passed over. */
const CANDIDATES = 5

export type CurrentNewsletterIssueRef = {
  id: string
  subject: string
  status: 'sent' | 'sending' | 'scheduled'
  sendStartedAt: string | null
  sendFinishedAt: string | null
}

type CandidateRow = {
  id: string
  subject: string | null
  status: string
  send_started_at: string | null
  send_finished_at: string | null
  created_by: string | null
  stamp: string | null
}

const REF_COLUMNS = 'id,subject,status,send_started_at,send_finished_at,created_by,stamp:citations->0->>fetched_at'
const HAS_BODY = 'body_html.not.is.null,body_text.not.is.null'

function toRef(row: CandidateRow): CurrentNewsletterIssueRef {
  return {
    id: String(row.id),
    subject: String(row.subject ?? ''),
    status: row.status as CurrentNewsletterIssueRef['status'],
    sendStartedAt: row.send_started_at ?? null,
    sendFinishedAt: row.send_finished_at ?? null,
  }
}

/**
 * False for a monthly market report email whose report was rebuilt after it
 * was written (or is no longer published); true for every other issue. The
 * one check for every path that puts an issue in front of someone: this
 * selection, and the list and one-off enqueues (lib/newsletter/send-queue.ts).
 * A same-figures rebuild re-stamps an open email (the draft writer), so only an
 * email that went out stays behind its report; its trace records what was
 * checked when it went, and it is not sent again to someone new. THROWS on a
 * failed read: an unchecked email is not sent.
 */
export async function editionEmailFiguresCurrent(createdBy: string | null, stamp: string | null): Promise<boolean> {
  if (!isLiveEditionEmailMarker(createdBy)) return true
  const month = editionEmailMonth(createdBy)
  if (!month) return false
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_report_editions')
    .select('status,generated_at')
    .eq('edition_month', `${month}-01`)
    .maybeSingle()
  if (error) throw new Error(`editionEmailFiguresCurrent: ${error.message}`)
  const edition = data as { status: string; generated_at: string } | null
  if (!edition || edition.status !== 'published') return false
  return builtFromOrAfter(stamp, editionBuildStamp(edition))
}

async function firstCurrent(rows: CandidateRow[]): Promise<CurrentNewsletterIssueRef | null> {
  for (const row of rows) {
    if (await editionEmailFiguresCurrent(row.created_by, row.stamp)) return toRef(row)
  }
  return null
}

export async function getCurrentNewsletterIssueRef(now: Date = new Date()): Promise<CurrentNewsletterIssueRef | null> {
  const sb = createServiceClient()
  const since = new Date(now.getTime() - CURRENT_DAYS * 86_400_000).toISOString()
  const { data: out, error: outError } = await sb
    .from('newsletters')
    .select(REF_COLUMNS)
    .in('status', ['sent', 'sending'])
    .eq('list_send', true)
    .eq('send_paused', false)
    .gte('send_started_at', since)
    .or(HAS_BODY)
    .order('send_started_at', { ascending: false })
    .limit(CANDIDATES)
  if (outError) throw new Error(`getCurrentNewsletterIssue: ${outError.message}`)
  const sent = await firstCurrent((out ?? []) as unknown as CandidateRow[])
  if (sent) return sent

  const { data: next, error: nextError } = await sb
    .from('newsletters')
    .select(REF_COLUMNS)
    .eq('status', 'scheduled')
    .eq('send_paused', false)
    .or(HAS_BODY)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(CANDIDATES)
  if (nextError) throw new Error(`getCurrentNewsletterIssue: ${nextError.message}`)
  return firstCurrent((next ?? []) as unknown as CandidateRow[])
}

const APPROVED = new Set(['sent', 'sending', 'scheduled'])

/**
 * The whole row of the current issue, for the send. It is read again by id,
 * so it is checked again: an issue canceled or paused between the two reads
 * (a scheduled report email replaced because its report was republished, or
 * a send put on hold) is not sent.
 */
export async function getCurrentNewsletterIssue(now: Date = new Date()): Promise<NewsletterRow | null> {
  const ref = await getCurrentNewsletterIssueRef(now)
  if (!ref) return null
  const letter = await getNewsletter(ref.id)
  return letter && APPROVED.has(letter.status) && !letter.send_paused ? letter : null
}
