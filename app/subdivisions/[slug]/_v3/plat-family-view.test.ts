import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { derivePlatFamilies, platFamilyRole, type FamilyPlatInput } from '@/lib/market/plat-family'
import {
  familyCrumb,
  familyMemberLine,
  familyPhaseEntries,
  platAtlasClaim,
  platDocumentTitle,
  platPhaseDescription,
  withFamilyCrumb,
} from './plat-family-view'
import { platPageTitle } from './plat-title'

const plats: FamilyPlatInput[] = [
  { slug: 'ridge-at-eagle-crest-5', label: 'Ridge At Eagle Crest 5', citySlug: 'redmond', closedCount: 31 },
  { slug: 'ridge-at-eagle-crest-36', label: 'Ridge At Eagle Crest 36', citySlug: 'redmond', closedCount: 207 },
  { slug: 'tetherow-phase-1', label: 'Tetherow Phase 1', citySlug: 'bend', closedCount: 983 },
  { slug: 'tetherow-phase-3', label: 'Tetherow Phase 3', citySlug: 'bend', closedCount: 133 },
  { slug: 'canyon-ridge-phase-4-711-18-000032-sub', label: 'Canyon Ridge, Phase 4 711-18-000032-sub', citySlug: 'redmond', closedCount: 31 },
  { slug: 'canyon-ridge-phase-3', label: 'Canyon Ridge, Phase 3', citySlug: 'redmond', closedCount: 61 },
]
const families = derivePlatFamilies({
  plats,
  communities: [
    { slug: 'tetherow', label: 'Tetherow', citySlug: 'bend', aliases: ['Tetherow'] },
    { slug: 'eagle-crest', label: 'Eagle Crest', citySlug: 'redmond', aliases: ['Ridge At Eagle Crest'] },
  ],
})

describe('platDocumentTitle', () => {
  it('titles a phase as part of its family, without the head-term pattern', () => {
    const role = platFamilyRole(families, 'ridge-at-eagle-crest-36')
    const title = platDocumentTitle({ displayName: 'Ridge at Eagle Crest 36', cityName: 'Redmond', role })
    // The whole subordinate form runs past the 60-char SERP width, so the
    // phase's own name stands alone (Matt 2026-10-05).
    expect(title).toBe('Ridge at Eagle Crest 36')
    expect(title).not.toMatch(/homes for sale/i)
  })

  it('fits a long phase under the live audit ceiling, dropping city then family (2026-10-04)', () => {
    const longFamilies = derivePlatFamilies({
      plats: [
        { slug: 'greens-at-redmond-phase-1', label: 'Greens at Redmond Phase 1', citySlug: 'redmond', closedCount: 40 },
        {
          slug: 'greens-at-redmond-the-phase-1-and-2-replat-lots-3-8',
          label: 'Greens at Redmond (the) Phase 1 & 2 Replat Lots 3-8 With A Very Long Recorded Name',
          citySlug: 'redmond',
          closedCount: 12,
        },
      ],
      communities: [],
    })
    const role = platFamilyRole(longFamilies, 'greens-at-redmond-the-phase-1-and-2-replat-lots-3-8')
    expect(role?.role).toBe('member')
    const title = platDocumentTitle({ displayName: 'x', cityName: 'Redmond', role })
    expect(title.length + ' | Ryan Realty'.length).toBeLessThanOrEqual(90)
    expect(title).not.toMatch(/, Redmond$/)
    // A phase whose subordinate title fits 46 chars keeps all of it.
    const fitFamilies = derivePlatFamilies({
      plats: [
        { slug: 'elk-run', label: 'Elk Run', citySlug: 'bend', closedCount: 40 },
        { slug: 'elk-run-phase-2', label: 'Elk Run Phase 2', citySlug: 'bend', closedCount: 12 },
      ],
      communities: [],
    })
    const short = platFamilyRole(fitFamilies, 'elk-run-phase-2')
    expect(short?.role).toBe('member')
    const fitted = platDocumentTitle({ displayName: 'x', cityName: 'Bend', role: short })
    expect(fitted).toMatch(/ · part of Elk Run, Bend$/)
    expect(fitted.length).toBeLessThanOrEqual(46)
  })

  it('keeps the family page and a plain plat on the place-first homes title', () => {
    const head = platFamilyRole(families, 'ridge-at-eagle-crest')
    expect(head?.role).toBe('head')
    expect(platDocumentTitle({ displayName: 'Ridge at Eagle Crest', cityName: 'Redmond', role: head })).toBe(
      'Ridge at Eagle Crest homes for sale · Redmond',
    )
  })

  it('never puts a county land-use file number in a title (SEO-7)', () => {
    expect(platPageTitle('Canyon Ridge, Phase 4 711-18-000032-sub', 'Redmond')).toBe(
      'Canyon Ridge, Phase 4 homes for sale · Redmond',
    )
    const role = platFamilyRole(families, 'canyon-ridge-phase-4-711-18-000032-sub')
    expect(platDocumentTitle({ displayName: 'x', cityName: 'Redmond', role })).not.toMatch(/711-18/)
  })
})

describe('the link up', () => {
  it('names the family and its main page from a phase', () => {
    const role = platFamilyRole(families, 'tetherow-phase-3')
    expect(familyCrumb(role)).toEqual({ label: 'Tetherow', href: '/communities/tetherow' })
    expect(familyMemberLine(role)).toMatchObject({ href: '/communities/tetherow', linkLabel: '2 recorded phases of Tetherow' })
    expect(platPhaseDescription(role, 'Bend')).toMatch(/one of the 2 recorded phases of Tetherow in Bend/)
  })

  it('inserts the family crumb before the page crumb, once', () => {
    const trail = [{ label: 'Redmond', href: '/cities/redmond' }, { label: 'Ridge at Eagle Crest 36' }]
    const crumb = { label: 'Ridge at Eagle Crest', href: '/subdivisions/ridge-at-eagle-crest' }
    expect(withFamilyCrumb(trail, crumb)).toEqual([
      { label: 'Redmond', href: '/cities/redmond' },
      crumb,
      { label: 'Ridge at Eagle Crest 36' },
    ])
    const already = [{ label: 'Tetherow', href: '/communities/tetherow' }, { label: 'Tetherow Phase 3' }]
    expect(withFamilyCrumb(already, { label: 'Tetherow', href: '/communities/tetherow' })).toEqual(already)
    expect(withFamilyCrumb(trail, null)).toEqual(trail)
  })

  it('lists every phase of a family on its main page, each a link', () => {
    const ridge = families.find((f) => f.slug === 'ridge-at-eagle-crest')!
    expect(familyPhaseEntries(ridge).map((e) => e.href)).toEqual([
      '/subdivisions/ridge-at-eagle-crest-5',
      '/subdivisions/ridge-at-eagle-crest-36',
    ])
  })
})

describe('platAtlasClaim (VOICE-8)', () => {
  it('says the every-kind map count in its own words, never "homes for sale"', () => {
    const claim = platAtlasClaim({
      displayName: 'Ridge at Eagle Crest',
      mixed: true,
      listedCount: 88,
      houseCount: 14,
      typeLabels: ['House', 'Townhouse', 'Land'],
    })
    expect(claim).toBe(
      '88 active and pending listings of every kind inside the Ridge at Eagle Crest boundary: house, townhouse and land. Toggle a type on the map.',
    )
    expect(claim).not.toMatch(/homes for sale/)
  })

  it('keeps "homes for sale in" for the single-family counted set alone', () => {
    expect(
      platAtlasClaim({ displayName: 'Park Addition', mixed: false, listedCount: 3, houseCount: 3, typeLabels: ['House'] }),
    ).toBe('3 homes for sale in Park Addition.')
  })
})

describe('the plat page wires the family both ways (the lock, Matt 2026-09-23)', () => {
  const page = readFileSync(join(process.cwd(), 'app/subdivisions/[slug]/page.tsx'), 'utf8')

  it('reads the family role for both the head and the body', () => {
    expect(page).toMatch(/platFamilyRole\(families, slug\)/)
    expect(page.match(/getPlatFamilies\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('links a phase up: breadcrumb, JSON-LD breadcrumb and a visible anchor under the H1', () => {
    expect(page).toMatch(/trail=\{withFamilyCrumb\(/)
    expect(page).toMatch(/\{ name: familyUp\.label, url: familyUp\.href \}/)
    expect(page).toMatch(/<a href=\{familyLine\.href\}>\{familyLine\.linkLabel\}<\/a>/)
    expect(page).toMatch(/All \{resortLabel\} real estate/)
  })

  it('lists every phase down from the family page', () => {
    expect(page).toMatch(/id="phases"[\s\S]{0,400}entries=\{familyPhaseEntries\(headFamily\)\}/)
  })

  it('titles a phase through the subordinate title and never through the bare place title', () => {
    expect(page).toMatch(/title: platDocumentTitle\(\{ displayName: headName, cityName, role \}\)/)
  })

  it('says the map count in its own words (VOICE-8)', () => {
    expect(page).toMatch(/const atlasClaimText = platAtlasClaim\(/)
    expect(page).not.toMatch(/\$\{foldListedCount\} homes for sale in/)
  })
})
