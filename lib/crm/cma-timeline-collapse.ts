/**
 * Read-time collapse of a historical double log. No writes.
 *
 * Before the Gmail rail shared a dedupe key, sendCmaToLead wrote an app
 * email_out (`cma:sent:<slug>:<iso>`) and the mailbox sync wrote a second
 * email_out for the same Gmail message. The lead page shows one item: the
 * gmail row's id, timestamp, title, and body, with the CMA slug, label, and
 * thread id copied onto its payload.
 *
 * Match: app-source email_out whose payload.artifact is `cma` and whose
 * gmailMessageId equals a gmail-source email_out payload.gmailId (same
 * person when both ids are set). If both ids are absent: same person (or
 * person id omitted, treated as the same person) and the same trimmed
 * subject within 120 seconds, inclusive. Subject compare is exact, not
 * case-folded.
 */

import { CMA_LABEL_SENT } from '@/lib/crm/cma-thread-label'

export type CmaCollapseRow = {
  kind: string
  ts: string
  title?: string | null
  source?: string | null
  personId?: number | null
  payload?: Record<string, unknown> | null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function samePerson(a: CmaCollapseRow, b: CmaCollapseRow): boolean {
  if (a.personId == null || b.personId == null) return true
  return a.personId === b.personId
}

const WINDOW_MS = 120_000

function subjectFallback(app: CmaCollapseRow, gmail: CmaCollapseRow): boolean {
  if (!samePerson(app, gmail)) return false
  const subject = (app.title ?? '').trim()
  if (!subject || (gmail.title ?? '').trim() !== subject) return false
  const appTs = Date.parse(app.ts)
  const gmailTs = Date.parse(gmail.ts)
  if (!Number.isFinite(appTs) || !Number.isFinite(gmailTs)) return false
  return Math.abs(gmailTs - appTs) <= WINDOW_MS
}

/**
 * Drop the app duplicate. Keep every other row in its original order.
 */
export function collapseCmaSendDuplicates<T extends CmaCollapseRow>(rows: readonly T[]): T[] {
  const gmailOuts = rows.filter((row) => row.kind === 'email_out' && row.source === 'gmail')
  const drop = new Set<T>()
  const extras = new Map<T, Record<string, unknown>>()

  for (const app of rows) {
    if (app.kind !== 'email_out' || app.source !== 'app') continue
    const payload = app.payload ?? {}
    if (payload.artifact !== 'cma') continue
    const gmailMessageId = str(payload.gmailMessageId)
    let match: T | null = null
    if (gmailMessageId) {
      match =
        gmailOuts.find((gmail) => {
          if (str(gmail.payload?.gmailId) !== gmailMessageId) return false
          return samePerson(app, gmail)
        }) ?? null
    } else {
      match =
        gmailOuts.find((gmail) => {
          if (str(gmail.payload?.gmailId)) return false
          return subjectFallback(app, gmail)
        }) ?? null
    }
    if (!match) continue
    drop.add(app)
    const slug = str(payload.cmaSlug) ?? str(payload.slug)
    const threadId = str(payload.threadId)
    const appLabel = str(payload.cmaLabel)
    const prev = extras.get(match) ?? {}
    extras.set(match, {
      ...prev,
      ...(slug ? { cmaSlug: slug } : {}),
      ...(str(payload.slug) ? { slug: str(payload.slug) } : {}),
      cmaLabel:
        appLabel === 'CMA sent' || appLabel === 'CMA reply received' || appLabel === 'CMA reply sent'
          ? appLabel
          : CMA_LABEL_SENT,
      ...(threadId ? { threadId } : {}),
      artifact: 'cma',
    })
  }

  const out: T[] = []
  for (const row of rows) {
    if (drop.has(row)) continue
    const extra = extras.get(row)
    if (!extra) {
      out.push(row)
      continue
    }
    const payload: Record<string, unknown> = { ...(row.payload ?? {}) }
    if (extra.cmaSlug) payload.cmaSlug = extra.cmaSlug
    if (!str(payload.slug) && extra.slug) payload.slug = extra.slug
    payload.cmaLabel = extra.cmaLabel
    if (!str(payload.threadId) && extra.threadId) payload.threadId = extra.threadId
    if (payload.artifact == null || payload.artifact === '') payload.artifact = extra.artifact
    out.push({ ...row, payload })
  }
  return out
}
