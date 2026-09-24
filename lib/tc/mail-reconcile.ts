/**
 * Plan the correction of mail filed on the wrong deal. Pure. No I/O.
 *
 * Two users:
 *  - planMisfileCorrections: the 2026-08-23 filer's history (legacy mail_filed
 *    events), run by scripts/tc-mail-backfill.ts reconcile.
 *  - planDocumentsOffDeal / planDocumentsOnDeal: one indexed message whose
 *    filing a rules change moved or took away, run by lib/tc/mail-redecide.ts.
 *
 * Nothing is deleted. tc_events is append-only, so each affected deal gets an
 * event naming every message that should not have been filed there and where
 * it belongs now. Documents those messages put on the deal are archived with a
 * reason (archive is the Vault's delete) and lose their checklist rows. A
 * document a person relies on (uploaded, archived, reviewed, shared, put on
 * the checklist by hand, used in an envelope or an offer) is never archived by
 * the rules; it is named in the event for a person to decide. The mail index
 * then files each message where the rules say it belongs.
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

// ── one message leaving or joining a deal (lib/tc/mail-redecide.ts) ──────

/** Every archive the mail re-decision makes starts with this, so a later re-decision can tell its own archives apart and restore them. */
export const REDECIDE_ARCHIVE_PREFIX = 'Mail re-decision:'

export type MessageDocument = {
  id: string
  cycleId: string
  sourceDocId: string | null
  sha256: string | null
  archived: boolean
  archivedReason: string | null
  /**
   * Why a person holds this document (a person's event on it, a principal
   * review, shared with the client, in an envelope or on an offer, on the
   * checklist by a hand other than the reader's). Any entry: never archived
   * or moved by the rules.
   */
  personSignals: string[]
  /** Other filings that still use this document (another message filed on the deal, a text). */
  otherFilings: string[]
}

export type DocumentsOffDealPlan = {
  /** This message's own documents nobody else uses: archive with a reason, drop their (reader-made) checklist rows. */
  archive: string[]
  /** Left in place, with why: a person relies on it, another filing uses it, or it was never this message's document. */
  keep: Array<{ id: string; reason: string }>
  alreadyArchived: string[]
}

/** Did this message's filing create this document (not reuse one already on the cycle)? */
export function createdByMessage(doc: Pick<MessageDocument, 'sourceDocId'>, messageKey: string): boolean {
  return messageKeyFromSourceDocId(doc.sourceDocId) === messageKey
}

/**
 * A message leaves a deal (the rules now file it elsewhere, queue it, or call
 * it not a deal). Its documents on that deal are archived only when this
 * message created them, no other filing uses them, and no person relies on
 * them. Everything else stays and is named with its reason.
 */
export function planDocumentsOffDeal(input: { messageKey: string; documents: readonly MessageDocument[] }): DocumentsOffDealPlan {
  const plan: DocumentsOffDealPlan = { archive: [], keep: [], alreadyArchived: [] }
  const seen = new Set<string>()
  for (const d of input.documents) {
    if (seen.has(d.id)) continue
    seen.add(d.id)
    if (!createdByMessage(d, input.messageKey)) {
      plan.keep.push({ id: d.id, reason: 'not this email’s document: the same file was on the deal before, from another source' })
    } else if (d.archived) {
      plan.alreadyArchived.push(d.id)
    } else if (d.personSignals.length) {
      plan.keep.push({ id: d.id, reason: `a person relies on it: ${d.personSignals.join('; ')}` })
    } else if (d.otherFilings.length) {
      plan.keep.push({ id: d.id, reason: `still filed by ${d.otherFilings.join('; ')}` })
    } else {
      plan.archive.push(d.id)
    }
  }
  return plan
}

export type DocumentsOnDealPlan = {
  /** Archived by an earlier re-decision, on the target cycle: restore. */
  restore: string[]
  /** On another cycle of the same deal (the message changed cycle): move to the target cycle, restoring it first when a re-decision archived it. */
  move: Array<{ id: string; toCycleId: string; restore: boolean }>
  /** On another cycle, and the target cycle already holds the same bytes: archive this copy. */
  archiveDuplicate: Array<{ id: string; duplicateOf: string }>
  keep: Array<{ id: string; reason: string }>
}

/**
 * A message is filed on a deal (new, moved there, or moved between cycles).
 * Filing onto the same deal twice is a no-op by design (fileOntoDeal dedupes
 * per deal), so documents an earlier re-decision archived here, or that sit on
 * another cycle of this deal, are settled here instead of filed again.
 */
export function planDocumentsOnDeal(input: {
  messageKey: string
  targetCycleId: string
  /** This deal's documents that came from this message, every cycle. */
  documents: readonly MessageDocument[]
  /** sha256 → document id, for live documents already on the target cycle. */
  targetCycleHashes: ReadonlyMap<string, string>
}): DocumentsOnDealPlan {
  const plan: DocumentsOnDealPlan = { restore: [], move: [], archiveDuplicate: [], keep: [] }
  for (const d of input.documents) {
    if (!createdByMessage(d, input.messageKey)) continue
    const ours = d.archived && (d.archivedReason ?? '').startsWith(REDECIDE_ARCHIVE_PREFIX)
    if (d.archived && !ours) continue // archived by the reader or a person: theirs to undo
    if (d.cycleId === input.targetCycleId) {
      if (ours) plan.restore.push(d.id)
      continue
    }
    const twin = d.sha256 ? input.targetCycleHashes.get(d.sha256) : undefined
    if (twin && twin !== d.id) {
      if (d.archived) continue
      if (d.personSignals.length) plan.keep.push({ id: d.id, reason: `a person relies on it: ${d.personSignals.join('; ')}` })
      else plan.archiveDuplicate.push({ id: d.id, duplicateOf: twin })
      continue
    }
    if (d.personSignals.length) {
      plan.keep.push({ id: d.id, reason: `a person relies on it: ${d.personSignals.join('; ')}` })
      continue
    }
    if (d.otherFilings.length) {
      plan.keep.push({ id: d.id, reason: `still filed on its cycle by ${d.otherFilings.join('; ')}` })
      continue
    }
    plan.move.push({ id: d.id, toCycleId: input.targetCycleId, restore: ours })
  }
  return plan
}

/** The archive reason for a document whose email the rules moved or unfiled. Starts with REDECIDE_ARCHIVE_PREFIX. */
export function redecideArchiveReason(input: { fromAddress: string; toAddress: string | null; newStatus: string; rulesVersion: string }): string {
  const where = input.toAddress
    ? `belongs to ${input.toAddress}`
    : input.newStatus === 'ambiguous' || input.newStatus === 'unfiled_transaction'
      ? 'needs a person to decide its file (mail queue)'
      : 'is not mail for any file'
  return `${REDECIDE_ARCHIVE_PREFIX} the email that filed this on ${input.fromAddress} ${where} under ${input.rulesVersion}. Restored automatically if the rules file it here again.`.slice(
    0,
    500,
  )
}
