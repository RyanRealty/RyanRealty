import 'server-only'

/**
 * Writes a published edition's email as a newsletter DRAFT for Matt's OK, and
 * texts him the review link (Matt 2026-09-30: "Draft it for my OK").
 *
 * Nothing here sends to anyone. The draft waits on /admin/newsletters/<id>,
 * where Matt previews it, edits it, and approves the send (Approve & Schedule
 * runs the R-2 and R-3 pre-send checks; the newsletter-send drain delivers).
 * The CRM's one-click send skips it too (lib/newsletter/auto-draft.ts). The
 * only message this module causes is the ops text to Matt, on the existing
 * broker-alert rail (queueBrokerHealthAlert).
 *
 * Called by /api/cron/market-report-publish right after the month publishes,
 * and by the daily /api/cron/market-report-refresh as the backstop, so a draft
 * that failed on the 8th is written the next morning. One draft per month,
 * keyed on created_by (no admin form edits it) and held by a unique index
 * (migration 20260930130000). Only the newest month is drafted: a late re-run
 * of an older edition is not news to email.
 *
 * Before writing, the draft passes the same R-2 check the schedule button
 * runs: every figure printed has a citation. A failure is a bug in the
 * builder, so the draft is not written and the caller reports it.
 */
import type { EditionRow } from '@/lib/data/market-report/editions'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import {
  createNewsletterDraft,
  setNewsletterCitations,
  updateNewsletter,
  type NewsletterCitationEntry,
} from '@/lib/data/newsletter'
import { findNewsletterByCreatedBy } from '@/lib/data/newsletter/scheduled'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { AUTO_DRAFT_PREFIX } from '@/lib/newsletter/auto-draft'
import { checkCitations } from '@/lib/newsletter/pre-send-gates'
import { buildEditionEmail, EDITION_EMAIL_SITE } from './edition-email'
import { monthLabel } from './format'

export const EDITION_EMAIL_MARKER_PREFIX = `${AUTO_DRAFT_PREFIX}market-report-edition:`

export function editionEmailMarker(month: string): string {
  return `${EDITION_EMAIL_MARKER_PREFIX}${month.slice(0, 7)}`
}

export function newsletterReviewUrl(id: string): string {
  return `${EDITION_EMAIL_SITE}/admin/newsletters/${id}`
}

export type EditionEmailDraftResult =
  | { status: 'created' | 'refreshed'; id: string; subject: string }
  | { status: 'exists'; id: string; newsletterStatus: string }
  | { status: 'skipped'; reason: string }

export type EditionEmailDraftDeps = {
  getEdition: (month: string) => Promise<EditionRow | null>
  findDraft: (marker: string) => Promise<{ id: string; status: string } | null>
  createDraft: typeof createNewsletterDraft
  updateDraft: typeof updateNewsletter
  setCitations: (id: string, citations: NewsletterCitationEntry[]) => Promise<{ ok: boolean }>
}

const LIVE: EditionEmailDraftDeps = {
  getEdition: getEditionForWrite,
  findDraft: findNewsletterByCreatedBy,
  createDraft: createNewsletterDraft,
  updateDraft: updateNewsletter,
  setCitations: setNewsletterCitations,
}

/**
 * Make sure `month`'s published edition has its email draft.
 *
 * `refresh` (the publish cron's ?force=1 republish) rewrites a draft that is
 * still a draft, so it never keeps figures the new edition replaced. A draft
 * Matt already scheduled or sent is left as it is.
 */
export async function ensureEditionEmailDraft(
  month: string,
  opts: { refresh?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailDraftResult> {
  const key = month.slice(0, 7)
  const edition = await deps.getEdition(key)
  if (!edition) return { status: 'skipped', reason: `no ${key} edition` }
  if (edition.status !== 'published') return { status: 'skipped', reason: `the ${key} edition is ${edition.status}` }

  const email = buildEditionEmail(edition)
  const r2 = checkCitations(email.bodyHtml, email.citations)
  if (!r2.ok) {
    throw new Error(`the ${key} email failed its figure check: ${r2.failures.join('; ')}`)
  }

  const marker = editionEmailMarker(key)
  const existing = await deps.findDraft(marker)
  if (existing) {
    if (!opts.refresh || existing.status !== 'draft') {
      return { status: 'exists', id: existing.id, newsletterStatus: existing.status }
    }
    const updated = await deps.updateDraft(existing.id, {
      subject: email.subject,
      preview_text: email.previewText,
      body_html: email.bodyHtml,
      body_text: email.bodyText,
    })
    const cited = updated.ok ? await deps.setCitations(existing.id, email.citations) : { ok: false }
    if (!updated.ok || !cited.ok) throw new Error(`the ${key} email draft ${existing.id} was not rewritten`)
    return { status: 'refreshed', id: existing.id, subject: email.subject }
  }

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
  throw new Error(`the ${key} email draft was not written: ${created.error ?? 'no id returned'}`)
}

/** The text to Matt for a result, or null when there is nothing new to tell. */
export function editionEmailAlert(
  month: string,
  result: EditionEmailDraftResult,
): { key: string; body: string; cooldownMinutes: number } | null {
  const label = monthLabel(month.slice(0, 7))
  if (result.status === 'created') {
    return {
      key: `market-report-email-${month.slice(0, 7)}`,
      body: `The ${label} market report email is drafted and waiting for your OK: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 1440,
    }
  }
  if (result.status === 'refreshed') {
    return {
      key: `market-report-email-refresh-${month.slice(0, 7)}`,
      body: `The ${label} market report was republished, so its email draft now carries the new figures: ${newsletterReviewUrl(result.id)} Nothing goes out until you approve it.`,
      cooldownMinutes: 1440,
    }
  }
  return null
}

/**
 * The cron entry point: ensure the draft, text Matt when one is new, and never
 * throw. A failure is texted once a week per month (the refresh cron retries
 * every morning, so a lasting failure should not become a daily text).
 */
export async function draftEditionEmailAndTell(
  month: string,
  opts: { refresh?: boolean } = {},
  deps: EditionEmailDraftDeps = LIVE,
): Promise<EditionEmailDraftResult | { status: 'failed'; error: string }> {
  try {
    const result = await ensureEditionEmailDraft(month, opts, deps)
    const alert = editionEmailAlert(month, result)
    if (alert) await queueBrokerHealthAlert(alert)
    return result
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[market-report email draft]', error)
    try {
      await queueBrokerHealthAlert({
        key: `market-report-email-failed-${month.slice(0, 7)}`,
        body: `The ${monthLabel(month.slice(0, 7))} market report email draft was not written: ${error.slice(0, 160)}. The daily refresh tries again each morning.`,
        cooldownMinutes: 7 * 1440,
      })
    } catch (alertErr) {
      console.error('[market-report email draft] alert', alertErr)
    }
    return { status: 'failed', error }
  }
}
