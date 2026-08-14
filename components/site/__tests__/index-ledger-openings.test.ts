import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Page-grade v2.4 class number-as-hero + hidden record on index pages.
 * The named rows fill the fold. The count is a Ledger caption.
 */
const ROOT = process.cwd()

const INDEX_PAGES = [
  'app/blog/page.tsx',
  'app/central-oregon/events/page.tsx',
  'app/central-oregon/trails/page.tsx',
  'app/central-oregon/venues/page.tsx',
  'app/parks/page.tsx',
  'app/schools/page.tsx',
] as const

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('index pages open on the rows', () => {
  it.each(INDEX_PAGES)('%s mounts a page Ledger and never an Instrument', (rel) => {
    const src = read(rel)
    expect(src).toContain('<V3Ledger')
    expect(src).toMatch(/headingLevel=\{1\}/)
    expect(src).toMatch(/note=\{v3Text\(/)
    expect(src).not.toMatch(/\bV3Instrument\b/)
  })

  it.each(INDEX_PAGES)('%s keeps file and table names off the visitor fold', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(/data\/co-(events|trails|venues|parks|schools)\.ts/)
    expect(src).not.toContain('blog_posts')
  })

  it.each(INDEX_PAGES)('%s keeps Value my home off the opening Ledger', (rel) => {
    const src = read(rel)
    const ledgers = [...src.matchAll(/<V3Ledger[\s\S]*?\/>/g)].map((match) => match[0])
    expect(ledgers.length).toBeGreaterThan(0)
    for (const ledger of ledgers) {
      expect(ledger).not.toMatch(/Value my home/)
      expect(ledger).not.toMatch(/valuationHref/)
    }
  })
})
