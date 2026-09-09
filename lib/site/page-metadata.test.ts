import { describe, expect, it } from 'vitest'
import {
  BRAND_SUFFIX,
  TITLE_BUDGET,
  cleanTitle,
  documentTitle,
  pageMetadata,
  publishPlaceHomesTitle,
} from './page-metadata'

/** The string a visitor's browser tab / the SERP actually shows. */
function rendered(pageTitle: string): string {
  return `${pageTitle}${BRAND_SUFFIX}`
}

describe('publishPlaceHomesTitle', () => {
  it('does not emit Central Oregon, Oregon', () => {
    expect(publishPlaceHomesTitle('8th Street Cottages', 'Central Oregon')).toBe(
      'Homes for Sale in 8th Street Cottages | Central Oregon',
    )
  })

  it('keeps a real city with Oregon', () => {
    expect(publishPlaceHomesTitle('Tetherow', 'Bend')).toBe('Homes for Sale in Tetherow | Bend, Oregon')
  })
})

describe('cleanTitle', () => {
  it('never ends on a dangling & — the token the old regex missed', () => {
    const t = cleanTitle('Hayden Homes Amphitheater | Central Oregon Live Music & Shows')
    expect(t).not.toMatch(/[&+]\s*$/)
    // The region segment the layout suffix already supplies is dropped whole.
    expect(t).toBe('Hayden Homes Amphitheater')
  })

  it('never ends on a dangling & or + when the cut lands on one', () => {
    for (const raw of [
      'Bend Summer Festival Music & Arts Weekend Lineup',
      'Bend Summer Festival Music + Arts Weekend Lineup',
    ]) {
      const t = cleanTitle(raw, 40)
      expect(t.length).toBeLessThanOrEqual(40)
      expect(t).not.toMatch(/[&+]\s*$/)
    }
  })

  it('strips a brand the caller already baked in', () => {
    expect(cleanTitle('Bend home sales archive | Ryan Realty', 60)).toBe('Bend home sales archive')
  })

  it('never returns empty for a brand-only title', () => {
    expect(cleanTitle('Ryan Realty')).toBe('Ryan Realty')
  })
})

describe('documentTitle — one brand line, and no sheared place names', () => {
  it('passes a short title straight through for the layout template to brand', () => {
    expect(documentTitle('Sawyer Park')).toBe('Sawyer Park')
    expect(rendered(documentTitle('Sawyer Park'))).toHaveLength(11 + BRAND_SUFFIX.length)
    expect(rendered(documentTitle('Sawyer Park')).length).toBeLessThanOrEqual(60)
  })

  it('drops a duplicated Central Oregon segment rather than shipping it twice', () => {
    expect(documentTitle('Smith Rock State Park | Central Oregon Parks')).toBe('Smith Rock State Park')
    expect(rendered(documentTitle('Smith Rock State Park | Central Oregon Parks')).match(/Central Oregon/g)).toHaveLength(1)
  })

  it('keeps a long plat name whole instead of shearing it', () => {
    const long = 'Homes for Sale in Rock Ridge Cabin Sites of Black Butte Ranch | Central Oregon'
    const out = rendered(documentTitle(long))
    expect(out).toContain('Black Butte Ranch')
    expect(out.match(/Central Oregon/g)).toHaveLength(1)
  })

  it('keeps the city segment on an over-budget plat title', () => {
    const out = rendered(documentTitle('Homes for Sale in Courtyard Garages at Broken Top | Bend, Oregon'))
    expect(out).toContain('Bend, Oregon')
    expect(out).toContain('Ryan Realty')
  })

  it('never ends a phrase on the bare word Central', () => {
    for (const raw of [
      'Homes for Sale in Courtyard Garages at Broken Top | Central Oregon',
      'Homes for Sale in Rock Ridge Cabin Sites of Black Butte Ranch | Central Oregon',
      'Homes for Sale in The Highlands at Broken Top | Bend, Oregon',
    ]) {
      expect(documentTitle(raw)).not.toMatch(/\bCentral\s*(\||$)/)
    }
  })

  it('sheds a whole trailing segment before it ever cuts inside one', () => {
    // 92 chars + the 31-char suffix is past the backstop; the qualifier goes,
    // the recorded plat name does not.
    const long = 'Homes for Sale in River Ridge Two Condominiums at Mt Bachelor Village Stage B | Bend, Oregon'
    const out = documentTitle(long)
    expect(out).toContain('Mt Bachelor Village Stage B')
    expect(out).not.toContain('Bend, Oregon')
    expect(rendered(out).length).toBeLessThanOrEqual(120)
  })

  it('word-cuts only a single segment longer than the backstop on its own', () => {
    const runaway = `Homes for Sale in ${'Very Long Place '.repeat(10)}`
    const out = documentTitle(runaway)
    expect(out.length).toBeLessThanOrEqual(120 - BRAND_SUFFIX.length)
    expect(out).not.toMatch(/[&+|,]\s*$/)
  })

  it('budgets 29 characters — the number the registry gate enforces', () => {
    expect(TITLE_BUDGET).toBe(60 - BRAND_SUFFIX.length)
    expect(TITLE_BUDGET).toBe(29)
  })
})

describe('pageMetadata', () => {
  it('does not leave a dangling comma or an Oregon, Oregon before the brand', () => {
    const meta = pageMetadata({
      title: 'Homes for Sale in 8th Street Cottages | Central Oregon, Oregon',
      description: 'Active homes in 8th Street Cottages.',
      path: '/subdivisions/8th-street-cottages',
    })
    const out = rendered(String(meta.title))
    expect(out).not.toMatch(/,\s*\|/)
    expect(out).not.toContain('Oregon, Oregon')
  })

  it('emits noindex, follow by default — a noindexed page still passes its links', () => {
    const meta = pageMetadata({
      title: 'Ridge at Broken Top',
      description: 'Active homes.',
      path: '/subdivisions/ridge-at-broken-top',
      noindex: true,
    })
    expect(meta.robots).toEqual({ index: false, follow: true })
  })

  it('drops follow only when a caller asks for it explicitly', () => {
    const meta = pageMetadata({
      title: 'Seller landing',
      description: 'Paid arrival.',
      path: '/lp/example',
      noindex: true,
      nofollow: true,
    })
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('indexes and follows by default', () => {
    const meta = pageMetadata({ title: 'Bend', description: 'Bend homes.', path: '/cities/bend' })
    expect(meta.robots).toEqual({ index: true, follow: true })
  })
})
