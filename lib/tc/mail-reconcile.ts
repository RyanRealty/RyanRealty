/**
 * Plan the correction of mail the 2026-08-23 filer put on the wrong deal.
 * Pure. No I/O. scripts/tc-mail-backfill.ts runs the plan.
 *
 * Nothing is deleted. tc_events is append-only, so each affected deal gets one
 * `mail_misfile_corrected` event naming every message that should not have been
 * filed there and where it belongs now. Documents those messages put on the
 * deal are archived with a reason (archive is the Vault's delete) and lose
 * their checklist rows. The mail index then files each message where the rules
 * say it belongs.
 */

export type LegacyMailEvent = { id: number; dealId: string; dedupe: string; title: string | null; createdAt: string }
export type LegacyMailDocument = { id: string; dealId: string; sourceDocId: string | null; name: string; archived: boolean }
export type CurrentDecision = { status: string; dealId: string | null }

export type DealCorrection = {
  dealId: string
  /** Legacy mail_filed events whose message does not belong on this deal. */
  eventIds: number[]
  dedupeKeys: string[]
  /** Where each corrected message belongs now (null = no deal). */
  movedTo: Record<string, string | null>
  /** gmail_auto_file documents from those messages, to archive. */
  documentIds: string[]
  /** Titles, for the audit note. */
  sampleTitles: string[]
}

export type CorrectionPlan = {
  corrections: DealCorrection[]
  /** Legacy filings the current rules agree with. */
  confirmed: number
  /** Legacy filings whose message the walk never saw (deleted, or another mailbox). Left alone. */
  unverified: number
}

/** `mail:rfc:abc` → `rfc:abc`; `gmail:rfc:abc:ATT` → `rfc:abc`. */
export function messageKeyFromDedupe(dedupe: string): string | null {
  const m = dedupe.match(/^mail:(.+)$/)
  return m ? m[1] : null
}

export function messageKeyFromSourceDocId(sourceDocId: string | null | undefined): string | null {
  const m = String(sourceDocId ?? '').match(/^gmail:((?:rfc|gmail):[^:]+):/)
  return m ? m[1] : null
}

export function planMisfileCorrections(input: {
  events: readonly LegacyMailEvent[]
  documents: readonly LegacyMailDocument[]
  decisions: ReadonlyMap<string, CurrentDecision>
}): CorrectionPlan {
  const byDeal = new Map<string, DealCorrection>()
  let confirmed = 0
  let unverified = 0
  const wrong = new Set<string>() // `${dealId}|${messageKey}`
  for (const e of input.events) {
    const key = messageKeyFromDedupe(e.dedupe)
    if (!key) continue
    const d = input.decisions.get(key)
    if (!d) {
      unverified++
      continue
    }
    if (d.status === 'filed' && d.dealId === e.dealId) {
      confirmed++
      continue
    }
    const c =
      byDeal.get(e.dealId) ??
      ({ dealId: e.dealId, eventIds: [], dedupeKeys: [], movedTo: {}, documentIds: [], sampleTitles: [] } satisfies DealCorrection)
    c.eventIds.push(e.id)
    if (!c.dedupeKeys.includes(e.dedupe)) c.dedupeKeys.push(e.dedupe)
    c.movedTo[key] = d.status === 'filed' ? d.dealId : null
    if (e.title && c.sampleTitles.length < 12 && !c.sampleTitles.includes(e.title)) c.sampleTitles.push(e.title)
    byDeal.set(e.dealId, c)
    wrong.add(`${e.dealId}|${key}`)
  }
  for (const doc of input.documents) {
    if (doc.archived) continue
    const key = messageKeyFromSourceDocId(doc.sourceDocId)
    if (!key || !wrong.has(`${doc.dealId}|${key}`)) continue
    byDeal.get(doc.dealId)?.documentIds.push(doc.id)
  }
  return {
    corrections: [...byDeal.values()].sort((a, b) => b.eventIds.length - a.eventIds.length),
    confirmed,
    unverified,
  }
}
