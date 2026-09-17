import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONFIG = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

describe('admin/bpo NFT excludes', () => {
  it('keeps googleapis and the PDF/chromium stack off the review lambda', () => {
    expect(CONFIG).toContain("'app/admin/(protected)/bpo/[slug]/page'")
    expect(CONFIG).toContain('BPO_LAMBDA_TRACE_EXCLUDES')
    expect(CONFIG).toContain('REPO_DUMP_TRACE_EXCLUDES')
    expect(CONFIG).toContain('./node_modules/googleapis/**')
    expect(CONFIG).toContain('./node_modules/pdfjs-dist/**')
    expect(CONFIG).toContain('./node_modules/@napi-rs/canvas/**')
    expect(CONFIG).toContain('./design_system/**')
    expect(CONFIG).toContain('./scratch/**')
    expect(CONFIG).toContain('./public/cmas/**')
  })

  it('spreads repo-dump excludes onto * — per-route keys do not apply under Turbopack', () => {
    const star = CONFIG.split("'*': [")[1]?.split('],')[0] ?? ''
    expect(star).toContain('...REPO_DUMP_TRACE_EXCLUDES')
    expect(star).toContain('./public/images/**')
  })
})
