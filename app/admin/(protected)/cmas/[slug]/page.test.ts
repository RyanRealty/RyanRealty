import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('admin CMA entity page', () => {
  it('leads with Review CMA before blockers, KPIs, and Open PDF', () => {
    const review = page.indexOf('<CmaReviewDocumentButton')
    const pdf = page.indexOf('Open PDF')
    const kpis = page.indexOf('<ReportNumbers')
    const send = page.indexOf('Review and send')
    const publish = page.indexOf('<CmaPublishControl')
    expect(review).toBeGreaterThan(0)
    expect(review).toBeLessThan(pdf)
    expect(review).toBeLessThan(kpis)
    expect(review).toBeLessThan(send)
    expect(review).toBeLessThan(publish)
    expect(page).toContain('sendLabel')
    expect(page).toContain('Last list')
    expect(page).toContain("from '@/lib/cma/draft-access'")
  })
})
