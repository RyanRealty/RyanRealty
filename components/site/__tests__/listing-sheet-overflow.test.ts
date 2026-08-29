import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SHEET = readFileSync(join(ROOT, 'components/site/v3/V3Sheet.css'), 'utf8')
const FIELD = readFileSync(join(ROOT, 'components/site/v3/V3Field.css'), 'utf8')
const LISTING = readFileSync(join(ROOT, 'components/site/listing-detail/listing-detail.css'), 'utf8')

describe('listing sheet 390 overflow contract', () => {
  it('page sheet children can shrink below max-content', () => {
    expect(SHEET).toMatch(
      /\.v3\.v3-sheet\.v3-sheet--page\s*\{[^}]*min-width:\s*0/,
    )
    expect(SHEET).toMatch(
      /\.v3\.v3-sheet\.v3-sheet--page\s*>\s*\*\s*\{[^}]*min-width:\s*0/,
    )
    expect(SHEET).toMatch(
      /\.v3\.v3-sheet\.v3-sheet--page\s*>\s*\*\s*\{[^}]*max-width:\s*100%/,
    )
  })

  it('Field plot and disclosure cannot grow a parent past the sheet', () => {
    expect(FIELD).toMatch(/\.v3\.v3-field\s*\{[^}]*min-width:\s*0/)
    expect(FIELD).toMatch(/\.v3\.v3-field\s*\{[^}]*width:\s*100%/)
    expect(FIELD).toMatch(/\.v3-field__note\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(LISTING).toMatch(
      /\.listing-detail\s+\.v3-sheet\s+\.v3\.v3-field\s*\{[^}]*max-width:\s*100%/,
    )
  })

  it('facts and CTAs stay inside the 390 sheet', () => {
    expect(LISTING).toMatch(
      /\.listing-detail\s+\.listing-price-cta--facts\s*\{[^}]*min-width:\s*0/,
    )
    expect(LISTING).toMatch(
      /\.listing-detail\s+\.listing-price-cta-facts\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    )
    expect(LISTING).toMatch(
      /\.listing-detail\s+\.listing-price-cta-actions\s*\{[^}]*flex-direction:\s*column/,
    )
  })
})
