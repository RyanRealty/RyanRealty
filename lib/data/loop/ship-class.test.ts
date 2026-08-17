import { describe, expect, it } from 'vitest'
import {
  appendPunchDispositions,
  canCompletePunchList,
  FLEET_PUNCH_CONTRACT,
  FLEET_PUNCH_GAP,
  formatFleetPunchLine,
} from './fleet-intake-core'
import {
  extractUrlFromObjective,
  formatPunchSliceBrief,
  selectPunchSlice,
  selectShipClass,
  SHIP_CLASS_MAX,
  shipClassKey,
  surfaceFamilyFromUrl,
} from './ship-class'

function fleetNode(
  id: string,
  url: string,
  extras?: { domain?: string; title?: string; viewport?: string },
): {
  id: string
  domain: string
  title: string
  objective: string
  versionGap: string | null
} {
  const viewport = extras?.viewport ? ` [${extras.viewport}]` : ''
  return {
    id,
    domain: extras?.domain ?? 'public-ux',
    title: extras?.title ?? 'Fleet finding [p0]: counts disagree',
    objective: `fleet:abc — bot stats-truth (case core-1) at ${url}${viewport}: expected "match" but observed "mismatch".`,
    versionGap: null,
  }
}

describe('ship class (same-category fleet findings share one rebuild)', () => {
  it('reads the intake URL even when a viewport sits after it', () => {
    expect(
      extractUrlFromObjective(
        'fleet:x — bot walker-mobile (case ad-hoc) at https://ryan-realty.com/communities/tetherow [390]: expected "35" but observed "19".',
      ),
    ).toBe('https://ryan-realty.com/communities/tetherow')
  })

  it('groups community, city, neighborhood, and housing-market URLs as place-pages', () => {
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/communities/tetherow')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/cities/la-pine')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('/neighborhoods/awbrey-butte')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/housing-market/bend')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/subdivisions/ridge-at-eagle-crest')).toBe(
      'place-pages',
    )
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/oregon/bend')).toBe('place-pages')
  })

  it('groups blog posts as their own family', () => {
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/blog/retirement-central-oregon')).toBe('blog')
  })

  it('keeps listing detail and search off the place-page class', () => {
    expect(
      surfaceFamilyFromUrl('https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220189422'),
    ).toBe('listing-detail')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/homes-for-sale/bend')).toBe('search')
  })

  it('batches Tetherow + Awbrey + La Pine fleet findings into one place-page class', () => {
    const a = fleetNode('1', 'https://ryan-realty.com/communities/tetherow')
    const b = fleetNode('2', 'https://ryan-realty.com/communities/awbrey-glen')
    const c = fleetNode('3', 'https://ryan-realty.com/cities/la-pine')
    expect(shipClassKey(a)).toBe('fleet:public-ux:place-pages')
    expect(shipClassKey(b)).toBe(shipClassKey(a))
    expect(shipClassKey(c)).toBe(shipClassKey(a))
    const batch = selectShipClass([a, b, c], a)
    expect(batch.nodes.map((n) => n.id)).toEqual(['1', '2', '3'])
    expect(batch.remaining).toBe(0)
  })

  it('does not batch a place-page finding with a listing finding or a planned gap', () => {
    const place = fleetNode('1', 'https://ryan-realty.com/communities/tetherow')
    const listing = fleetNode('2', 'https://ryan-realty.com/homes-for-sale/listing/220189422')
    const gap = {
      id: '3',
      domain: 'public-ux' as const,
      title: 'G32 xAI-only gen',
      objective: 'Put generate calls through lib/grok-*.ts',
      versionGap: 'G32',
    }
    expect(shipClassKey(place)).not.toBe(shipClassKey(listing))
    expect(shipClassKey(place)).not.toBe(shipClassKey(gap))
    expect(selectShipClass([place, listing, gap], place).nodes.map((n) => n.id)).toEqual(['1'])
    expect(selectShipClass([place, listing, gap], gap).nodes.map((n) => n.id)).toEqual(['3'])
  })

  it('caps a class so one session can finish, and reports leftovers for the next ship', () => {
    const nodes = Array.from({ length: SHIP_CLASS_MAX + 3 }, (_, i) =>
      fleetNode(String(i + 1), `https://ryan-realty.com/communities/place-${i}`),
    )
    const batch = selectShipClass(nodes, nodes[0])
    expect(batch.nodes).toHaveLength(SHIP_CLASS_MAX)
    expect(batch.nodes[0].id).toBe('1')
    expect(batch.remaining).toBe(3)
    expect(batch.punch).toBeNull()
  })
})

function punchObjective(lines: Array<{ severity: 'p0' | 'major' | 'minor'; url: string; observed: string; fingerprint: string }>) {
  return [FLEET_PUNCH_CONTRACT, ...lines.map(formatFleetPunchLine)].join('\n')
}

function punchHead(objective: string) {
  return {
    id: 'punch-1',
    domain: 'public-ux',
    title: 'Fleet finding [p0]: review punch list',
    objective,
    versionGap: FLEET_PUNCH_GAP,
  }
}

describe('punch-list serve (virtual class from lines, parent stays the inbox)', () => {
  const searchP0 = {
    severity: 'p0' as const,
    url: 'https://ryan-realty.com/homes-for-sale/bend',
    observed: 'chips are 0x0',
    fingerprint: '1111111111111111',
  }
  const searchMajor = {
    severity: 'major' as const,
    url: 'https://ryan-realty.com/search/bend/under-500k',
    observed: 'empty pins',
    fingerprint: '2222222222222222',
  }
  const placeP0 = {
    severity: 'p0' as const,
    url: 'https://ryan-realty.com/communities/tetherow',
    observed: 'hero 35 vs list 19',
    fingerprint: '3333333333333333',
  }
  const listingMinor = {
    severity: 'minor' as const,
    url: 'https://ryan-realty.com/homes-for-sale/listing/220189422',
    observed: 'gallery jump',
    fingerprint: '4444444444444444',
  }

  it('groups punch lines by surface family', () => {
    const slice = selectPunchSlice(
      punchObjective([searchP0, placeP0, searchMajor, listingMinor]),
      'public-ux',
    )
    expect(slice.family).toBe('search')
    expect(slice.key).toBe('fleet:public-ux:search')
    expect(slice.served.map((l) => l.fingerprint)).toEqual(['1111111111111111', '2222222222222222'])
    expect(slice.leftoverInFamily).toBe(0)
    expect(slice.leftoverOtherFamilies).toBe(2)
  })

  it('serves a p0 family before a major-only family', () => {
    const majorPlace = { ...placeP0, severity: 'major' as const, fingerprint: '5555555555555555' }
    const slice = selectPunchSlice(punchObjective([majorPlace, searchP0]), 'public-ux')
    expect(slice.family).toBe('search')
    expect(slice.served).toHaveLength(1)
    expect(slice.served[0]?.fingerprint).toBe('1111111111111111')
  })

  it('caps a family at SHIP_CLASS_MAX and leaves leftover lines on the parent', () => {
    const extras = Array.from({ length: SHIP_CLASS_MAX + 3 }, (_, i) => ({
      severity: 'p0' as const,
      url: `https://ryan-realty.com/homes-for-sale/bend?page=${i}`,
      observed: `chip ${i}`,
      fingerprint: `aa${String(i).padStart(14, '0')}`,
    }))
    const objective = punchObjective([...extras, placeP0])
    const slice = selectPunchSlice(objective, 'public-ux')
    expect(slice.family).toBe('search')
    expect(slice.served).toHaveLength(SHIP_CLASS_MAX)
    expect(slice.leftoverInFamily).toBe(3)
    expect(slice.leftoverOtherFamilies).toBe(1)
    expect(slice.openTotal).toBe(SHIP_CLASS_MAX + 4)
    const ship = selectShipClass([punchHead(objective)], punchHead(objective))
    expect(ship.nodes.map((n) => n.id)).toEqual(['punch-1'])
    expect(ship.remaining).toBe(3)
    expect(ship.punch?.leftoverInFamily).toBe(3)
  })

  it('does not mark the punch list done while open lines remain', () => {
    const objective = punchObjective([searchP0, placeP0])
    expect(canCompletePunchList(objective)).toBe(false)
    const afterSlice = appendPunchDispositions(objective, [
      { fingerprint: searchP0.fingerprint, status: 'fixed', note: 'READY search class' },
    ])
    expect(canCompletePunchList(afterSlice)).toBe(false)
    const next = selectPunchSlice(afterSlice, 'public-ux')
    expect(next.family).toBe('place-pages')
    expect(next.served).toHaveLength(1)
  })

  it('leaves sibling-node ship-class unchanged when a fleet single is next', () => {
    const punch = punchHead(punchObjective([searchP0, searchMajor, placeP0]))
    const a = fleetNode('1', 'https://ryan-realty.com/homes-for-sale/bend')
    const b = fleetNode('2', 'https://ryan-realty.com/search/bend')
    const batch = selectShipClass([punch, a, b], a)
    expect(batch.punch).toBeNull()
    expect(batch.key).toBe('fleet:public-ux:search')
    expect(batch.nodes.map((n) => n.id)).toEqual(['1', '2'])
    expect(shipClassKey(punch)).toBe('gap:FLEET-PUNCH')
  })

  it('does not pull unclaimed regress-G* nodes into the punch slice', () => {
    const punch = punchHead(punchObjective([searchP0, searchMajor]))
    const regress = {
      id: 'regress-1',
      domain: 'public-ux',
      title: 'Fleet finding [p0]: search completeness flipped',
      objective:
        'fleet:cccccccccccccccc — REGRESSION of G16 ("Search completeness" — was DONE and accepted). bot regression-certifier (case regress-G16) at https://ryan-realty.com/homes-for-sale/bend: expected "pass" but observed "fail".',
      versionGap: null,
    }
    const ship = selectShipClass([punch, regress], punch)
    expect(ship.key).toBe('fleet:public-ux:search')
    expect(ship.nodes.map((n) => n.id)).toEqual(['punch-1'])
    expect(ship.punch?.served).toHaveLength(2)
    expect(selectShipClass([punch, regress], regress).nodes.map((n) => n.id)).toEqual(['regress-1'])
  })

  it('prints a real per-line contract for the served slice', () => {
    const punch = punchHead(punchObjective([searchP0, placeP0]))
    const ship = selectShipClass([punch], punch)
    const brief = formatPunchSliceBrief({
      punch: ship.punch!,
      nodeId: punch.id,
      reads: ['.claude/skills/frontend-design/SKILL.md'],
    }).join('\n')
    expect(brief).toContain('fleet:public-ux:search')
    expect(brief).toContain('severity:     p0')
    expect(brief).toContain('url:          https://ryan-realty.com/homes-for-sale/bend')
    expect(brief).toContain('observed:     chips are 0x0')
    expect(brief).toContain('fingerprint:  fleet:1111111111111111')
    expect(brief).toContain('family:       search')
    expect(brief).toContain('FIRST STEP: reproduce this yourself')
    expect(brief).toContain('390 and 1280')
    expect(brief).toContain('blast-radius')
    expect(brief).toContain('public-site')
    expect(brief).toContain('Do NOT completeWorkNode on FLEET-PUNCH')
    expect(brief).not.toContain(FLEET_PUNCH_CONTRACT)
    expect(brief).not.toContain('hero 35 vs list 19')
  })
})
