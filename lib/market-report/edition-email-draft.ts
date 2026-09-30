import 'server-only'

/**
 * Writes a published edition's email as a newsletter DRAFT for Matt's OK,
 * keeps it on the report's current figures, and texts him the review link
 * (Matt 2026-09-30: "Draft it for my OK").
 *
 * Nothing here sends to anyone. The draft waits on /admin/newsletters/<id>,
 * where Matt previews, edits and approves the send (Approve & Schedule runs
 * the R-2 and R-3 pre-send checks and refuses a draft that changed while it
 * was being checked; the newsletter-send drain delivers). A broker's one-click
 * send never picks a draft (lib/data/newsletter/current-issue.ts). The only
 * message this module causes is the ops text to Matt on the broker-alert rail
 * (queueBrokerHealthAlert).
 *
 * Who calls it:
 *   - publishEdition (lib/market-report/pipeline.ts), on every publish by any
 *     path (the monthly cron, scripts/market-report-publish.ts): the newest
 *     month's draft is written, and an open draft of a republished month is
 *     brought to the new figures at once;
 *   - /api/cron/market-report-refresh every morning, the backstop: the newest
 *     month's draft exists once it is published, and every open edition draft
 *     is re-checked against its edition.
 *
 * One draft per month: created_by 'cron:market-report-edition:<YYYY-MM>'
 * (./edition-email-marker.ts), held by a unique index (migration
 * 20260930130000). Deleting it cancels it (deleteNewsletterDraft), so a month
 * Matt skips stays skipped.
 *
 * Accuracy outranks edits (CLAUDE.md §0). Every citation of a draft carries
 * the edition build it came from (fetched_at = payload.generatedAt). When the
 * edition is rebuilt and its figures differ, the draft is rebuilt from it,
 * all of it: subject, preheader, both bodies and the trace. A scheduled draft
 * first goes back to draft (its approval was for the old figures), and Matt
 * is texted that it was rebuilt and that any edits he made were replaced. If
 * the new email cannot be built, a scheduled draft is still taken back, so it
 * cannot go out on figures nobody re-checked.
 *
 * Before anything is written, the email passes the R-2 check the schedule
 * button runs: every printed figure has a citation.
 */
import type { EditionRow } from '@/lib/data/market-report/editions'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import {
  createNewsletterDraft,
  updateNewsletterDraftContent,
  type NewsletterCitationEntry,
} from '@/lib/data/newsletter'
import {
  findNewsletterByCreatedBy,
  listOpenEditionEmailDrafts,
  unscheduleNewsletter,
  type NewsletterByMarker,
} from '@/lib/data/newsletter/scheduled'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { checkCitations } from '@/lib/newsletter/pre-send-gates'
import { buildEditionEmail, EDITION_EMAIL_SITE, type EditionEmail } from './edition-email'
import { EDITION_EMAIL_MARKER_PREFIX, editionEmailMarker, editionEmailMonth } from './edition-email-marker'
import { monthLabel } from './format'

export { editionEmailMarker } from './edition-email-marker'

export function newsletterReviewUrl(id: string): string {
  return `${EDITION_EMAIL_SITE}/admin/newsletters/${id}`
}

export type EditionEmailDraftResult =
  | { status: 'created'; id: string; subject: string }
  | { status: 'refreshed'; id: string; subject: string; wasScheduled: boolean }
  | { status: 'exists'; id: string; newsletterStatus: string }
  | { status: 'skipped'; reason: string }

export type EditionEmailDraftDeps = {
  getEdition: (month: string) => Promise<EditionRow | null>
  findDraft: (marker: string) => Promise<NewsletterByMarker | null>
  createDraft: typeof createNewsletterDraft
  rewriteDraft: typeof updateNewsletterDraftContent
  unschedule: (id: string) => Promise<boolean>
}

const LIVE: EditionEmailDraftDeps = {
  getEdition: getEditionForWrite,
  findDraft: findNewsletterByCreatedBy,
  createDraft: createNewsletterDraft,
  rewriteDraft: updateNewsletterDraftContent,
  unschedule: unscheduleNewsletter,
}

/** A draft in one of these is out of reach: already going or gone out, or canceled. */
const CLOSED = new Set(['sending', 'sent', 'failed', 'canceled'])

/** The edition build a trace came from. */
function builtFrom(citations: NewsletterCitationEntry[]): string | null {
  return citations[0]?.fetched_at ?? null
}

/** The printed figures in the order the builder cites them. Labels are prose and may be reworded; values are the figures. */
function figureValues(citations: NewsletterCitationEntry[]): string {
  return JSON.stringify(citations.map((c) => c.value))
}

/** The checked email for an edition. Throws when a printed figure has no citation. */
export function editionEmailContent(edition: EditionRow): EditionEmail {
  const email = buildEditionEmail(edition)
  const r2 = checkCitations(email.bodyHtml, email.citations)
  if (!r2.ok) throw new Error(`a printed figure has no citation (${r2.failures.slice(0, 3).join('; ')})`)
  return email
}

function content(email: EditionEmail) {
  return {
    subject: email.subject,
    preview_text: email.previewText,
    body_html: email.bodyHtml,
    body_text: email.bodyText,
    citations: email.citations,
  }
}

/**
 * Make sure `month`'s published edition has its email draft, on its current
 * figures. `create: false` only re-checks a draft that exists (an older
 * month is not news to email).
 */
export async function ensureEditionEmailDraft(
  month: string,
  opts: { create?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailDraftResult> {
  const key = month.slice(0, 7)
  const edition = await deps.getEdition(key)
  if (!edition) return { status: 'skipped', reason: `no ${key} edition` }
  if (edition.status !== 'published') return { status: 'skipped', reason: `the ${key} edition is ${edition.status}` }

  const marker = editionEmailMarker(key)
  let draft = await deps.findDraft(marker)
  if (draft && CLOSED.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

  if (!draft) {
    if (opts.create === false) return { status: 'skipped', reason: `no ${key} email draft to re-check` }
    let email: EditionEmail
    try {
      email = editionEmailContent(edition)
    } catch (err) {
      throw new Error(`the ${key} email draft was not written: ${err instanceof Error ? err.message : String(err)}`)
    }
    const created = await deps.createDraft({ ...content(email), audience: 'all', created_by: marker })
    if (created.ok && created.id) return { status: 'created', id: created.id, subject: email.subject }
    // Another run inserted this month first (the unique index refused ours).
    const raced = await deps.findDraft(marker)
    if (raced) return { status: 'exists', id: raced.id, newsletterStatus: raced.status }
    throw new Error(`the ${key} email draft was not written: ${created.error ?? 'no id returned'}`)
  }

  // An open draft (draft or scheduled) of an edition that has not been rebuilt since.
  const current = edition.payload.generatedAt ?? edition.generated_at
  if (builtFrom(draft.citations) === current) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

  let email: EditionEmail
  try {
    email = editionEmailContent(edition)
  } catch (err) {
    // The new figures cannot be checked: never leave it scheduled on the old ones.
    const back = draft.status === 'scheduled' && (await deps.unschedule(draft.id))
    throw new Error(
      `the ${key} report was rebuilt, but its email could not be: ${err instanceof Error ? err.message : String(err)}; ` +
        (back ? 'it is back to a draft so it cannot go out with the earlier figures' : 'the draft still shows the earlier figures'),
    )
  }

  if (figureValues(draft.citations) === figureValues(email.citations)) {
    // Rebuilt, same figures: carry the build stamp forward on a draft (a scheduled one keeps its approved content).
    if (draft.status === 'draft') await deps.rewriteDraft(draft.id, { citations: email.citations })
    return { status: 'exists', id: draft.id, newsletterStatus: draft.status }
  }

  // New figures. Two tries: a schedule that lands between the read and the
  // write makes the conditional rewrite miss, and is taken back on the retry.
  let wasScheduled = false
  for (let attempt = 0; attempt < 2; attempt++) {
    if (draft.status === 'scheduled') {
      if (!(await deps.unschedule(draft.id))) return { status: 'exists', id: draft.id, newsletterStatus: 'sending' }
      wasScheduled = true
    }
    if (await deps.rewriteDraft(draft.id, content(email))) {
      return { status: 'refreshed', id: draft.id, subject: email.subject, wasScheduled }
    }
    const again = await deps.findDraft(marker)
    if (!again || CLOSED.has(again.status)) return { status: 'exists', id: draft.id, newsletterStatus: again?.status ?? 'gone' }
    draft = again
  }
  throw new Error(`the ${key} report changed, but its email draft kept changing under the rewrite; it still shows the earlier figures`)
}

/** One month in a text. */
function label(month: string): string {
  return monthLabel(month.slice(0, 7))
}

/**
 * The text to Matt for a result, or null. `remind` (the newest month only)
 * asks for the "drafted" text again while the draft sits unsent: the alert
 * queue dedupes it for 30 days, so he gets it once, and a text that failed to
 * queue is retried the next morning.
 */
export function editionEmailAlert(
  month: string,
  result: EditionEmailDraftResult,
  opts: { remind?: boolean } = {},
): { key: string; body: string; cooldownMinutes: number } | null {
  const key = month.slice(0, 7)
  if (result.status === 'created' || (opts.remind && result.status === 'exists' && result.newsletterStatus === 'draft')) {
    return {
      key: `market-report-email-${key}`,
      body: `The ${label(month)} market report email is drafted and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 30 * 1440,
    }
  }
  if (result.status === 'refreshed') {
    const back = result.wasScheduled
      ? ' It had been scheduled, so it is back to a draft; schedule it again when it looks right.'
      : ''
    return {
      key: `market-report-email-refresh-${key}`,
      body: `The ${label(month)} market report was republished with new figures, so its email draft was rebuilt from it and any edits you had made to it were replaced: ${newsletterReviewUrl(result.id)}${back} Nothing goes out until you approve it.`,
      cooldownMinutes: 1440,
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
    console.error('[market-report email draft]', error)
    try {
      await queueBrokerHealthAlert({
        key: `market-report-email-failed-${month.slice(0, 7)}`,
        body: `The ${label(month)} market report email needs a look: ${error.slice(0, 220)}. The daily refresh tries again each morning.`,
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
 * (`create`), or bring an open draft to the new figures. Never throws.
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
 * and every open edition draft (newest first) is on its edition's current
 * figures. Never throws; one outcome per month it touched.
 */
export async function backstopEditionEmails(
  newestMonth: string,
  deps: EditionEmailDraftDeps & { listOpen?: typeof listOpenEditionEmailDrafts } = LIVE,
): Promise<Record<string, EditionEmailOutcome>> {
  const out: Record<string, EditionEmailOutcome> = {}
  const newest = newestMonth.slice(0, 7)
  out[newest] = await tell(newest, () => ensureEditionEmailDraft(newest, { create: true }, deps), { remind: true })
  let open: Array<{ id: string; created_by: string }> = []
  try {
    open = await (deps.listOpen ?? listOpenEditionEmailDrafts)(EDITION_EMAIL_MARKER_PREFIX)
  } catch (err) {
    out.list = { status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
  for (const row of open) {
    const month = editionEmailMonth(row.created_by)
    if (!month || month in out) continue
    out[month] = await tell(month, () => ensureEditionEmailDraft(month, { create: false }, deps))
  }
  return out
}
