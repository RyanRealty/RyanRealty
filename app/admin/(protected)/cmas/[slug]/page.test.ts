import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('admin CMA entity page', () => {
  it('keeps document links quiet after the address, with last list from the prospect row', () => {
    const title = page.indexOf('<EntityTitle>')
    const review = page.indexOf('<CmaReviewDocumentButton')
    const pdf = page.indexOf('Open PDF')
    const kpis = page.indexOf('<ReportNumbers')
    const send = page.indexOf('Review and send')
    const publish = page.indexOf('<CmaPublishControl')
    expect(title).toBeGreaterThan(0)
    expect(review).toBeGreaterThan(title)
    expect(review).toBeLessThan(pdf)
    expect(pdf).toBeLessThan(kpis)
    expect(kpis).toBeLessThan(send)
    expect(send).toBeLessThan(publish)
    expect(page).toContain('sendLabel')
    expect(page).toContain('Last list')
    expect(page).toContain('getCmaProspectAsk')
    expect(page).toContain('resolveTheirPrice')
    expect(page).toContain("from '@/lib/cma/draft-access'")
  })
})
