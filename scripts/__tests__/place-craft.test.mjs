import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLACE_CRAFT_GATE,
  PLACE_CRAFT_KIND,
  PLACE_CRAFT_PARITY,
  competitorFirstLookProblems,
  isPlaceCraftDocument,
  isPlaceCraftDoneClaim,
  mapDrivesHierarchyProblems,
  placeCraftCiProblems,
  placeCraftShipProblems,
  placeSeamsProblems,
} from '../lib/place-craft.mjs'
import { siteQueueDoneEvidenceProblems, tasteDoneProblems } from '../lib/taste-receipt.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
const CHECK = join(REPO, 'scripts/check-place-craft.mjs')

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function writeShotPair(dir) {
  writeFileSync(join(dir, 'ours.png'), PNG_1X1)
  writeFileSync(join(dir, 'peer.png'), PNG_1X1)
}

function passingLook(dir) {
  writeShotPair(dir)
  return {
    peer: 'Redfin Bend homes for sale',
    peerUrl: 'https://www.redfin.com/city/1826/OR/Bend',
    shots: { ours: 'ours.png', peer: 'peer.png' },
  }
}

const liveCity = readFileSync(join(REPO, 'app/cities/[slug]/page.tsx'), 'utf8')

describe('map-drives-hierarchy lock', () => {
  it('passes the live place templates', () => {
    expect(mapDrivesHierarchyProblems({ root: REPO })).toEqual([])
  })

  it('refuses a city Subdivisions-in dump and a sales-index child list', () => {
    const city = liveCity
      .replace('const childPlatEntries: V3PlaceIndexEntry[] = atlasRegions', 'const childPlatEntries = getIndexableSubdivisions')
      .replace('id="child-places"', 'id="child-places" heading={"Subdivisions in Bend"}')
    const p = mapDrivesHierarchyProblems({
      root: REPO,
      files: { city: `${city}\nconst CITY_PLAT_INDEX_CAP = 60\nheading={v3Text('Subdivisions in Bend')}` },
    })
    expect(p.join('\n')).toMatch(/getIndexableSubdivisions|CITY_PLAT_INDEX_CAP|Subdivisions in|atlasRegions/)
  })
})

describe('competitor first-look evidence', () => {
  it('refuses omit — Cos prose is not Tip Ready', () => {
    const p = competitorFirstLookProblems(null, { root: REPO })
    expect(p.join('\n')).toMatch(/competitor first-look/)
    expect(p.join('\n')).toMatch(/named peer/)
    expect(p.join('\n')).toMatch(/Cos prose/)
  })

  it('refuses a placeholder peer and missing shots', () => {
    const p = competitorFirstLookProblems({ peer: 'competitor', shots: {} }, { root: REPO })
    expect(p.join('\n')).toMatch(/peer must name/)
    expect(p.join('\n')).toMatch(/shots/)
  })

  it('refuses ours without a peer shot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-first-look-'))
    writeFileSync(join(dir, 'ours.png'), PNG_1X1)
    const p = competitorFirstLookProblems(
      { peer: 'Redfin Bend', shots: { ours: 'ours.png' } },
      { root: dir },
    )
    expect(p.join('\n')).toMatch(/side-by-side OR sequential/)
  })

  it('passes named peer + sequential ours/peer shots on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-first-look-ok-'))
    expect(competitorFirstLookProblems(passingLook(dir), { root: dir })).toEqual([])
  })

  it('passes named peer + side-by-side shot on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-first-look-sbs-'))
    writeFileSync(join(dir, 'sbs.png'), PNG_1X1)
    expect(
      competitorFirstLookProblems(
        { peer: 'Zillow Bend neighborhood', shots: { sideBySide: 'sbs.png' } },
        { root: dir },
      ),
    ).toEqual([])
  })
})

describe('place-craft --ship', () => {
  it('live parity is a place-craft document and documents both locks', () => {
    const d = JSON.parse(readFileSync(join(REPO, PLACE_CRAFT_PARITY), 'utf8'))
    expect(isPlaceCraftDocument(d)).toBe(true)
    expect(d.kind).toBe(PLACE_CRAFT_KIND)
    expect(d.locks).toEqual(expect.arrayContaining(['map-drives-hierarchy', 'competitor-first-look']))
    expect(d.evidencePath.competitorFirstLook.required).toBe(true)
  })

  it('Tip Ready --ship of a stub without shots still refuses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-place-craft-stub-'))
    mkdirSync(join(dir, 'lib/place'), { recursive: true })
    const d = JSON.parse(readFileSync(join(REPO, PLACE_CRAFT_PARITY), 'utf8'))
    delete d.competitorFirstLook
    writeFileSync(join(dir, PLACE_CRAFT_PARITY), JSON.stringify(d))
    const r = spawnSync(process.execPath, [SHIP, '--ship', PLACE_CRAFT_PARITY], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/competitor first-look/)
    expect(`${r.stderr}${r.stdout}`).toMatch(/named peer/)
    expect(`${r.stderr}${r.stdout}`).toMatch(/ship refuse/)
  })

  it('Tip Ready --ship of live place-craft.parity.json exits 0 with first-look shots', () => {
    const r = spawnSync(process.execPath, [SHIP, '--ship', PLACE_CRAFT_PARITY], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
  })

  it('placeCraftShipProblems passes hierarchy + named-peer sequential shots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-place-craft-ok-'))
    const d = JSON.parse(readFileSync(join(REPO, PLACE_CRAFT_PARITY), 'utf8'))
    d.competitorFirstLook = passingLook(dir)
    expect(placeCraftShipProblems(d, { root: REPO })).not.toEqual([])
    expect(mapDrivesHierarchyProblems({ root: REPO })).toEqual([])
    expect(competitorFirstLookProblems(d.competitorFirstLook, { root: dir })).toEqual([])
    expect(placeCraftShipProblems(d, { root: dir })).toEqual(
      expect.arrayContaining([expect.stringMatching(/missing place template|map-drives-hierarchy/i)]),
    )
    const mixed = placeCraftShipProblems(d, { root: REPO })
    expect(mixed.join('\n')).toMatch(/not on disk/)
  })

  it('--ship exits 0 when the stub is copied next to shots in a tree that keeps hierarchy sources', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-place-craft-ship-'))
    mkdirSync(join(dir, 'lib/place'), { recursive: true })
    mkdirSync(join(dir, 'app/cities/[slug]'), { recursive: true })
    mkdirSync(join(dir, 'app/communities/[slug]'), { recursive: true })
    mkdirSync(join(dir, 'app/cities/[slug]/[neighborhoodSlug]'), { recursive: true })
    mkdirSync(join(dir, 'app/subdivisions/[slug]'), { recursive: true })
    writeFileSync(join(dir, 'app/cities/[slug]/page.tsx'), liveCity)
    writeFileSync(
      join(dir, 'app/communities/[slug]/page.tsx'),
      readFileSync(join(REPO, 'app/communities/[slug]/page.tsx')),
    )
    writeFileSync(
      join(dir, 'app/cities/[slug]/[neighborhoodSlug]/page.tsx'),
      readFileSync(join(REPO, 'app/cities/[slug]/[neighborhoodSlug]/page.tsx')),
    )
    writeFileSync(
      join(dir, 'app/subdivisions/[slug]/page.tsx'),
      readFileSync(join(REPO, 'app/subdivisions/[slug]/page.tsx')),
    )
    const d = JSON.parse(readFileSync(join(REPO, PLACE_CRAFT_PARITY), 'utf8'))
    d.competitorFirstLook = passingLook(dir)
    writeFileSync(join(dir, PLACE_CRAFT_PARITY), JSON.stringify(d))
    const r = spawnSync(process.execPath, [SHIP, '--ship', PLACE_CRAFT_PARITY], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/competitor first-look/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/map-drives-hierarchy/)
  })
})

describe('ci:place-craft', () => {
  it('exits 0 on HEAD — hierarchy locked, evidence path documented, shots not invented', () => {
    expect(placeCraftCiProblems({ root: REPO })).toEqual([])
    const r = spawnSync(process.execPath, [CHECK], { cwd: REPO, encoding: 'utf8', env: process.env })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(PLACE_CRAFT_GATE)
    expect(r.stdout).toMatch(/map-drives-hierarchy/)
  })
})

describe('SITE-128 rematch seams (CI only)', () => {
  it('passes the live tree', () => {
    expect(placeSeamsProblems({ root: REPO })).toEqual([])
    expect(placeCraftCiProblems({ root: REPO })).toEqual([])
  })

  it('FAIL 1 — refuses a listing overlay that hides the place path', () => {
    const crumb = readFileSync(join(REPO, 'components/site/v3/V3Breadcrumb.tsx'), 'utf8').replaceAll(
      'showFullOverlayPath',
      'keepCollapsedOverlay',
    )
    const p = placeSeamsProblems({ root: REPO, files: { crumb } })
    expect(p.join('\n')).toMatch(/place path/)
  })

  it('FAIL 2 — refuses AREA GUIDE on communityRows', () => {
    const citySections = readFileSync(join(REPO, 'app/cities/[slug]/_v3/city-sections.ts'), 'utf8').replace(
      'export function communityRows(items: readonly CityCommunityItem[]): V3LedgerFigureRow[] {',
      'export function communityRows(items: readonly CityCommunityItem[]): V3LedgerFigureRow[] {\n    const when = v3Text("Area guide")',
    )
    const p = placeSeamsProblems({ root: REPO, files: { citySections } })
    expect(p.join('\n')).toMatch(/name-only|AREA GUIDE/)
  })

  it('FAIL 3 — refuses a city Communities rail that does not split grains', () => {
    const city = liveCity.replace('cityPlaceGrain', 'placeKindHint').replace(/grain === 'community'/g, 'kind === "rail"')
    const p = placeSeamsProblems({ root: REPO, files: { city } })
    expect(p.join('\n')).toMatch(/split grains|Awbrey Butte/)
  })

  it('FAIL 4 — refuses This/Another subdivision lecture on the plat node', () => {
    const subdivision = `${readFileSync(join(REPO, 'app/subdivisions/[slug]/page.tsx'), 'utf8')}\nconst lecture = "Another subdivision in Bend"`
    const platInsight = readFileSync(
      join(REPO, 'app/subdivisions/[slug]/_v3/SubdivisionInsight.client.tsx'),
      'utf8',
    ).replace('title: placeName', 'title: "This subdivision"')
    const p = placeSeamsProblems({ root: REPO, files: { subdivision, platInsight } })
    expect(p.join('\n')).toMatch(/This\/Another subdivision|place name/)
  })

  it('FAIL 5 — refuses disableClustering:true on the city first-look map', () => {
    const placeLookMap = `${readFileSync(join(REPO, 'components/site/v3/V3PlaceLookMap.client.tsx'), 'utf8')}\n  disableClustering: true,`
    const p = placeSeamsProblems({ root: REPO, files: { placeLookMap } })
    expect(p.join('\n')).toMatch(/cluster price marks|375/)
  })
})

describe('Tip Ready place kit still holds the hierarchy lock', () => {
  it('tasteDoneProblems on a place kit includes map-drives-hierarchy', () => {
    const p = tasteDoneProblems(
      { demoMatch: true, evaluatorModel: 'grok-4.6' },
      { kit: 'city', root: REPO, sourceText: 'plain place copy' },
    )
    expect(p.filter((line) => /getIndexableSubdivisions|Subdivisions in|atlasRegions/.test(line))).toEqual([])
  })
})

describe('siteQueueDoneEvidenceProblems — SITE-128 place craft', () => {
  it('detects a place-craft done claim', () => {
    expect(isPlaceCraftDoneClaim('place craft Tip Ready', 'SITE-128')).toBe(true)
    expect(isPlaceCraftDoneClaim('explorer first-look shots', 'SITE-128')).toBe(true)
    expect(isPlaceCraftDoneClaim('amenity layers ship OK', 'SITE-128')).toBe(false)
  })

  it('refuses SITE-128 explorer Tip Ready without competitor first-look shots', () => {
    const p = siteQueueDoneEvidenceProblems(
      'SITE-128 explorer first-look. node scripts/lib/taste-receipt.mjs --ship lib/place/place-craft.parity.json. demoMatch: true. Tip Ready.',
      {
        versionGap: 'SITE-128',
        root: REPO,
        tasteReview: {
          demoMatch: true,
          evaluatorModel: 'grok-4.6',
          shotsHash: `sha256:${'a'.repeat(64)}`,
        },
      },
    )
    expect(p.join('\n')).toMatch(/competitor first-look|named peer/)
  })
})
