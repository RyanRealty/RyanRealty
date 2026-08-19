import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'lib/data/cma/documents.ts'), 'utf8')

describe('CMA admin review read stays off the blobs', () => {
  it('getCmaAdminReviewRowBySlug never selects html_content, citations, or render_args', () => {
    expect(SRC).toMatch(/CMA_ADMIN_REVIEW_COLUMNS/)
    expect(SRC).toMatch(/html_path/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*html_content/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*citations/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*render_args/)
  })
})
