import 'server-only'

/**
 * Writes a published edition's email as a newsletter DRAFT for Matt's OK,
 * keeps what he can approve on the report's current figures, and texts him
 * the review link (Matt 2026-09-30: "Draft it for my OK").
 *
 * Nothing here sends to anyone. The draft waits on /admin/newsletters/<id>,
 * where Matt previews, edits and approves the send (Approve & Schedule runs
 * the R-2 and R-3 pre-send checks; the newsletter-send drain delivers). A
 * broker's one-click send never picks a draft
 * (lib/data/newsletter/current-issue.ts). The only message this module causes
 * is the ops text to Matt on the broker-alert rail (queueBrokerHealthAlert).
 *
 * Who calls it:
 *   - publishEdition (./pipeline.ts), on every publish by any path (the
 *     monthly cron, scripts/market-report-publish.ts): the newest month's
 *     draft is written, and a republished month's email is checked at once;
 *   - /api/cron/market-report-refresh every morning, first thing, the
 *     backstop: the newest month's draft exists once it is published, every
 *     open email is checked against its edition, and a month whose email was
 *     replaced but whose replacement was never written gets it.
 *
 * An email is keyed to the edition build its figures came from (every
 * citation's fetched_at is the edition's generated_at, ./edition-email-marker.ts).
 * When the edition is rebuilt, the email is built again and compared by the
 * figures it prints (each citation's figure and value; a change's direction
 * is in its figure):
 *   - the same figures: a draft or scheduled email keeps everything Matt did
 *     with it, and its trace moves to the new build (re-stamped);
 *   - new figures: a draft or scheduled email is REPLACED, never rewritten,
 *     in one transaction (replaceNewsletterDraft, migration 20260930180000):
 *     the old row is canceled, so it can never be scheduled or sent again, and
 *     a new draft is written from the new edition under the same marker and
 *     audience. Matt is texted the new link, whether the old one had been
 *     approved, and that edits to it are not carried over. What he reviewed
 *     is therefore always what he approves;
 *   - an email already going out cannot be recalled: he is texted once to
 *     pause the rest;
 *   - a new email that cannot be built (or a report no longer published):
 *     the old one is canceled all the same, the earlier figures never go out,
 *     and he is told; the backstop drafts the month once it can.
 *
 * Before anything is written, the email passes the R-2 check the schedule
 * button runs: every printed figure has a citation.
 */
import type { EditionRow } from '@/lib/data/market-report/editions'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import { createNewsletterDraft, type NewsletterCitationEntry } from '@/lib/data/newsletter'
import {
  findNewsletterByCreatedBy,
  findReplacedNewsletter,
  listEditionEmailMonthRows,
  replaceNewsletterDraft,
  restampNewsletterCitations,
  retireNewsletterDraft,
  type NewsletterByMarker,
  type ReplaceNewsletterDraftResult,
} from '@/lib/data/newsletter/scheduled'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { checkCitations } from '@/lib/newsletter/pre-send-gates'
import { buildEditionEmail, EDITION_EMAIL_SITE, type EditionEmail } from './edition-email'
import {
  EDITION_EMAIL_MARKER_PREFIX,
  builtFromOrAfter,
  editionBuildStamp,
  editionEmailMarker,
  editionEmailMonth,
  replacedEditionEmailMarker,
} from './edition-email-marker'
import { monthLabel } from './format'

export { editionEmailMarker } from './edition-email-marker'

export function newsletterReviewUrl(id: string): string {
  return `${EDITION_EMAIL_SITE}/admin/newsletters/${id}`
}

export type EditionEmailDraftResult =
  | { status: 'created'; id: string; subject: string }
  | { status: 'replaced'; id: string; replacedId: string; wasScheduled: boolean; touched: boolean }
  | { status: 'restamped'; id: string; newsletterStatus: string }
  | { status: 'stale-sending'; id: string; build: string }
  | { status: 'exists'; id: string; newsletterStatus: string }
  | { status: 'skipped'; reason: string }

export type EditionEmailDraftDeps = {
  getEdition: (month: string) => Promise<EditionRow | null>
  findDraft: (marker: string) => Promise<NewsletterByMarker | null>
  findReplaced: typeof findReplacedNewsletter
  createDraft: typeof createNewsletterDraft
  replaceDraft: typeof replaceNewsletterDraft
  retireDraft: typeof retireNewsletterDraft
  restamp: typeof restampNewsletterCitations
}

const LIVE: EditionEmailDraftDeps = {
  getEdition: getEditionForWrite,
  findDraft: findNewsletterByCreatedBy,
  findReplaced: findReplacedNewsletter,
  createDraft: createNewsletterDraft,
  replaceDraft: replaceNewsletterDraft,
  retireDraft: retireNewsletterDraft,
  restamp: restampNewsletterCitations,
}

/**
 * A failure, with the tag its text to Matt is keyed by: a different failure
 * (a canceled email, a new build) is a different text, never muted by an
 * earlier one's cooldown.
 */
export class EditionEmailError extends Error {
  constructor(
    message: string,
    readonly tag: string,
  ) {
    super(message)
    this.name = 'EditionEmailError'
  }
}

/** Open and still Matt's to approve. */
const OPEN = new Set(['draft', 'scheduled'])
/** Out of reach for good: sent, failed, or canceled (a canceled live marker is a month Matt skipped). */
const DONE = new Set(['sent', 'failed', 'canceled'])
/** How long a replaced month is looked after: an email older than this is not going out. */
const REPLACED_WINDOW_DAYS = 45

/** The edition build a trace came from (every citation carries it). */
function builtFrom(citations: NewsletterCitationEntry[]): string | null {
  return citations[0]?.fetched_at ?? null
}

/**
 * The figures an email prints, as its trace records them: each citation's
 * figure (what was printed, with a change's direction) and value (as
 * printed). The filter is left out: it records unprinted detail (sample
 * sizes, raw precision) that a rebuild can move without changing a word.
 */
function figures(citations: NewsletterCitationEntry[]): string {
  return JSON.stringify(citations.map((c) => [c.figure, c.value]))
}

/** The checked email for an edition. Throws when a printed figure has no citation. */
export function editionEmailContent(edition: EditionRow): EditionEmail {
  const email = buildEditionEmail(edition)
  const r2 = checkCitations(email.bodyHtml, email.citations)
  if (!r2.ok) throw new Error(`a printed figure has no citation (${r2.failures.slice(0, 2).join('; ')})`)
  return email
}

function content(edition: EditionRow): { email: EditionEmail } | { error: string } {
  try {
    return { email: editionEmailContent(edition) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/** Eight characters of an id: enough to tell a month's emails apart in an alert key. */
function short(id: string): string {
  return id.slice(0, 8)
}

/** A build as digits (20260925134804), for an alert key. */
function buildTag(build: string): string {
  return build.replace(/\D/g, '').slice(0, 14)
}

function canceledWords(status: 'draft' | 'scheduled'): string {
  return status === 'scheduled' ? 'its approved email was pulled back and canceled' : 'its email draft was canceled'
}

/**
 * Make sure `month`'s published edition has its email draft, on its current
 * figures. `create: false` only checks an email that exists (an older month is
 * not news to email), or writes one whose replacement was never written.
 */
export async function ensureEditionEmailDraft(
  month: string,
  opts: { create?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailDraftResult> {
  const key = month.slice(0, 7)
  const marker = editionEmailMarker(key)
  let lastCreateError = ''

  // Three passes: an email that moves under a pass (scheduled, claimed for
  // sending, replaced by another run) is read again and checked from the start.
  for (let pass = 0; pass < 3; pass++) {
    const draft = await deps.findDraft(marker)

    if (!draft) {
      if (!opts.create && !(await deps.findReplaced(marker))) {
        return { status: 'skipped', reason: `no ${key} email to check` }
      }
      const edition = await deps.getEdition(key)
      if (!edition) return { status: 'skipped', reason: `no ${key} edition` }
      if (edition.status !== 'published') return { status: 'skipped', reason: `the ${key} edition is ${edition.status}` }
      const build = editionBuildStamp(edition)
      const built = content(edition)
      if ('error' in built) throw new EditionEmailError(`its email was not drafted: ${built.error}`, buildTag(build))
      const made = await deps.createDraft({
        subject: built.email.subject,
        preview_text: built.email.previewText,
        body_html: built.email.bodyHtml,
        body_text: built.email.bodyText,
        audience: 'all',
        created_by: marker,
        citations: built.email.citations,
      })
      if (made.ok && made.id) return { status: 'created', id: made.id, subject: built.email.subject }
      // Refused: most likely another run wrote this month first (the unique
      // index). The next pass checks that one, or tries once more.
      lastCreateError = made.error ?? 'no id returned'
      continue
    }

    if (DONE.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

    const edition = await deps.getEdition(key)
    if (!edition || edition.status !== 'published') {
      // The report the email quotes and links to is not published (a republish
      // held by the reconciliation gate, or withdrawn): it must not go out.
      const why = edition ? `the ${key} report is now ${edition.status}` : `the ${key} report is gone`
      if (draft.status === 'sending') {
        throw new EditionEmailError(`${why} while its email is going out. To stop the rest, pause it: ${newsletterReviewUrl(draft.id)}`, `unpublished-${short(draft.id)}`)
      }
      if (!OPEN.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }
      const status = draft.status as 'draft' | 'scheduled'
      if (await deps.retireDraft(draft.id, status, replacedEditionEmailMarker(key, draft.id))) {
        throw new EditionEmailError(`${why}, so ${canceledWords(status)}. A new one is drafted when the report publishes again.`, `unpublished-${short(draft.id)}`)
      }
      continue
    }

    const build = editionBuildStamp(edition)
    const stamp = builtFrom(draft.citations)
    // Built from this edition, or from a newer one than this read: nothing to do.
    if (builtFromOrAfter(stamp, build)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

    const built = content(edition)
    if ('email' in built && stamp !== null && figures(draft.citations) === figures(built.email.citations)) {
      // The same printed figures from a newer build. An email going out keeps
      // the trace it was checked with; an open one moves to the new build.
      if (!OPEN.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }
      if (await deps.restamp(draft.id, stamp, built.email.citations)) {
        return { status: 'restamped', id: draft.id, newsletterStatus: draft.status }
      }
      continue
    }

    if (draft.status === 'sending') {
      if ('error' in built) {
        throw new EditionEmailError(
          `the report was republished while its email is going out, and the new figures could not be checked against it (${built.error}). If it should wait, pause it: ${newsletterReviewUrl(draft.id)}`,
          `sending-${short(draft.id)}-${buildTag(build)}`,
        )
      }
      return { status: 'stale-sending', id: draft.id, build }
    }
    if (!OPEN.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

    // New figures (or none that can be checked): the earlier email never goes out.
    const status = draft.status as 'draft' | 'scheduled'
    const retiredMarker = replacedEditionEmailMarker(key, draft.id)
    if ('error' in built) {
      if (!(await deps.retireDraft(draft.id, status, retiredMarker))) continue
      throw new EditionEmailError(
        `the report was republished and ${canceledWords(status)}, so it cannot go out with the earlier figures, but the new email could not be built: ${built.error}. The daily check drafts it once it can.`,
        `canceled-${short(draft.id)}`,
      )
    }

    let replaced: ReplaceNewsletterDraftResult
    try {
      replaced = await deps.replaceDraft({
        id: draft.id,
        expectedStatus: status,
        retiredCreatedBy: retiredMarker,
        subject: built.email.subject,
        previewText: built.email.previewText,
        bodyHtml: built.email.bodyHtml,
        bodyText: built.email.bodyText,
        citations: built.email.citations,
      })
    } catch (err) {
      // Nothing changed in that transaction. The earlier figures still must not go out.
      const why = err instanceof Error ? err.message : String(err)
      const retired = await deps.retireDraft(draft.id, status, retiredMarker).catch(() => false)
      if (retired) {
        throw new EditionEmailError(
          `the report was republished and ${canceledWords(status)}, so it cannot go out with the earlier figures, but the new email could not be written: ${why}. The daily check drafts it.`,
          `canceled-${short(draft.id)}`,
        )
      }
      throw new EditionEmailError(
        `the report was republished with new figures, but its email could not be replaced (${why}) and is still ${status}. Do not approve it; open it here: ${newsletterReviewUrl(draft.id)}`,
        `replace-${short(draft.id)}-${buildTag(build)}`,
      )
    }
    if (replaced.ok) {
      return {
        status: 'replaced',
        id: replaced.id,
        replacedId: draft.id,
        wasScheduled: replaced.previousStatus === 'scheduled',
        touched: replaced.touched,
      }
    }
    // It moved (scheduled, unscheduled, claimed for sending, or replaced by
    // another run): the next pass checks what is there now.
  }
  if (lastCreateError) throw new EditionEmailError(`its email was not drafted: ${lastCreateError}`, 'create')
  throw new EditionEmailError('its email kept changing while it was checked; the daily check looks again', 'churn')
}

/** One month in a text. */
function label(month: string): string {
  return monthLabel(month.slice(0, 7))
}

/**
 * The text to Matt for a result, or null. A draft waiting on him is one text
 * per draft (keyed by its id, 30 days): the "drafted" text, or the
 * "replaced" text that introduced it, and `remind` (the newest month only)
 * asks for it again each morning so a text that failed to queue is retried.
 * An email going out on figures since revised is told once per build.
 */
export function editionEmailAlert(
  month: string,
  result: EditionEmailDraftResult,
  opts: { remind?: boolean } = {},
): { key: string; body: string; cooldownMinutes: number } | null {
  const key = month.slice(0, 7)
  if (result.status === 'created' || (opts.remind && result.status === 'exists' && result.newsletterStatus === 'draft')) {
    return {
      key: `market-report-email-${key}-${short(result.id)}`,
      body: `The ${label(month)} market report email is drafted and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 30 * 1440,
    }
  }
  if (result.status === 'replaced') {
    const old = result.wasScheduled
      ? 'The email you had approved was pulled back and canceled, so it will not go out.'
      : 'The earlier draft was canceled.'
    const edits = result.touched ? ' If you had edited it, those edits are not in the new one.' : ''
    return {
      key: `market-report-email-${key}-${short(result.id)}`,
      body: `The ${label(month)} market report was republished with new figures. ${old}${edits} A new email is drafted from the new figures and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 30 * 1440,
    }
  }
  if (result.status === 'stale-sending') {
    return {
      key: `market-report-email-sending-${short(result.id)}-${buildTag(result.build)}`,
      body: `The ${label(month)} market report was republished with new figures while its email is going out. What has gone out cannot be recalled; to keep the rest from going out with the earlier figures, pause it: ${newsletterReviewUrl(result.id)}`,
      cooldownMinutes: 365 * 1440,
    }
  }
  return null
}

export type EditionEmailOutcome = EditionEmailDraftResult | { status: 'failed'; error: string }

async function tell(
  month: string,
  run: () => Promise<EditionEmailDraftResult>,
  opts: { remind?: boolean } = {},
): Promise<EditionEmailOutcome> {
  try {
    const result = await run()
    const alert = editionEmailAlert(month, result, opts)
    if (alert) await queueBrokerHealthAlert(alert)
    return result
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const tag = err instanceof EditionEmailError ? err.tag : 'error'
    console.error('[market-report email draft]', error)
    try {
      await queueBrokerHealthAlert({
        key: `market-report-email-failed-${month.slice(0, 7)}-${tag}`,
        body: `The ${label(month)} market report email needs a look: ${error.slice(0, 320)}`,
        cooldownMinutes: 7 * 1440,
      })
    } catch (alertErr) {
      console.error('[market-report email draft] alert', alertErr)
    }
    return { status: 'failed', error }
  }
}

/**
 * After `month` publishes: write its draft when it is the newest month
 * (`create`), or check its open email against the new figures. Never throws.
 */
export async function draftEditionEmailAndTell(
  month: string,
  opts: { create?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailOutcome> {
  return tell(month, () => ensureEditionEmailDraft(month, opts, deps), { remind: opts.create === true })
}

/**
 * The daily backstop: the newest month's draft exists once it is published,
 * every open email (newest first) is checked against its edition, and a
 * month replaced in the last REPLACED_WINDOW_DAYS whose replacement was never
 * written gets it. Never throws; one outcome per month it touched.
 */
export async function backstopEditionEmails(
  newestMonth: string,
  deps: EditionEmailDraftDeps & { listMonths?: typeof listEditionEmailMonthRows } = LIVE,
  now: Date = new Date(),
): Promise<Record<string, EditionEmailOutcome>> {
  const out: Record<string, EditionEmailOutcome> = {}
  const newest = newestMonth.slice(0, 7)
  out[newest] = await tell(newest, () => ensureEditionEmailDraft(newest, { create: true }, deps), { remind: true })
  let rows: Array<{ id: string; created_by: string }> = []
  try {
    const since = new Date(now.getTime() - REPLACED_WINDOW_DAYS * 86_400_000).toISOString()
    rows = await (deps.listMonths ?? listEditionEmailMonthRows)(EDITION_EMAIL_MARKER_PREFIX, since)
  } catch (err) {
    out.list = { status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
  for (const row of rows) {
    const month = editionEmailMonth(row.created_by)
    if (!month || month in out) continue
    out[month] = await tell(month, () => ensureEditionEmailDraft(month, { create: false }, deps))
  }
  return out
}
