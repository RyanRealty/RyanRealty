/**
 * A failed rebuild must not destroy the document that already exists.
 *
 * The prior letter, prices and comps stay on the row. Only build_error
 * (and build_failed_at when the column exists) is written.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { composeFailureSummary, statusAfterBuildFailure } from '@/lib/cma/build-summary'

const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

describe('statusAfterBuildFailure', () => {
  it('sends a row that claimed a finished document back to draft', () => {
    expect(statusAfterBuildFailure('finalized')).toBe('draft')
    expect(statusAfterBuildFailure('delivered')).toBe('draft')
    expect(statusAfterBuildFailure('needs_review')).toBe('draft')
    expect(statusAfterBuildFailure('sent')).toBe('draft')
    expect(statusAfterBuildFailure('FINALIZED')).toBe('draft')
  })

  it('leaves an archived row archived — a failed rebuild never revives it', () => {
    expect(statusAfterBuildFailure('archived')).toBeNull()
    expect(statusAfterBuildFailure(' Archived ')).toBeNull()
  })

  it('does not rewrite a status that is already draft', () => {
    expect(statusAfterBuildFailure('draft')).toBeNull()
  })

  it('changes nothing when the status could not be read', () => {
    expect(statusAfterBuildFailure(null)).toBeNull()
    expect(statusAfterBuildFailure(undefined)).toBeNull()
    expect(statusAfterBuildFailure('')).toBeNull()
  })
})

describe('the failure path keeps the prior document', () => {
  it('snapshots before any overwrite and fails the rebuild if the snapshot fails', () => {
    const build = src.indexOf('export async function buildCma')
    const snap = src.indexOf("await snapshotCmaVersion({ slug, reason: 'rebuild' })")
    const fail = src.indexOf('Could not snapshot the current CMA before rebuild')
    const upsert = src.indexOf('upsertCmaRowBySlug', snap)
    expect(build).toBeGreaterThan(0)
    expect(snap).toBeGreaterThan(build)
    expect(fail).toBeGreaterThan(snap)
    expect(upsert).toBeGreaterThan(snap)
  })

  it('writes only the failure reason and does not clear the document', () => {
    const fn = src.slice(src.indexOf('async function recordBuildFailure'), src.indexOf('export async function buildCma'))
    expect(fn).toMatch(/build_error: reason/)
    expect(fn).toMatch(/build_failed_at/)
    expect(fn).not.toMatch(/html_content: null/)
    expect(fn).not.toMatch(/html_path: ''/)
    expect(fn).not.toMatch(/render_args: null/)
    expect(fn).not.toMatch(/citations: null/)
    expect(fn).not.toMatch(/recommended_list: null/)
    expect(fn).not.toMatch(/value_low: null/)
    expect(fn).not.toMatch(/value_high: null/)
    expect(fn).not.toMatch(/comps_count: 0/)
    expect(fn).not.toMatch(/replaceCmaComps\(/)
  })
})

describe('the failure path keeps the reason trail (2026-10-08)', () => {
  it('stores the trace, the review verdicts and the failed hard checks', () => {
    const summary = composeFailureSummary({
      builder: 'b',
      docType: 'expired-audit',
      stage: 'comps',
      error: 'Not enough comparable sales the review would keep. 4 of 6 stayed, and this home needs 5.',
      at: '2026-10-08T03:00:00.000Z',
      trace: ['own plat: 6 sales'],
      review: {
        kept: ['a', 'b', 'c', 'd'],
        verdicts: [{ listingKey: 'e', tier: 'exclude', basis: 'price-tier', reason: 'outside the band' }],
      },
      contractChecks: [
        { id: 'x', severity: 'hard', pass: false, detail: 'failed' },
        { id: 'y', severity: 'hard', pass: true, detail: 'ok' },
        { id: 'z', severity: 'soft', pass: false, detail: 'soft' },
      ],
    })
    expect(summary.failed_at).toBe('2026-10-08T03:00:00.000Z')
    expect(summary.failed_at_stage).toBe('comps')
    expect(summary.trace).toEqual(['own plat: 6 sales'])
    expect((summary.review as { kept: string[] }).kept).toHaveLength(4)
    expect(summary.failed_checks).toEqual([{ id: 'x', severity: 'hard', pass: false, detail: 'failed' }])
  })

  it('merges last_failure onto the prior summary instead of replacing it', () => {
    const fn = src.slice(src.indexOf('async function recordBuildFailure'), src.indexOf('export async function buildCma'))
    expect(fn).toMatch(/composeFailureSummary\(/)
    expect(fn).toMatch(/\.\.\.\(current \?\? \{\}\), last_failure: lastFailure/)
  })

  it('hands the review verdicts to both review failure paths', () => {
    expect(src).toMatch(/review: failureReviewOf\(null, unstable\)/)
    expect(src).toMatch(/review: failureReviewOf\(judgment, null\)/)
  })
})
