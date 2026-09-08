import { describe, it, expect } from 'vitest'
import { slugToTitle } from './subdivision-registry'

/**
 * A plat with no registry entry gets its display name built from the slug, and
 * that name reaches the H1, the breadcrumb, the by-the-numbers heading, every
 * Q&A question AND the FAQPage JSON-LD Google reads. Before 2026-09-08 the
 * builder capitalised every word, so /subdivisions/ridge-at-eagle-crest
 * published "Ridge At Eagle Crest" in all of them — found by a separate taste
 * evaluator, and general to every plat name carrying a connector word.
 */
describe('slugToTitle — English title case, not per-word capitalisation', () => {
  it('leaves a connector word lower in the middle of a name', () => {
    expect(slugToTitle('ridge-at-eagle-crest')).toBe('Ridge at Eagle Crest')
    expect(slugToTitle('inn-of-the-7th-mountain')).toBe('Inn of the 7th Mountain')
    expect(slugToTitle('vista-de-los-pinos')).toBe('Vista de los Pinos')
  })

  it('capitalises the first word even when it is a connector', () => {
    expect(slugToTitle('the-ridge')).toBe('The Ridge')
    expect(slugToTitle('at-the-river')).toBe('At the River')
  })

  it('capitalises the last word even when it is a connector, so a name never dangles', () => {
    expect(slugToTitle('ridge-at')).toBe('Ridge At')
  })

  it('leaves ordinary names exactly as they were', () => {
    expect(slugToTitle('black-butte-ranch')).toBe('Black Butte Ranch')
    expect(slugToTitle('crooked-river-ranch')).toBe('Crooked River Ranch')
    expect(slugToTitle('awbrey-glen')).toBe('Awbrey Glen')
  })

  it('is total on the empty and single-word cases', () => {
    expect(slugToTitle('')).toBe('')
    expect(slugToTitle('tetherow')).toBe('Tetherow')
  })
})
