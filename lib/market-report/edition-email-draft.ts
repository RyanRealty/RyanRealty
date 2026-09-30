import 'server-only'

/**
 * Writes a published edition's email as a newsletter DRAFT for Matt's OK,
 * keeps it on the report's current figures, and texts him the review link
 * (Matt 2026-09-30: "Draft it for my OK").
 *
 * Nothing here sends to anyone. The draft waits on /admin/newsletters/<id>,
 * where Matt previews, edits and approves the send (Approve & Schedule runs
 * the R-2 and R-3 pre-send checks; the newsletter-send drain delivers). A
 * broker's one-click send never picks a draft
 * (lib/data/newsletter/current-issue.ts). The only message this module causes
 * is the ops text to Matt on the broker-alert rail (queueBrokerHealthAlert).
 *
 * Who calls it:
 *   - /api/cron/market-report-publish, right after a month publishes (and for
 *     any month it republishes, so an open draft follows the new figures);
 *   - /api/cron/market-report-refresh every morning, the backstop: it writes
 *     the newest month's draft if the publish run did not, and re-checks every
 *     open edition draft against its edition, so a report republished by any
 *     path (the cron, scripts/market-report-publish.ts) cannot leave its email
 *     on old figures.
 *
 * One draft per month: created_by 'cron:market-report-edition:<YYYY-MM>'
 * (./edition-email-marker.ts), held by a unique index (migration
 * 20260930130000). Deleting it cancels it (deleteNewsletterDraft), so a month
 * Matt skips stays skipped. When the edition's figures change under an open
 * draft:
 *   - a draft Matt has not edited is rebuilt from the edition;
 *   - a draft he edited keeps his words, and gets the new edition's citations,
 *     so the figure check on the review page names every number that no
 *     longer matches and blocks scheduling until he fixes it;
 *   - a scheduled one first goes back to draft, so it cannot go out with the
 *     old figures; he re-approves it.
 * Edits are detected by a fingerprint of the body as built, stored as the
 * last entry of the draft's citations (the provenance line of its §0 trace).
 *
 * Before anything is written, the email passes the R-2 check the schedule
 * button runs: every printed figure has a citation.
 */
import { createHash } from 'node:crypto'
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
  | { status: 'stale-edited'; id: string; wasScheduled: boolean }
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

const PROVENANCE_FIGURE = 'Email draft source'

export function bodyFingerprint(bodyHtml: string): string {
  return createHash('sha256').update(bodyHtml).digest('hex').slice(0, 16)
}

/** The trace as stored: the figures, then one provenance line with the body fingerprint. */
function storedCitations(email: EditionEmail, key: string, generatedAt: string): NewsletterCitationEntry[] {
  return [
    ...email.citations,
    {
      figure: PROVENANCE_FIGURE,
      source: 'lib/market-report/edition-email.ts',
      filter: `built from the ${key} edition, figures computed ${generatedAt} · value is the body as built (sha-256, first 16 hex)`,
      value: `body ${bodyFingerprint(email.bodyHtml)}`,
      fetched_at: generatedAt,
    },
  ]
}

function builtFingerprint(citations: NewsletterCitationEntry[]): string | null {
  const line = citations.find((c) => c.figure === PROVENANCE_FIGURE)
  const m = typeof line?.value === 'string' ? /^body ([0-9a-f]{16})$/.exec(line.value) : null
  return m ? m[1]! : null
}

/** The figures a trace carries, ignoring the provenance line: equal means the report did not change them. */
function sameFigures(a: NewsletterCitationEntry[], b: NewsletterCitationEntry[]): boolean {
  const key = (list: NewsletterCitationEntry[]) =>
    JSON.stringify(
      list
        .filter((c) => c.figure !== PROVENANCE_FIGURE)
        .map((c) => [c.figure, c.value])
        .sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    )
  return key(a) === key(b)
}

function buildChecked(edition: EditionRow, key: string, when: 'create' | 'rebuild'): EditionEmail {
  const email = buildEditionEmail(edition)
  const r2 = checkCitations(email.bodyHtml, email.citations)
  if (!r2.ok) {
    const why = `a printed figure has no citation (${r2.failures.slice(0, 3).join('; ')})`
    throw new Error(
      when === 'create'
        ? `the ${key} email draft was not written: ${why}`
        : `the ${key} report changed, but its email draft could not be rebuilt: ${why}; the draft still shows the earlier figures`,
    )
  }
  return email
}

/** What a draft for this edition holds: the checked email and its stored trace (figures, then the provenance line). */
export function editionEmailDraftContent(
  edition: EditionRow,
  when: 'create' | 'rebuild' = 'create',
): { email: EditionEmail; citations: NewsletterCitationEntry[] } {
  const key = edition.edition_month.slice(0, 7)
  const email = buildChecked(edition, key, when)
  return { email, citations: storedCitations(email, key, edition.payload.generatedAt ?? edition.generated_at) }
}

/**
 * Make sure `month`'s published edition has its email draft, on its current
 * figures. `create: false` only re-checks a draft that exists (an older month
 * is not news to email).
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
  const draft = await deps.findDraft(marker)
  if (draft && CLOSED.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

  if (!draft) {
    if (opts.create === false) return { status: 'skipped', reason: `no ${key} email draft to re-check` }
    const { email, citations } = editionEmailDraftContent(edition, 'create')
    const created = await deps.createDraft({
      subject: email.subject,
      preview_text: email.previewText,
      body_html: email.bodyHtml,
      body_text: email.bodyText,
      audience: 'all',
      created_by: marker,
      citations,
    })
    if (created.ok && created.id) return { status: 'created', id: created.id, subject: email.subject }
    // Another run inserted this month first (the unique index refused ours).
    const raced = await deps.findDraft(marker)
    if (raced) return { status: 'exists', id: raced.id, newsletterStatus: raced.status }
    throw new Error(`the ${key} email draft was not written: ${created.error ?? 'no id returned'}`)
  }

  // An open draft (draft or scheduled): is it still on the edition's figures?
  const { email, citations } = editionEmailDraftContent(edition, 'rebuild')
  if (sameFigures(draft.citations, email.citations)) {
    return { status: 'exists', id: draft.id, newsletterStatus: draft.status }
  }

  let wasScheduled = false
  if (draft.status === 'scheduled') {
    // Its approval was for the old figures. If the send cron took it first, it is out of reach.
    if (!(await deps.unschedule(draft.id))) return { status: 'exists', id: draft.id, newsletterStatus: 'sending' }
    wasScheduled = true
  }

  const edited = builtFingerprint(draft.citations) !== bodyFingerprint(draft.body_html ?? '')
  if (!edited) {
    const ok = await deps.rewriteDraft(draft.id, {
      subject: email.subject,
      preview_text: email.previewText,
      body_html: email.bodyHtml,
      body_text: email.bodyText,
      citations,
    })
    if (!ok) return { status: 'exists', id: draft.id, newsletterStatus: 'not a draft' }
    return { status: 'refreshed', id: draft.id, subject: email.subject, wasScheduled }
  }

  // Matt edited it: keep his words, trace the new figures so the check names the stale ones.
  const ok = await deps.rewriteDraft(draft.id, { citations })
  if (!ok) return { status: 'exists', id: draft.id, newsletterStatus: 'not a draft' }
  return { status: 'stale-edited', id: draft.id, wasScheduled }
}

/** One month in the text. */
function label(month: string): string {
  return monthLabel(month.slice(0, 7))
}

/**
 * The text to Matt for a result, or null. The "drafted" text uses a 30-day
 * cooldown and is asked for again on every run while the draft sits unsent:
 * the alert queue dedupes it, so he gets it once, and a text that failed to
 * queue is retried the next morning.
 */
export function editionEmailAlert(
  month: string,
  result: EditionEmailDraftResult,
): { key: string; body: string; cooldownMinutes: number } | null {
  const key = month.slice(0, 7)
  const back = ' It had been scheduled, so it is back to a draft and cannot go out with the old figures; schedule it again when it looks right.'
  if (result.status === 'created' || (result.status === 'exists' && result.newsletterStatus === 'draft')) {
    return {
      key: `market-report-email-${key}`,
      body: `The ${label(month)} market report email is drafted and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 30 * 1440,
    }
  }
  if (result.status === 'refreshed') {
    return {
      key: `market-report-email-refresh-${key}`,
      body: `The ${label(month)} market report was republished with new figures, so its email draft was rebuilt from it: ${newsletterReviewUrl(result.id)}${result.wasScheduled ? back : ''} Nothing goes out until you approve it.`,
      cooldownMinutes: 1440,
    }
  }
  if (result.status === 'stale-edited') {
    return {
      key: `market-report-email-stale-${key}`,
      body: `The ${label(month)} market report was republished with new figures after you edited its email. Your edits are kept, and the figure check on the draft lists each number that no longer matches the report: ${newsletterReviewUrl(result.id)}${result.wasScheduled ? back : ''}`,
      cooldownMinutes: 1440,
    }
  }
  return null
}

type Outcome = EditionEmailDraftResult | { status: 'failed'; error: string }

async function tell(month: string, run: () => Promise<EditionEmailDraftResult>): Promise<Outcome> {
  try {
    const result = await run()
    const alert = editionEmailAlert(month, result)
    if (alert) await queueBrokerHealthAlert(alert)
    return result
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[market-report email draft]', error)
    try {
      await queueBrokerHealthAlert({
        key: `market-report-email-failed-${month.slice(0, 7)}`,
        body: `The ${label(month)} market report email needs a look: ${error.slice(0, 200)}. The daily refresh tries again each morning.`,
        cooldownMinutes: 7 * 1440,
      })
    } catch (alertErr) {
      console.error('[market-report email draft] alert', alertErr)
    }
    return { status: 'failed', error }
  }
}

/**
 * The publish cron's entry point: after `month` publishes, write its draft
 * (only the newest month, `create`) or bring an open one to the new figures.
 * Never throws.
 */
export async function draftEditionEmailAndTell(
  month: string,
  opts: { create?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<Outcome> {
  return tell(month, () => ensureEditionEmailDraft(month, opts, deps))
}

/**
 * The daily backstop: the newest month's draft exists once it is published,
 * and every open edition draft is on its edition's current figures. Never
 * throws; one outcome per month it touched.
 */
export async function backstopEditionEmails(
  newestMonth: string,
  deps: EditionEmailDraftDeps & { listOpen?: typeof listOpenEditionEmailDrafts } = LIVE,
): Promise<Record<string, Outcome>> {
  const out: Record<string, Outcome> = {}
  const newest = newestMonth.slice(0, 7)
  out[newest] = await tell(newest, () => ensureEditionEmailDraft(newest, { create: true }, deps))
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
