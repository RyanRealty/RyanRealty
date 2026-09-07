/**
 * A failed rebuild may not leave a row wearing a status it can no longer back
 * up.
 *
 * `recordBuildFailure` clears html_content, html_path, render_args, citations,
 * the list figures and the comps — everything that makes a document — and left
 * `status` exactly where it was. Three live rows on 2026-09-07 read `finalized`
 * with nothing behind them, so the admin queue offered Send on a document that
 * `canOpenCmaDocument` could not open.
 *
 * Tested here: the rule itself, and that the failure path actually applies it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { statusAfterBuildFailure } from '@/lib/cma/build-summary'

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

describe('the failure path applies it', () => {
  it('reads the row status before the clear and writes the fallback with it', () => {
    const read = src.indexOf('const existing = await getCmaAdminReviewRowBySlug(slug)')
    const decide = src.indexOf('const nextStatus = statusAfterBuildFailure(')
    const clear = src.indexOf('const clearFields = {')
    const write = src.indexOf('...(nextStatus ? { status: nextStatus } : {})')
    expect(read).toBeGreaterThan(0)
    expect(decide).toBeGreaterThan(read)
    expect(clear).toBeGreaterThan(decide)
    expect(write).toBeGreaterThan(clear)
  })

  it('still clears every field that makes the row look like a document', () => {
    for (const field of [
      'html_content: null',
      "html_path: ''",
      'render_args: null',
      'citations: null',
      'recommended_list: null',
      'value_low: null',
      'value_high: null',
      'comps_count: 0',
    ]) {
      expect(src).toContain(field)
    }
  })
})
