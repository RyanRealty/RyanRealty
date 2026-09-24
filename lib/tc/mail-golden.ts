/**
 * The Vault mail-filing golden evaluation set: pure logic only, no I/O.
 *
 * Six auditors hand-judged real mail against the filer on 2026-09-24 (five by
 * reading the message, `deal-recall` by a lower-confidence regex classifier
 * sweep for recall misses) and wrote one `rows.json` per slice under
 * `mail-audit/<slice>/`. Each auditor wrote their own verdict words, so this
 * module's job is translating that vocabulary into one small, stable shape —
 * `{ expect, deal_id, deal_not_in_vault }` — and then scoring a production
 * decision against it. `scripts/tc-mail-golden-build.ts` and
 * `scripts/tc-mail-eval.ts` are the only real callers; everything here is
 * pure so `lib/tc/mail-golden.test.ts` can test it with no network.
 *
 * See docs/TC_MAIL_FILING_RULES.md "Golden evaluation set" for the worked
 * verdict table this file implements.
 */
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'

export type GoldenExpectation = 'file' | 'not_filed' | 'queue'
/**
 * `verified` outranks both: a targeted adversarial re-check (read the message
 * directly, cross-checked against tc_deals/tc_cycles/tc_deal_people/
 * tc_deal_contacts) of a specific row a hand or classifier slice got wrong —
 * see the `verify` folder and `VERIFIED_OVERRIDES` in
 * scripts/tc-mail-golden-build.ts. `hand` is an auditor who read the message;
 * `classifier` is deal-recall's lower-confidence regex sweep.
 */
export type GoldenConfidence = 'hand' | 'classifier' | 'verified'

/** verified beats hand beats classifier — see `buildGoldenRows`. */
export const CONFIDENCE_RANK: Readonly<Record<GoldenConfidence, number>> = { verified: 0, hand: 1, classifier: 2 }

/** One row of a slice's rows.json, as every auditor wrote it (mail-audit/BRIEF.md). */
export type MailAuditRow = {
  mailbox: string
  gmail_id: string
  system_status?: string | null
  system_stage?: string | null
  system_reason?: string | null
  system_deal_id?: string | null
  system_match_method?: string | null
  verdict: string
  correct_deal_id?: string | null
  deal_not_in_vault?: boolean | null
  property?: string | null
  evidence?: string | null
  would_have_caught_it?: string | null
  /** No slice's rows.json carries these today; read defensively in case a future audit names one. */
  correct_cycle_id?: string | null
  expect_cycle_id?: string | null
}

/**
 * One committed golden row. Deliberately carries no content — ids, the
 * expectation and provenance only (docs/TC_MAIL_FILING_RULES.md: "NEVER copy
 * evidence, subjects, bodies, names or addresses into the golden file").
 */
export type GoldenRow = {
  mailbox: string
  gmail_id: string
  expect: GoldenExpectation
  deal_id: string | null
  deal_not_in_vault: boolean
  slice: string
  confidence: GoldenConfidence
  /** Only present when right_deal_wrong_cycle (or a future verdict) names a specific cycle. */
  expect_cycle_id?: string | null
}

const EMAIL_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CRM_BROKER_BY_EMAIL).map(([email, slug]) => [slug, email]),
)

/**
 * Audit rows wrote `mailbox` as a full address (the five hand slices) or a
 * bare CRM slug (`deal-recall`, e.g. "rebecca" not "rebeccapeterson@…"). Both
 * name one of the three broker mailboxes; normalize to the full address so a
 * message judged in two slices dedupes onto the same key.
 */
export function normalizeMailbox(raw: string): string {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v.includes('@')) return v
  return EMAIL_BY_SLUG[v] ?? v
}

/**
 * `deal-recall` is the one slice built from a regex classifier sweep;
 * `verify` is a targeted adversarial re-check (highest confidence — see
 * `GoldenConfidence`); every other slice was judged by reading the message.
 */
export function confidenceForSlice(slice: string): GoldenConfidence {
  if (slice === 'deal-recall') return 'classifier'
  if (slice === 'verify') return 'verified'
  return 'hand'
}

export type MappedExpectation = {
  expect: GoldenExpectation
  dealId: string | null
  dealNotInVault: boolean
  expectCycleId: string | null
  /**
   * Set when the row's own fields didn't cleanly fit its verdict (missing a
   * correct_deal_id a mapping needs, or a verdict string this module has
   * never seen). Mapped conservatively to `queue` — a person can still sort
   * it out — and always surfaced, never silently dropped.
   */
  anomaly?: string
}

function fileTo(dealId: string | null, expectCycleId: string | null = null): MappedExpectation {
  return { expect: 'file', dealId, dealNotInVault: false, expectCycleId }
}
function notFiled(): MappedExpectation {
  return { expect: 'not_filed', dealId: null, dealNotInVault: false, expectCycleId: null }
}
function queued(dealNotInVault: boolean): MappedExpectation {
  return { expect: 'queue', dealId: null, dealNotInVault, expectCycleId: null }
}

/**
 * One audit row's verdict → a golden expectation. The verdict vocabulary
 * differs per slice (each of the six auditors wrote their own words for
 * "the system got this right"):
 *
 *   filed-matt / filed-rp   (the auditor read a message the system HAD filed)
 *     correct                  → file, to correct_deal_id ?? system_deal_id
 *     should_not_file          → not_filed
 *     wrong_deal                → file to correct_deal_id, or queue when deal_not_in_vault
 *     right_deal_wrong_cycle   → file to that same deal (the deal was right); expect_cycle_id
 *                                 when the row names one (none do today)
 *
 *   missed-notdeal / missed-bulk (the auditor read a message the system DROPPED)
 *     not_deal_correct, bulk_correct     → not_filed
 *     pertains_to_deal                    → file to correct_deal_id, or queue when deal_not_in_vault
 *     transactional_platform_unknown_property → queue (real transaction content with
 *                                 no address the rules could ever resolve — the honest
 *                                 outcome is a person in the queue, not silent bulk noise)
 *
 *   queue (the auditor read a message the system left ambiguous / unfiled_transaction)
 *     file_to                  → file to correct_deal_id
 *     genuinely_needs_person   → queue
 *     deal_not_in_vault         → queue, deal_not_in_vault: true
 *     not_deal                  → not_filed (this queued row should never have been kept
 *                                 at all — the ideal system drops it rather than asking)
 *
 *   deal-recall (classifier confidence; verdict just echoes system_status, so the
 *   real signal is correct_deal_id)
 *     filed_correct, bulk, not_deal, unfiled_transaction → file to correct_deal_id
 *     ambiguous                 → queue (the classifier itself found two deals named in
 *                                 one message; neither is more right than the other)
 */
export function mapVerdictToExpectation(row: MailAuditRow, slice: string): MappedExpectation {
  const correctDealId = row.correct_deal_id || null
  const systemDealId = row.system_deal_id || null
  const dealNotInVault = !!row.deal_not_in_vault
  const expectCycleId = row.expect_cycle_id || row.correct_cycle_id || null
  const v = String(row.verdict ?? '').trim()

  const anomalyQueue = (why: string): MappedExpectation => ({ ...queued(dealNotInVault), anomaly: why })

  switch (v) {
    case 'correct':
      if (correctDealId || systemDealId) return fileTo(correctDealId ?? systemDealId)
      return anomalyQueue('correct with neither correct_deal_id nor system_deal_id')
    case 'should_not_file':
      return notFiled()
    case 'wrong_deal':
      if (dealNotInVault) return queued(true)
      if (correctDealId) return fileTo(correctDealId)
      return anomalyQueue('wrong_deal with no correct_deal_id and deal_not_in_vault=false')
    case 'right_deal_wrong_cycle':
      if (correctDealId || systemDealId) return fileTo(correctDealId ?? systemDealId, expectCycleId)
      return anomalyQueue('right_deal_wrong_cycle with neither correct_deal_id nor system_deal_id')

    case 'not_deal_correct':
    case 'bulk_correct':
      return notFiled()
    case 'pertains_to_deal':
      if (dealNotInVault) return queued(true)
      if (correctDealId) return fileTo(correctDealId)
      return anomalyQueue('pertains_to_deal with no correct_deal_id and deal_not_in_vault=false')
    case 'transactional_platform_unknown_property':
      return queued(false)

    case 'file_to':
      if (correctDealId) return fileTo(correctDealId)
      return anomalyQueue('file_to with no correct_deal_id')
    case 'genuinely_needs_person':
      return queued(false)
    case 'deal_not_in_vault':
      return queued(true)

    case 'ambiguous':
      if (slice === 'deal-recall') return queued(false)
      return anomalyQueue('unexpected verdict "ambiguous" outside deal-recall')

    case 'filed_correct':
    case 'bulk':
    case 'unfiled_transaction':
      if (slice === 'deal-recall') {
        if (correctDealId ?? systemDealId) return fileTo(correctDealId ?? systemDealId)
        return anomalyQueue(`${v} (deal-recall) with no correct_deal_id or system_deal_id`)
      }
      return anomalyQueue(`unexpected verdict "${v}" outside deal-recall (slice ${slice})`)

    case 'not_deal':
      if (slice === 'deal-recall') {
        if (correctDealId ?? systemDealId) return fileTo(correctDealId ?? systemDealId)
        return anomalyQueue('not_deal (deal-recall) with no correct_deal_id or system_deal_id')
      }
      // Elsewhere (the queue slice) "not_deal" means the row should never
      // have been kept at all.
      return notFiled()

    default:
      return anomalyQueue(`unmapped verdict "${v}" in slice "${slice}"`)
  }
}

export type GoldenJudgment = {
  mailbox: string
  gmail_id: string
  slice: string
  confidence: GoldenConfidence
  mapped: MappedExpectation
}

export type GoldenConflict = {
  mailbox: string
  gmail_id: string
  judgments: Array<{ slice: string; confidence: GoldenConfidence; expect: GoldenExpectation; deal_id: string | null; deal_not_in_vault: boolean }>
  resolved: GoldenRow
  reason: string
}

export type GoldenAnomaly = { mailbox: string; gmail_id: string; slice: string; anomaly: string }

function signature(m: MappedExpectation): string {
  return `${m.expect}:${m.dealId ?? ''}:${m.dealNotInVault}:${m.expectCycleId ?? ''}`
}

function toGoldenRow(j: GoldenJudgment): GoldenRow {
  const row: GoldenRow = {
    mailbox: j.mailbox,
    gmail_id: j.gmail_id,
    expect: j.mapped.expect,
    deal_id: j.mapped.dealId,
    deal_not_in_vault: j.mapped.dealNotInVault,
    slice: j.slice,
    confidence: j.confidence,
  }
  if (j.mapped.expectCycleId) row.expect_cycle_id = j.mapped.expectCycleId
  return row
}

/**
 * Dedupe judgments by (mailbox, gmail_id) — the same message often lands in
 * more than one slice (a hand slice's own sample, deal-recall's classifier
 * sweep, and an adversarial `verify` re-check can all touch it). When every
 * judgment for a key agrees, keep one row, preferring the most-trusted
 * confidence's slice label (`CONFIDENCE_RANK`: verified < hand < classifier).
 * When they disagree, the most-trusted tier present wins; if that tier itself
 * has more than one row and they disagree with EACH OTHER (never seen in the
 * 2026-09-24 audit or its adversarial re-check, but handled rather than
 * assumed away) the safe default is `queue`. Every disagreement is returned
 * in `conflicts` for a person to see.
 */
export function buildGoldenRows(judgments: readonly GoldenJudgment[]): {
  rows: GoldenRow[]
  conflicts: GoldenConflict[]
  anomalies: GoldenAnomaly[]
} {
  const anomalies: GoldenAnomaly[] = []
  const groups = new Map<string, GoldenJudgment[]>()
  for (const j of judgments) {
    if (j.mapped.anomaly) anomalies.push({ mailbox: j.mailbox, gmail_id: j.gmail_id, slice: j.slice, anomaly: j.mapped.anomaly })
    const key = `${j.mailbox}|${j.gmail_id}`
    const list = groups.get(key) ?? []
    list.push(j)
    groups.set(key, list)
  }

  const rows: GoldenRow[] = []
  const conflicts: GoldenConflict[] = []

  for (const list of groups.values()) {
    const bySig = new Map<string, GoldenJudgment[]>()
    for (const j of list) {
      const s = signature(j.mapped)
      const arr = bySig.get(s) ?? []
      arr.push(j)
      bySig.set(s, arr)
    }
    if (bySig.size === 1) {
      const winner = [...list].sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence])[0]
      rows.push(toGoldenRow(winner))
      continue
    }

    const bestRank = Math.min(...list.map((j) => CONFIDENCE_RANK[j.confidence]))
    const bestTier = list.filter((j) => CONFIDENCE_RANK[j.confidence] === bestRank)
    const bestSigs = new Set(bestTier.map((j) => signature(j.mapped)))
    let chosen: GoldenJudgment
    let reason: string
    if (bestSigs.size === 1) {
      chosen = bestTier[0]
      reason = `${chosen.confidence} judgment overrides a disagreeing lower-confidence judgment`
    } else {
      chosen = { mailbox: bestTier[0].mailbox, gmail_id: bestTier[0].gmail_id, slice: bestTier[0].slice, confidence: bestTier[0].confidence, mapped: queued(false) }
      reason = `${bestTier[0].confidence}-tier judgments disagreed with each other; defaulted to queue`
    }
    rows.push(toGoldenRow(chosen))
    conflicts.push({
      mailbox: list[0].mailbox,
      gmail_id: list[0].gmail_id,
      judgments: list.map((j) => ({ slice: j.slice, confidence: j.confidence, expect: j.mapped.expect, deal_id: j.mapped.dealId, deal_not_in_vault: j.mapped.dealNotInVault })),
      resolved: toGoldenRow(chosen),
      reason,
    })
  }

  return { rows, conflicts, anomalies }
}

// ── scoring a production decision against a golden row ────────────────────

/** `indexGmailMessage(..., dryRun: true)`'s `status`, collapsed to what scoring needs. */
export type ProductionStatus = 'filed' | 'ambiguous' | 'unfiled_transaction' | 'not_deal' | 'bulk' | 'error'

export type EvalOutcome =
  | 'TP' // file -> filed to the right deal
  | 'WRONG' // file -> filed to a different deal (worst)
  | 'SAFE_QUEUE' // file -> queued (ambiguous/unfiled_transaction) instead of filed
  | 'MISS' // file or queue expected -> dropped (not_deal/bulk)
  | 'FALSE_FILE' // not_filed or queue expected -> filed anyway
  | 'TN' // not_filed -> dropped or queued (both safe)
  | 'TP_QUEUE' // queue -> queued
  | 'ERROR' // the production call itself errored

/** Pure: no network, no randomness. One golden row's expectation vs. one production result. */
export function scoreRow(input: {
  expect: GoldenExpectation
  expectedDealId: string | null
  actualStatus: ProductionStatus
  actualDealId: string | null
}): EvalOutcome {
  const { expect, expectedDealId, actualStatus, actualDealId } = input
  if (actualStatus === 'error') return 'ERROR'
  const filed = actualStatus === 'filed'
  const queuedNow = actualStatus === 'ambiguous' || actualStatus === 'unfiled_transaction'

  if (expect === 'file') {
    if (filed) return actualDealId === expectedDealId ? 'TP' : 'WRONG'
    if (queuedNow) return 'SAFE_QUEUE'
    return 'MISS'
  }
  if (expect === 'not_filed') {
    return filed ? 'FALSE_FILE' : 'TN'
  }
  // expect === 'queue'
  if (queuedNow) return 'TP_QUEUE'
  if (filed) return 'FALSE_FILE'
  return 'MISS'
}

export type EvalRow = {
  mailbox: string
  gmail_id: string
  slice: string
  confidence: GoldenConfidence
  expect: GoldenExpectation
  expectedDealId: string | null
  actualStatus: ProductionStatus
  actualDealId: string | null
  outcome: EvalOutcome
}

export type Summary = {
  total: number
  outcomes: Record<EvalOutcome, number>
  /** TP / (TP + WRONG + FALSE_FILE) — every row the system actually filed. Null with no filed rows. */
  precision: number | null
  /** TP / count(expect === 'file') — every row the golden set expected filed. Null with no such rows. */
  recall: number | null
  wrongDeal: number
  falseFile: number
  /** Share of rows the system left in the queue (ambiguous/unfiled_transaction), of all rows evaluated. */
  queueRate: number
}

const EMPTY_OUTCOMES: Record<EvalOutcome, number> = { TP: 0, WRONG: 0, SAFE_QUEUE: 0, MISS: 0, FALSE_FILE: 0, TN: 0, TP_QUEUE: 0, ERROR: 0 }

/** Pure aggregate over a set of scored rows — the numbers `tc-mail-eval.ts` prints, factored out so they're testable without a Gmail call. */
export function summarizeRows(rows: readonly Pick<EvalRow, 'expect' | 'actualStatus' | 'outcome'>[]): Summary {
  const outcomes: Record<EvalOutcome, number> = { ...EMPTY_OUTCOMES }
  let filedBySystem = 0
  let expectedFile = 0
  let queuedBySystem = 0
  for (const r of rows) {
    outcomes[r.outcome]++
    if (r.actualStatus === 'filed') filedBySystem++
    if (r.actualStatus === 'ambiguous' || r.actualStatus === 'unfiled_transaction') queuedBySystem++
    if (r.expect === 'file') expectedFile++
  }
  return {
    total: rows.length,
    outcomes,
    precision: filedBySystem > 0 ? outcomes.TP / filedBySystem : null,
    recall: expectedFile > 0 ? outcomes.TP / expectedFile : null,
    wrongDeal: outcomes.WRONG,
    falseFile: outcomes.FALSE_FILE,
    queueRate: rows.length > 0 ? queuedBySystem / rows.length : 0,
  }
}

/** Groups rows by a key function into a Map of Summary, insertion order preserved. */
export function summarizeBy<T extends { expect: GoldenExpectation; actualStatus: ProductionStatus; outcome: EvalOutcome }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, Summary> {
  const groups = new Map<string, T[]>()
  for (const r of rows) {
    const k = keyOf(r)
    const list = groups.get(k) ?? []
    list.push(r)
    groups.set(k, list)
  }
  const out = new Map<string, Summary>()
  for (const [k, list] of groups) out.set(k, summarizeRows(list))
  return out
}
