import { describe, expect, it } from 'vitest'
import { prospectDetailHref, prospectQueueReviewLabel } from './detail-href'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('prospectDetailHref', () => {
  it('encodes FSBO urls once for the path segment', () => {
    expect(prospectDetailHref('fsbo', 'https://example.com/a/b')).toBe(
      '/admin/prospecting/fsbo/https%3A%2F%2Fexample.com%2Fa%2Fb',
    )
  })

  it('passes listing keys through for expired', () => {
    expect(prospectDetailHref('expired', '22012345')).toBe('/admin/prospecting/expired/22012345')
  })
})

describe('prospectQueueReviewLabel', () => {
  it('uses Review for expired sendable rows (never Review & send)', () => {
    expect(prospectQueueReviewLabel('expired')).toBe('Review')
    expect(prospectQueueReviewLabel('expired')).not.toMatch(/send/i)
  })

  it('uses Review CMA for FSBO sendable rows', () => {
    expect(prospectQueueReviewLabel('fsbo')).toBe('Review CMA')
  })

  it('worklist page never ships Review & send copy', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/admin/(protected)/prospecting/page.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/Review\s*&\s*send/i)
    expect(src).toMatch(/ProspectDetailHardLink/)
    expect(src).toMatch(/prospectQueueReviewLabel/)
  })
})
