/**
 * A failed rebuild must not destroy the document that already exists.
 *
 * The prior letter, prices and comps stay on the row. Only build_error
 * (and build_failed_at when the column exists) is written.
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
