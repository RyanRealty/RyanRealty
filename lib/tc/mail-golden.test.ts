import { describe, expect, it } from 'vitest'
import {
  buildGoldenRows,
  confidenceForSlice,
  mapVerdictToExpectation,
  normalizeMailbox,
  scoreRow,
  summarizeRows,
  type GoldenJudgment,
  type MailAuditRow,
} from './mail-golden'

// ── fixtures ────────────────────────────────────────────────────────────────

const DEAL_A = '2f376f00-2132-46a6-b621-db86351d4472'
const DEAL_B = '3616bd0a-d653-4819-b8f9-1c9925fee99e'

function row(p: Partial<MailAuditRow> & { verdict: string }): MailAuditRow {
  return {
    mailbox: 'matt@ryan-realty.com',
    gmail_id: '18b149636c6e401a',
    system_status: null,
    system_deal_id: null,
    correct_deal_id: null,
    deal_not_in_vault: false,
    ...p,
  }
}

// ── normalizeMailbox / confidenceForSlice ───────────────────────────────────

describe('normalizeMailbox', () => {
  it('keeps a full address as-is (lowercased)', () => {
    expect(normalizeMailbox('Matt@Ryan-Realty.com')).toBe('matt@ryan-realty.com')
  })
  it('resolves the deal-recall slug form to the full broker address', () => {
    expect(normalizeMailbox('matt')).toBe('matt@ryan-realty.com')
    expect(normalizeMailbox('rebecca')).toBe('rebeccapeterson@ryan-realty.com')
    expect(normalizeMailbox('paul')).toBe('paul@ryan-realty.com')
  })
})

describe('confidenceForSlice', () => {
  it('is classifier only for deal-recall, verified only for verify', () => {
    expect(confidenceForSlice('deal-recall')).toBe('classifier')
    expect(confidenceForSlice('verify')).toBe('verified')
    for (const slice of ['filed-matt', 'filed-rp', 'missed-notdeal', 'missed-bulk', 'queue']) {
      expect(confidenceForSlice(slice)).toBe('hand')
    }
  })
})

// ── mapVerdictToExpectation: one case per real verdict word seen in the
// 2026-09-24 audit's six rows.json files ───────────────────────────────────

describe('mapVerdictToExpectation', () => {
  it('filed-matt/filed-rp: correct files to the system deal when no correct_deal_id is given', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'correct', system_deal_id: DEAL_A }), 'filed-matt')
    expect(m).toMatchObject({ expect: 'file', dealId: DEAL_A, dealNotInVault: false })
  })

  it('filed-matt/filed-rp: correct prefers an explicit correct_deal_id over system_deal_id', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'correct', system_deal_id: DEAL_A, correct_deal_id: DEAL_B }), 'filed-rp')
    expect(m.dealId).toBe(DEAL_B)
  })

  it('filed-matt/filed-rp: should_not_file -> not_filed', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'should_not_file', system_deal_id: DEAL_A }), 'filed-matt')
    expect(m).toMatchObject({ expect: 'not_filed', dealId: null, dealNotInVault: false })
  })

  it('wrong_deal with a correct_deal_id files to that deal', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'wrong_deal', system_deal_id: DEAL_A, correct_deal_id: DEAL_B }), 'filed-matt')
    expect(m).toMatchObject({ expect: 'file', dealId: DEAL_B })
  })

  it('wrong_deal with deal_not_in_vault queues instead of guessing a deal', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'wrong_deal', system_deal_id: DEAL_A, deal_not_in_vault: true }), 'filed-matt')
    expect(m).toMatchObject({ expect: 'queue', dealId: null, dealNotInVault: true })
  })

  it('right_deal_wrong_cycle files to the same (system) deal', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'right_deal_wrong_cycle', system_deal_id: DEAL_A }), 'filed-matt')
    expect(m).toMatchObject({ expect: 'file', dealId: DEAL_A })
  })

  it('right_deal_wrong_cycle records an explicit cycle hint when the row gives one', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'right_deal_wrong_cycle', system_deal_id: DEAL_A, expect_cycle_id: 'cycle-9' } as MailAuditRow), 'filed-matt')
    expect(m.expectCycleId).toBe('cycle-9')
  })

  it('missed-notdeal/missed-bulk: not_deal_correct and bulk_correct -> not_filed', () => {
    expect(mapVerdictToExpectation(row({ verdict: 'not_deal_correct' }), 'missed-notdeal').expect).toBe('not_filed')
    expect(mapVerdictToExpectation(row({ verdict: 'bulk_correct' }), 'missed-bulk').expect).toBe('not_filed')
  })

  it('pertains_to_deal files to correct_deal_id', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'pertains_to_deal', correct_deal_id: DEAL_A }), 'missed-notdeal')
    expect(m).toMatchObject({ expect: 'file', dealId: DEAL_A })
  })

  it('pertains_to_deal with deal_not_in_vault queues', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'pertains_to_deal', deal_not_in_vault: true }), 'missed-bulk')
    expect(m).toMatchObject({ expect: 'queue', dealId: null, dealNotInVault: true })
  })

  it('transactional_platform_unknown_property queues rather than staying silent bulk noise', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'transactional_platform_unknown_property' }), 'missed-bulk')
    expect(m).toMatchObject({ expect: 'queue', dealId: null, dealNotInVault: false })
  })

  it('queue slice: file_to files to correct_deal_id', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'file_to', correct_deal_id: DEAL_A }), 'queue')
    expect(m).toMatchObject({ expect: 'file', dealId: DEAL_A })
  })

  it('queue slice: genuinely_needs_person -> queue', () => {
    expect(mapVerdictToExpectation(row({ verdict: 'genuinely_needs_person' }), 'queue').expect).toBe('queue')
  })

  it('queue slice: deal_not_in_vault verdict -> queue with the flag set', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'deal_not_in_vault' }), 'queue')
    expect(m).toMatchObject({ expect: 'queue', dealId: null, dealNotInVault: true })
  })

  it('queue slice: not_deal means the row should never have been kept at all -> not_filed', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'not_deal' }), 'queue')
    expect(m).toMatchObject({ expect: 'not_filed', dealId: null })
  })

  it('deal-recall: not_deal/bulk/unfiled_transaction/filed_correct all file to correct_deal_id (verdict just echoes system_status there)', () => {
    for (const verdict of ['not_deal', 'bulk', 'unfiled_transaction', 'filed_correct']) {
      const m = mapVerdictToExpectation(row({ verdict, correct_deal_id: DEAL_A }), 'deal-recall')
      expect(m).toMatchObject({ expect: 'file', dealId: DEAL_A })
    }
  })

  it('deal-recall: ambiguous queues (the classifier found two deals named in one message)', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'ambiguous', correct_deal_id: DEAL_A }), 'deal-recall')
    expect(m).toMatchObject({ expect: 'queue', dealId: null })
  })

  it('an unknown verdict is never dropped silently: it maps to queue and carries an anomaly note', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'some_new_word_a_future_audit_invents' }), 'filed-matt')
    expect(m.expect).toBe('queue')
    expect(m.anomaly).toBeTruthy()
  })

  it('correct with neither correct_deal_id nor system_deal_id is an anomaly, not a guess at a null deal', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'correct', system_deal_id: null, correct_deal_id: null }), 'filed-matt')
    expect(m.expect).toBe('queue')
    expect(m.dealId).toBeNull()
    expect(m.anomaly).toContain('correct')
  })

  it('pertains_to_deal with neither correct_deal_id nor deal_not_in_vault is an anomaly, not a guess', () => {
    const m = mapVerdictToExpectation(row({ verdict: 'pertains_to_deal' }), 'missed-notdeal')
    expect(m.expect).toBe('queue')
    expect(m.anomaly).toContain('pertains_to_deal')
  })
})

// ── buildGoldenRows: dedupe + conflict resolution ───────────────────────────

function judgment(p: Partial<GoldenJudgment> & Pick<GoldenJudgment, 'mapped'>): GoldenJudgment {
  return { mailbox: 'matt@ryan-realty.com', gmail_id: 'abc123', slice: 'filed-matt', confidence: 'hand', ...p }
}

describe('buildGoldenRows', () => {
  it('collapses agreeing judgments across slices into one row', () => {
    const { rows, conflicts, anomalies } = buildGoldenRows([
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expect: 'file', deal_id: DEAL_A, slice: 'filed-matt', confidence: 'hand' })
    expect(conflicts).toHaveLength(0)
    expect(anomalies).toHaveLength(0)
  })

  it('a hand judgment overrides a disagreeing classifier judgment, and the disagreement is reported', () => {
    const { rows, conflicts } = buildGoldenRows([
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'not_filed', dealId: null, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expect: 'not_filed', deal_id: null, confidence: 'hand' })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].judgments).toHaveLength(2)
  })

  it('two disagreeing classifier judgments with no hand judgment default to queue and are reported', () => {
    const { rows, conflicts } = buildGoldenRows([
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_B, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expect: 'queue', deal_id: null })
    expect(conflicts).toHaveLength(1)
  })

  it('a verified judgment overrides both a disagreeing hand judgment and a disagreeing classifier judgment', () => {
    const { rows, conflicts } = buildGoldenRows([
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'verify', confidence: 'verified', mapped: { expect: 'file', dealId: DEAL_B, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expect: 'file', deal_id: DEAL_B, slice: 'verify', confidence: 'verified' })
    expect(conflicts).toHaveLength(1)
  })

  it('the fallback row never mixes one judgment\'s slice with another judgment\'s confidence, even when the first judgment in the list is not the winning tier', () => {
    // A lower-confidence (classifier) judgment listed FIRST, then two
    // disagreeing hand judgments — the winning tier is hand, but naively
    // reading slice/confidence from different array entries would pair a
    // hand confidence with the classifier's own slice.
    const { rows } = buildGoldenRows([
      judgment({ slice: 'deal-recall', confidence: 'classifier', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'filed-rp', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_B, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].confidence).toBe('hand')
    expect(['filed-matt', 'filed-rp']).toContain(rows[0].slice)
  })

  it('two judgments that agree on everything except an expect_cycle_id are treated as a real disagreement, not silently merged', () => {
    const { rows, conflicts } = buildGoldenRows([
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: 'cycle-1' } }),
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(conflicts).toHaveLength(1)
  })

  it('a verified judgment agreeing with hand and classifier produces one clean row with no conflict', () => {
    const { rows, conflicts } = buildGoldenRows([
      judgment({ slice: 'filed-matt', confidence: 'hand', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ slice: 'verify', confidence: 'verified', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expect: 'file', deal_id: DEAL_A, slice: 'verify', confidence: 'verified' })
    expect(conflicts).toHaveLength(0)
  })

  it('different (mailbox, gmail_id) keys never merge', () => {
    const { rows } = buildGoldenRows([
      judgment({ gmail_id: 'aaa', mapped: { expect: 'file', dealId: DEAL_A, dealNotInVault: false, expectCycleId: null } }),
      judgment({ gmail_id: 'bbb', mapped: { expect: 'not_filed', dealId: null, dealNotInVault: false, expectCycleId: null } }),
    ])
    expect(rows).toHaveLength(2)
  })

  it('surfaces an anomaly row from mapVerdictToExpectation without dropping it', () => {
    const anomalyMapped = mapVerdictToExpectation(row({ verdict: 'not_a_real_verdict' }), 'filed-matt')
    const { rows, anomalies } = buildGoldenRows([judgment({ mapped: anomalyMapped })])
    expect(rows).toHaveLength(1)
    expect(anomalies).toHaveLength(1)
  })
})

// ── scoreRow ─────────────────────────────────────────────────────────────

describe('scoreRow', () => {
  it('file -> filed to the expected deal is TP', () => {
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'filed', actualDealId: DEAL_A })).toBe('TP')
  })
  it('file -> filed to a different deal is WRONG, the worst outcome', () => {
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'filed', actualDealId: DEAL_B })).toBe('WRONG')
  })
  it('file -> queued is SAFE_QUEUE, not a miss', () => {
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'ambiguous', actualDealId: null })).toBe('SAFE_QUEUE')
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'unfiled_transaction', actualDealId: null })).toBe('SAFE_QUEUE')
  })
  it('file -> dropped (not_deal/bulk) is MISS', () => {
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'not_deal', actualDealId: null })).toBe('MISS')
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'bulk', actualDealId: null })).toBe('MISS')
  })
  it('not_filed -> filed anyway is FALSE_FILE', () => {
    expect(scoreRow({ expect: 'not_filed', expectedDealId: null, actualStatus: 'filed', actualDealId: DEAL_A })).toBe('FALSE_FILE')
  })
  it('not_filed -> dropped or queued is TN either way', () => {
    expect(scoreRow({ expect: 'not_filed', expectedDealId: null, actualStatus: 'not_deal', actualDealId: null })).toBe('TN')
    expect(scoreRow({ expect: 'not_filed', expectedDealId: null, actualStatus: 'bulk', actualDealId: null })).toBe('TN')
    expect(scoreRow({ expect: 'not_filed', expectedDealId: null, actualStatus: 'ambiguous', actualDealId: null })).toBe('TN')
  })
  it('queue -> queued is TP_QUEUE', () => {
    expect(scoreRow({ expect: 'queue', expectedDealId: null, actualStatus: 'unfiled_transaction', actualDealId: null })).toBe('TP_QUEUE')
  })
  it('queue -> filed is FALSE_FILE', () => {
    expect(scoreRow({ expect: 'queue', expectedDealId: null, actualStatus: 'filed', actualDealId: DEAL_A })).toBe('FALSE_FILE')
  })
  it('queue -> dropped is MISS', () => {
    expect(scoreRow({ expect: 'queue', expectedDealId: null, actualStatus: 'not_deal', actualDealId: null })).toBe('MISS')
  })
  it('any expectation -> error is ERROR', () => {
    expect(scoreRow({ expect: 'file', expectedDealId: DEAL_A, actualStatus: 'error', actualDealId: null })).toBe('ERROR')
    expect(scoreRow({ expect: 'not_filed', expectedDealId: null, actualStatus: 'error', actualDealId: null })).toBe('ERROR')
    expect(scoreRow({ expect: 'queue', expectedDealId: null, actualStatus: 'error', actualDealId: null })).toBe('ERROR')
  })
})

// ── summarizeRows ────────────────────────────────────────────────────────

describe('summarizeRows', () => {
  it('computes precision as TP / everything the system filed', () => {
    const s = summarizeRows([
      { expect: 'file', actualStatus: 'filed', outcome: 'TP' },
      { expect: 'file', actualStatus: 'filed', outcome: 'WRONG' },
      { expect: 'not_filed', actualStatus: 'filed', outcome: 'FALSE_FILE' },
    ])
    expect(s.precision).toBeCloseTo(1 / 3)
  })

  it('computes recall as TP / everything the golden set expected filed', () => {
    const s = summarizeRows([
      { expect: 'file', actualStatus: 'filed', outcome: 'TP' },
      { expect: 'file', actualStatus: 'not_deal', outcome: 'MISS' },
      { expect: 'file', actualStatus: 'ambiguous', outcome: 'SAFE_QUEUE' },
      { expect: 'not_filed', actualStatus: 'not_deal', outcome: 'TN' },
    ])
    expect(s.recall).toBeCloseTo(1 / 3)
  })

  it('is null (not zero) for precision/recall with no denominator, so an empty slice never reads as 0%', () => {
    const s = summarizeRows([{ expect: 'not_filed', actualStatus: 'not_deal', outcome: 'TN' }])
    expect(s.precision).toBeNull()
    expect(s.recall).toBeNull()
  })

  it('counts wrongDeal and falseFile directly from the outcome tally', () => {
    const s = summarizeRows([
      { expect: 'file', actualStatus: 'filed', outcome: 'WRONG' },
      { expect: 'file', actualStatus: 'filed', outcome: 'WRONG' },
      { expect: 'not_filed', actualStatus: 'filed', outcome: 'FALSE_FILE' },
    ])
    expect(s.wrongDeal).toBe(2)
    expect(s.falseFile).toBe(1)
  })

  it('computes queueRate over every row evaluated, not just expect=queue rows', () => {
    const s = summarizeRows([
      { expect: 'file', actualStatus: 'ambiguous', outcome: 'SAFE_QUEUE' },
      { expect: 'file', actualStatus: 'filed', outcome: 'TP' },
      { expect: 'queue', actualStatus: 'unfiled_transaction', outcome: 'TP_QUEUE' },
      { expect: 'not_filed', actualStatus: 'not_deal', outcome: 'TN' },
    ])
    expect(s.queueRate).toBeCloseTo(2 / 4)
  })
})
