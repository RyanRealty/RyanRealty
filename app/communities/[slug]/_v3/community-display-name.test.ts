/**
 * SITE-28 — the abbreviation slugs that shipped, and the pages that must not
 * move. Every case here was observed on a live render 2026-09-08 (browser UA)
 * before the fix, or is one of the accept test's controls.
 */
import { describe, it, expect } from 'vitest'
import { resolveCommunityDisplayName } from './community-display-name'

/** No plat resolves — the state of Crook and Jefferson County in `boundaries`. */
const noPlats = async () => null

/** A reader standing in for the Deschutes recorded-plat set. */
function plats(map: Record<string, string>) {
  return async (slug: string) => map[slug] ?? null
}

describe('resolveCommunityDisplayName — the three published abbreviations', () => {
  // "Oll", "ParkPL" and "PleasVH" are MLS SubdivisionName ingest tokens.
  // boundaries carries Deschutes County plats only, so Prineville (Crook) and
  // Madras (Jefferson) can offer no recorded name — the same fact
  // data/subdivision-alias-plats.json records for ironhorse and ochoco-pointe.
  for (const raw of ['Oll', 'ParkPL', 'PleasVH']) {
    it(`refuses ${raw} rather than publishing it as a place name`, async () => {
      const r = await resolveCommunityDisplayName({
        rawName: raw,
        isCanonicalSlug: false,
        readRecordedPlatLabel: noPlats,
      })
      expect(r.kind).toBe('refuse')
    })
  }

  it('refuses every abbreviation shape the plat publisher already withholds', async () => {
    for (const raw of ['Oww', 'DrrhTrs', 'Bbr', 'StoneTH', 'Crr 1', 'CLAB', 'AspenB']) {
      const r = await resolveCommunityDisplayName({
        rawName: raw,
        isCanonicalSlug: false,
        readRecordedPlatLabel: noPlats,
      })
      expect(r, raw).toMatchObject({ kind: 'refuse' })
    }
  })
})

describe('resolveCommunityDisplayName — the MLS spelling is what gets tested', () => {
  // slugToTitle (lib/community-slug.ts) lowercases everything after the first
  // letter, so the URL-derived name for /communities/bend-aspenb is "Aspenb" —
  // and "Aspenb" passes the abbreviation test while "AspenB" fails it. The
  // first cut of this fix shipped exactly that split: madras-parkpl refused
  // (its DB row spells it "ParkPL") and bend-aspenb still published "Aspenb".
  // geo_snapshot_mv.geo_label keeps the MLS spelling; verified 2026-09-08.
  // Tokens the flattening genuinely hides: each URL form passes the test and
  // each MLS form fails it. These are the ones that leaked on the first cut.
  const hidden: Array<[urlName: string, mlsName: string]> = [
    ['Aspenb', 'AspenB'],
    ['Clas', 'CLAS'],
    ['Conifa', 'ConifA'],
    ['Parkpl', 'ParkPL'],
    ['Wildfls', 'WildflS'],
  ]
  for (const [urlName, mlsName] of hidden) {
    it(`refuses ${mlsName} even though the URL flattened it to ${urlName}`, async () => {
      // Documents WHY the field exists: without it, this token publishes.
      const flattened = await resolveCommunityDisplayName({
        rawName: urlName,
        isCanonicalSlug: false,
        readRecordedPlatLabel: noPlats,
      })
      expect(flattened.kind, `${urlName} should leak without the MLS spelling`).toBe('publish')

      const withMls = await resolveCommunityDisplayName({
        rawName: urlName,
        mlsName,
        isCanonicalSlug: false,
        readRecordedPlatLabel: noPlats,
      })
      expect(withMls).toEqual({ kind: 'refuse', withheld: mlsName })
    })
  }

  it('refuses StoneTH from either spelling — it is on the recorded known-token list', async () => {
    for (const n of ['Stoneth', 'StoneTH']) {
      const r = await resolveCommunityDisplayName({
        rawName: n,
        mlsName: n,
        isCanonicalSlug: false,
        readRecordedPlatLabel: noPlats,
      })
      expect(r, n).toMatchObject({ kind: 'refuse' })
    }
  })

  it('tests the MLS token but publishes the page\'s own better-spelled name', async () => {
    // The MLS files this place under a short label; the page carries the
    // curated one. The test runs on the token, the output keeps the curated
    // spelling — publishing "Highlands" here would be a silent downgrade.
    const r = await resolveCommunityDisplayName({
      rawName: 'The Highlands At Broken Top',
      mlsName: 'Highlands',
      isCanonicalSlug: false,
      readRecordedPlatLabel: noPlats,
    })
    expect(r).toEqual({
      kind: 'publish',
      name: 'The Highlands at Broken Top',
      source: 'publishable-name',
    })
  })

  it('leaves a real MLS name alone — "Petrosa" is spelled the same either way', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'Petrosa',
      mlsName: 'Petrosa',
      isCanonicalSlug: false,
      readRecordedPlatLabel: noPlats,
    })
    expect(r).toEqual({ kind: 'publish', name: 'Petrosa', source: 'publishable-name' })
  })
})

describe('resolveCommunityDisplayName — the pages that must not move', () => {
  it('publishes a real compound name untouched', async () => {
    // Ranked at position 1.0 in Search Console. A blanket 404 or a blanket
    // refusal would delete these; they are not abbreviations and never enter
    // the recorded-plat lookup at all.
    for (const raw of ['Odin Crest Estate', 'Ponderosa Park Phase 1']) {
      const r = await resolveCommunityDisplayName({
        rawName: raw,
        isCanonicalSlug: false,
        readRecordedPlatLabel: async () => {
          throw new Error('the recorded-plat set must not be consulted for a publishable name')
        },
      })
      expect(r).toEqual({ kind: 'publish', name: raw, source: 'publishable-name' })
    }
  })

  it('leaves a canonical registry community exactly as the registry labels it', async () => {
    for (const raw of ['Tetherow', 'Brasada Ranch']) {
      const r = await resolveCommunityDisplayName({
        rawName: raw,
        isCanonicalSlug: true,
        readRecordedPlatLabel: async () => {
          throw new Error('a canonical registry slug must not be resolved')
        },
      })
      expect(r).toEqual({ kind: 'publish', name: raw, source: 'canonical-registry' })
    }
  })

  it('title-cases an interior connector the way English does, via the one publisher', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'Ridge At Eagle Crest',
      isCanonicalSlug: false,
      readRecordedPlatLabel: noPlats,
    })
    expect(r).toEqual({ kind: 'publish', name: 'Ridge at Eagle Crest', source: 'publishable-name' })
  })
})

describe('resolveCommunityDisplayName — the recorded sources', () => {
  it('uses a RECORDED expansion of a truncated token, never an invented one', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'Triple',
      isCanonicalSlug: false,
      readRecordedPlatLabel: noPlats,
    })
    expect(r).toEqual({ kind: 'publish', name: 'Triple Knot', source: 'publishable-name' })
  })

  it('uses the county plat label when the token slug is EXACTLY a recorded plat slug', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'Bbr',
      isCanonicalSlug: false,
      readRecordedPlatLabel: plats({ bbr: 'Spring Homesite Section Of Black Butte Ranch' }),
    })
    expect(r).toEqual({
      kind: 'publish',
      name: 'Spring Homesite Section of Black Butte Ranch',
      source: 'recorded-plat',
    })
  })

  it('never matches a plat by prefix — the fuzzy rule is forbidden (C-21)', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'Oww',
      isCanonicalSlug: false,
      // The real set holds oregon-water-wonderland-unit-1 and -unit-2. Neither
      // is keyed 'oww', so neither may be borrowed.
      readRecordedPlatLabel: plats({
        'oregon-water-wonderland-unit-1': 'Oregon Water Wonderland Unit 1',
        'oregon-water-wonderland-unit-2': 'Oregon Water Wonderland Unit 2',
      }),
    })
    expect(r.kind).toBe('refuse')
  })

  it('refuses when the recorded-plat read DEGRADES — unknown is not a name (§0)', async () => {
    const r = await resolveCommunityDisplayName({
      rawName: 'PleasVH',
      isCanonicalSlug: false,
      // makeResilientCached hands back its null fallback on a failed read.
      readRecordedPlatLabel: async () => null,
    })
    expect(r).toEqual({ kind: 'refuse', withheld: 'PleasVH' })
  })
})
