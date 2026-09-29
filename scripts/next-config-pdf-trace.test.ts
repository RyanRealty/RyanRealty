import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONFIG = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

describe('CMA send path keeps the PDF render stack in its functions', () => {
  it('never excludes puppeteer-core or chromium-min for every lambda', () => {
    const star = CONFIG.split("'*': [")[1]?.split('],')[0] ?? ''
    const code = star.replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('node_modules/puppeteer-core')
    expect(code).not.toContain('node_modules/@sparticuz/chromium-min')
  })

  it('traces the PDF stack into the CMA review page and the drip cron with Turbopack-safe keys', () => {
    expect(CONFIG).toContain("'app/admin/(protected)/cmas/\\\\[slug\\\\]/page'")
    expect(CONFIG).toContain("'app/api/cron/prospecting-first-touch-drip/route'")
    expect(CONFIG).toContain('outputFileTracingIncludes: withPdfRenderIncludes(')
  })

  it('passes ci:pdf-trace-guard', () => {
    const out = execFileSync('node', ['scripts/check-pdf-trace-guard.mjs'], { encoding: 'utf8' })
    expect(out).toContain('ci:pdf-trace-guard: ok')
  })
})
