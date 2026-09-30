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
 *     draft is written, and a draft of a republished month is checked at once;
 *   - /api/cron/market-report-refresh every morning, first thing, the
 *     backstop: the newest month's draft exists once it is published, and
 *     every open edition draft is checked against its edition.
 *
 * A draft is never rewritten. When its edition is rebuilt with different
 * figures (the signed values each citation's filter records, not the prose
 * labels), the draft is REPLACED: the old row is canceled, so it can never
 * be scheduled or sent again, and a new draft is written from the new
 * edition, and Matt is texted the new link and told if the old one had been
 * scheduled. What he reviewed is therefore always what he approves, and no
 * edit, schedule or send of his can race a rewrite. An email already going
 * out is not touched: he is texted to pause it on the review page.
 *
 * One draft per month is live: created_by 'cron:market-report-edition:<YYYY-MM>'
 * (./edition-email-marker.ts), held by a unique index (migration
 * 20260930130000). A replaced draft keeps the marker with ':replaced:<build>'
 * appended, which frees it. Deleting a draft cancels it under the live
 * marker (deleteNewsletterDraft), so a month Matt skips stays skipped.
 *
 * Before anything is written, the email passes the R-2 check the schedule
 * button runs: every printed figure has a citation.
 */
import type { EditionRow } from '@/lib/data/market-report/editions'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import { createNewsletterDraft, type NewsletterCitationEntry } from '@/lib/data/newsletter'
import {
  findNewsletterByCreatedBy,
  listOpenEditionEmailDrafts,
  retireNewsletterDraft,
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
  | { status: 'replaced'; id: string; replacedId: string; wasScheduled: boolean; build: string }
  | { status: 'stale-sending'; id: string; build: string }
  | { status: 'exists'; id: string; newsletterStatus: string }
  | { status: 'skipped'; reason: string }

export type EditionEmailDraftDeps = {
  getEdition: (month: string) => Promise<EditionRow | null>
  findDraft: (marker: string) => Promise<NewsletterByMarker | null>
  createDraft: typeof createNewsletterDraft
  retireDraft: typeof retireNewsletterDraft
}

const LIVE: EditionEmailDraftDeps = {
  getEdition: getEditionForWrite,
  findDraft: findNewsletterByCreatedBy,
  createDraft: createNewsletterDraft,
  retireDraft: retireNewsletterDraft,
}

/** Out of reach for good: sent, failed, or canceled (a canceled live marker is a month Matt skipped). */
const DONE = new Set(['sent', 'failed', 'canceled'])

/** The edition build a trace came from (every citation carries payload.generatedAt). */
function builtFrom(citations: NewsletterCitationEntry[]): string | null {
  return citations[0]?.fetched_at ?? null
}

/**
 * The figures behind a trace, as recorded: each value with the filter that
 * records its source and its signed raw value ("medianYoY = -0.0229"). The
 * printed "down 2%" and "up 2%" both cite 2; the filter tells them apart.
 */
function figures(citations: NewsletterCitationEntry[]): string {
  return JSON.stringify(citations.map((c) => [c.value, c.filter]))
}

/** The checked email for an edition. Throws when a printed figure has no citation. */
export function editionEmailContent(edition: EditionRow): EditionEmail {
  const email = buildEditionEmail(edition)
  const r2 = checkCitations(email.bodyHtml, email.citations)
  if (!r2.ok) throw new Error(`a printed figure has no citation (${r2.failures.slice(0, 2).join('; ')})`)
  return email
}

function editionBuild(edition: EditionRow): string {
  return edition.payload.generatedAt ?? edition.generated_at
}

/**
 * Make sure `month`'s published edition has its email draft, on its current
 * figures. `create: false` only checks a draft that exists (an older month is
 * not news to email).
 */
export async function ensureEditionEmailDraft(
  month: string,
  opts: { create?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailDraftResult> {
  const key = month.slice(0, 7)
  const marker = editionEmailMarker(key)
  let draft = await deps.findDraft(marker)
  if (!draft && opts.create === false) return { status: 'skipped', reason: `no ${key} email draft to check` }
  if (draft && DONE.has(draft.status)) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

  const edition = await deps.getEdition(key)
  if (!edition) return { status: 'skipped', reason: `no ${key} edition` }
  if (edition.status !== 'published') return { status: 'skipped', reason: `the ${key} edition is ${edition.status}` }
  const build = editionBuild(edition)

  if (!draft) {
    let email: EditionEmail
    try {
      email = editionEmailContent(edition)
    } catch (err) {
      throw new Error(`its email draft was not written: ${err instanceof Error ? err.message : String(err)}`)
    }
    return create(key, marker, email, deps)
  }

  // An open email (draft, scheduled or going out). Built from this edition, or
  // from a newer one than this read (another run got there first): nothing to do.
  const stamp = builtFrom(draft.citations)
  if (stamp !== null && stamp >= build) return { status: 'exists', id: draft.id, newsletterStatus: draft.status }

  let email: EditionEmail | null = null
  let buildError: string | null = null
  try {
    email = editionEmailContent(edition)
  } catch (err) {
    buildError = err instanceof Error ? err.message : String(err)
  }
  if (email && figures(draft.citations) === figures(email.citations)) {
    return { status: 'exists', id: draft.id, newsletterStatus: draft.status }
  }

  // The figures changed (or cannot be checked). Take the old email out of reach.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (draft.status === 'sending') return { status: 'stale-sending', id: draft.id, build }
    const wasScheduled = draft.status === 'scheduled'
    if (await deps.retireDraft(draft.id, `${marker}:replaced:${build}`)) {
      if (!email) {
        throw new Error(
          `${wasScheduled ? 'its scheduled email was pulled back and canceled' : 'its email draft was canceled'} so it cannot go out with the earlier figures, but the new email could not be built: ${buildError}`,
        )
      }
      const made = await create(key, marker, email, deps)
      if (made.status !== 'created') return made
      return { status: 'replaced', id: made.id, replacedId: draft.id, wasScheduled, build }
    }
    // It moved under us (scheduled, unscheduled, claimed for sending): read it again.
    const again = await deps.findDraft(marker)
    if (!again || again.id !== draft.id) {
      return again ? { status: 'exists', id: again.id, newsletterStatus: again.status } : { status: 'skipped', reason: `the ${key} email draft is gone` }
    }
    if (DONE.has(again.status)) return { status: 'exists', id: again.id, newsletterStatus: again.status }
    draft = again
  }
  throw new Error(`the report changed, but its email kept changing under the replacement; the earlier email is still ${draft.status}`)
}

async function create(
  key: string,
  marker: string,
  email: EditionEmail,
  deps: EditionEmailDraftDeps,
): Promise<Extract<EditionEmailDraftResult, { status: 'created' | 'exists' }>> {
  const created = await deps.createDraft({
    subject: email.subject,
    preview_text: email.previewText,
    body_html: email.bodyHtml,
    body_text: email.bodyText,
    audience: 'all',
    created_by: marker,
    citations: email.citations,
  })
  if (created.ok && created.id) return { status: 'created', id: created.id, subject: email.subject }
  // Another run inserted this month first (the unique index refused ours).
  const raced = await deps.findDraft(marker)
  if (raced) return { status: 'exists', id: raced.id, newsletterStatus: raced.status }
  throw new Error(`its email draft was not written: ${created.error ?? 'no id returned'}`)
}

/** One month in a text. */
function label(month: string): string {
  return monthLabel(month.slice(0, 7))
}

/**
 * The text to Matt for a result, or null. `remind` (the newest month only)
 * asks for the "drafted" text again while the draft sits unsent: the alert
 * queue dedupes it for 30 days, so he gets it once, and a text that failed to
 * queue is retried the next morning. A replacement or a stale send is keyed
 * by the edition build, so every one is told.
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
  if (result.status === 'replaced') {
    const old = result.wasScheduled ? 'Its earlier email had been scheduled; it was pulled back and canceled, so it will not go out.' : 'Its earlier email draft was canceled.'
    return {
      key: `market-report-email-replaced-${key}-${result.build}`,
      body: `The ${label(month)} market report was republished with new figures. ${old} A new email is drafted from the new figures and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 1440,
    }
  }
  if (result.status === 'stale-sending') {
    return {
      key: `market-report-email-sending-${key}-${result.build}`,
      body: `The ${label(month)} market report was republished with new figures while its email is going out. To keep the rest from going out with the old figures, pause it: ${newsletterReviewUrl(result.id)}`,
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
        body: `The ${label(month)} market report email needs a look: ${error.slice(0, 260)}`,
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
 * (`create`), or check an open one against the new figures. Never throws.
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
 * and every open edition email (newest first) is checked against its
 * edition. Never throws; one outcome per month it touched.
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
