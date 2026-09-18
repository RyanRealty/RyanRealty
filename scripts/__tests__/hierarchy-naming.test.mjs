import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HIERARCHY_NAMING_GATE,
  HIERARCHY_NAMING_KIND,
  HIERARCHY_NAMING_PARITY,
  hierarchyNamingCiProblems,
  hierarchyNamingShipProblems,
  hierarchyNamingSourceProblems,
  isHierarchyNamingDocument,
} from '../lib/hierarchy-naming.mjs'
import { competitorFirstLookProblems, placeCraftShipProblems } from '../lib/place-craft.mjs'
import { mapHierarchyShipProblems } from '../lib/map-hierarchy.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
const CHECK = join(REPO, 'scripts/check-hierarchy-naming.mjs')

describe('hierarchy-naming lock', () => {
  it('passes the live tree', () => {
    expect(hierarchyNamingCiProblems({ root: REPO })).toEqual([])
  })

  it('refuses plats typed as neighborhood + Subdivision', () => {
    const p = hierarchyNamingSourceProblems({
      root: REPO,
      files: {
        childRings: `
          export type PlaceChildRegion = { kind: 'neighborhood' }
          out.push({ kind: 'neighborhood', kindLabel: 'Subdivision' })
        `,
      },
    })
    expect(p.join('\n')).toMatch(/subdivision/)
  })

  it('refuses mixed Communities and subdivisions heading', () => {
    const p = hierarchyNamingSourceProblems({
      root: REPO,
      files: {
        city: `heading={v3Text('Communities and subdivisions')}`,
      },
    })
    expect(p.join('\n')).toMatch(/Communities and subdivisions/)
  })

  it('refuses search belowNav={false} density drift', () => {
    const p = hierarchyNamingSourceProblems({
      root: REPO,
      files: {
        search: `<V3Breadcrumb belowNav={false} trail={searchBreadcrumbItems} />`,
      },
    })
    expect(p.join('\n')).toMatch(/belowNav/)
  })
})

describe('Tip Ready --ship', () => {
  it('ships the live hierarchy-naming stub', () => {
    const raw = JSON.parse(readFileSync(join(REPO, HIERARCHY_NAMING_PARITY), 'utf8'))
    expect(isHierarchyNamingDocument(raw)).toBe(true)
    expect(raw.kind).toBe(HIERARCHY_NAMING_KIND)
    expect(hierarchyNamingShipProblems(raw, { root: REPO })).toEqual([])
    const r = spawnSync(process.execPath, [SHIP, '--ship', HIERARCHY_NAMING_PARITY], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/hierarchy-naming/)
  })

  it('keeps first-look and map-hierarchy refuses intact', () => {
    expect(competitorFirstLookProblems(null, { root: REPO }).join('\n')).toMatch(/Cos prose/)
    const craft = JSON.parse(readFileSync(join(REPO, 'lib/place/place-craft.parity.json'), 'utf8'))
    expect(placeCraftShipProblems(craft, { root: REPO })).toEqual([])
    const map = JSON.parse(readFileSync(join(REPO, 'lib/place/map-hierarchy.parity.json'), 'utf8'))
    expect(mapHierarchyShipProblems(map, { root: REPO })).toEqual([])
  })
})

describe('ci:hierarchy-naming', () => {
  it('exits 0 on HEAD', () => {
    const r = spawnSync(process.execPath, [CHECK], { cwd: REPO, encoding: 'utf8', env: process.env })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(HIERARCHY_NAMING_GATE)
  })
})
