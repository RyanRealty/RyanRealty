import { describe, expect, it } from 'vitest'
import { reconcileShips, formatReconcileReport, DEFAULT_IGNORE } from './ship-reconcile'

const c = (sha: string, subject: string, date = '2026-08-25') => ({ sha, subject, date })

describe('reconcileShips', () => {
  it('flags a shipped commit with no node and no ledger row', () => {
    const r = reconcileShips({
      commits: [c('3f04ee4cabc', 'fix(bpo): cite the real store')],
      ledgerShas: [],
      nodeEvidence: [],
    })
    expect(r.unrepresented).toHaveLength(1)
    expect(r.unrepresented[0]!.sha).toBe('3f04ee4cabc')
  })

  it('counts a commit as represented when a ledger row cites it', () => {
    const r = reconcileShips({
      commits: [c('3f04ee4cabc', 'fix(bpo): cite the real store')],
      ledgerShas: ['3f04ee4c00a16163a4b7fffd676ab557ab0bd5ab'],
      nodeEvidence: [],
    })
    expect(r.unrepresented).toHaveLength(0)
    expect(r.represented).toBe(1)
  })

  it('counts a commit as represented when a node evidence blob cites it', () => {
    const r = reconcileShips({
      commits: [c('bb604b78zzz', 'fix(tests): unique gate sandboxes')],
      ledgerShas: [],
      nodeEvidence: ['verified on origin/main bb604b78 with gates 182/182'],
    })
    expect(r.unrepresented).toHaveLength(0)
  })

  // The failure this exists to name: not one missing node, but a loop that has
  // stopped seeing the shop entirely.
  it('says so when EVERY shippable commit is invisible', () => {
    const r = reconcileShips({
      commits: [c('aaaaaaa1', 'feat(market): a'), c('bbbbbbb2', 'fix(crm): b')],
      ledgerShas: [],
      nodeEvidence: [],
    })
    expect(r.totallyBlind).toBe(true)
    expect(formatReconcileReport(r, 8).join('\n')).toContain('EVERY shippable commit')
  })

  it('is not blind when at least one commit is represented', () => {
    const r = reconcileShips({
      commits: [c('aaaaaaa1', 'feat(market): a'), c('bbbbbbb2', 'fix(crm): b')],
      ledgerShas: ['aaaaaaa1'],
      nodeEvidence: [],
    })
    expect(r.totallyBlind).toBe(false)
  })

  it('ignores docs and chore — a node about writing a note is not work', () => {
    const r = reconcileShips({
      commits: [c('ccccccc3', 'docs(handoff): the session'), c('ddddddd4', 'chore: bump')],
      ledgerShas: [],
      nodeEvidence: [],
    })
    expect(r.scanned).toBe(0)
    expect(r.unrepresented).toHaveLength(0)
    expect(formatReconcileReport(r, 8)[0]).toContain('no shippable commits')
  })

  it('DEFAULT_IGNORE does not swallow feat or fix', () => {
    expect(DEFAULT_IGNORE.test('feat(market): x')).toBe(false)
    expect(DEFAULT_IGNORE.test('fix(crm): x')).toBe(false)
    expect(DEFAULT_IGNORE.test('docs(plan): x')).toBe(true)
  })

  it('a short sha in evidence still matches the full sha', () => {
    const r = reconcileShips({
      commits: [c('1234567890abcdef', 'feat(x): y')],
      ledgerShas: [],
      nodeEvidence: ['shipped as 1234567'],
    })
    expect(r.unrepresented).toHaveLength(0)
  })

  it('reports cleanly when the loop is keeping up', () => {
    const r = reconcileShips({
      commits: [c('aaaaaaa1', 'feat(market): a')],
      ledgerShas: ['aaaaaaa1'],
      nodeEvidence: [],
    })
    expect(formatReconcileReport(r, 8)[0]).toContain('1/1 shipped commits are represented')
  })
})
