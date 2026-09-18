import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAP_HIERARCHY_GATE,
  MAP_HIERARCHY_KIND,
  MAP_HIERARCHY_PARITY,
  isMapHierarchyDocument,
  mapHierarchyCiProblems,
  mapHierarchyShipProblems,
  mapHierarchySourceProblems,
} from '../lib/map-hierarchy.mjs'
import { competitorFirstLookProblems, placeCraftShipProblems } from '../lib/place-craft.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
const CHECK = join(REPO, 'scripts/check-map-hierarchy.mjs')

describe('map-hierarchy lock', () => {
  it('passes the live tree', () => {
    expect(mapHierarchyCiProblems({ root: REPO })).toEqual([])
  })

  it('refuses Old Bend-style town||neighborhood Atlas highlight', () => {
    const p = mapHierarchySourceProblems({
      root: REPO,
      files: {
        neighborhood: `
          regions={atlasRegions.filter((r) => r.kind === 'town' || r.kind === 'neighborhood')}
        `,
      },
    })
    expect(p.join('\n')).toMatch(/20 plats|town\|\|neighborhood|subjectAtlasRegions/)
  })

  it('refuses overlay click that navigates instead of zooming', () => {
    const p = mapHierarchySourceProblems({
      root: REPO,
      files: {
        map: `
          overlayCells.map((cell) => (
            <Polygon onClick={cell.href ? () => router.push(cell.href!) : undefined} />
          ))
        `,
      },
    })
    expect(p.join('\n')).toMatch(/zoom|router\.push/)
  })
})

describe('Tip Ready --ship', () => {
  it('ships the live map-hierarchy stub', () => {
    const raw = JSON.parse(readFileSync(join(REPO, MAP_HIERARCHY_PARITY), 'utf8'))
    expect(isMapHierarchyDocument(raw)).toBe(true)
    expect(raw.kind).toBe(MAP_HIERARCHY_KIND)
    expect(mapHierarchyShipProblems(raw, { root: REPO })).toEqual([])
    const r = spawnSync(process.execPath, [SHIP, '--ship', MAP_HIERARCHY_PARITY], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/map-hierarchy/)
  })

  it('place-craft --ship still refuses without competitor first-look shots', () => {
    const craft = JSON.parse(readFileSync(join(REPO, 'lib/place/place-craft.parity.json'), 'utf8'))
    const p = placeCraftShipProblems(craft, { root: REPO })
    expect(p.join('\n')).toMatch(/competitor first-look|named peer/)
    expect(competitorFirstLookProblems(null, { root: REPO }).join('\n')).toMatch(/Cos prose/)
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'lib/place/place-craft.parity.json'], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).not.toBe(0)
  })
})

describe('ci:map-hierarchy', () => {
  it('exits 0 on HEAD', () => {
    const r = spawnSync(process.execPath, [CHECK], { cwd: REPO, encoding: 'utf8', env: process.env })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(MAP_HIERARCHY_GATE)
  })
})
