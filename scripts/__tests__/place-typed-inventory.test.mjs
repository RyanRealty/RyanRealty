import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLACE_TYPED_INVENTORY_GATE,
  PLACE_TYPED_INVENTORY_KIND,
  PLACE_TYPED_INVENTORY_PARITY,
  isPlaceTypedInventoryDocument,
  placeTypedInventoryCiProblems,
  placeTypedInventoryShipProblems,
  placeTypedInventorySourceProblems,
} from '../lib/place-typed-inventory.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
const CHECK = join(REPO, 'scripts/check-place-typed-inventory.mjs')

describe('place-typed-inventory lock', () => {
  it('passes the live tree', () => {
    expect(placeTypedInventoryCiProblems({ root: REPO })).toEqual([])
  })

  it('refuses PlaceSplitView returning on community', () => {
    const p = placeTypedInventorySourceProblems({
      root: REPO,
      files: {
        community: `
          import { PlaceSplitView } from '@/components/search/PlaceSplitView'
          export default function Page() {
            return <PlaceSplitView id="homes" />
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/PlaceSplitView|V3PlaceInventory|hidePriceScrubber/)
  })

  it('refuses Atlas scrubber that still mounts when hidePriceScrubber is set', () => {
    const p = placeTypedInventorySourceProblems({
      root: REPO,
      files: {
        atlas: `
          export function V3Atlas({ hidePriceScrubber = false }) {
            return (
              <label className="v3-atlas__scrub">
                <input className="v3-atlas__range" type="range" />
              </label>
            )
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/hidePriceScrubber must skip mounting/)
  })

  it('refuses empty type stubs', () => {
    const p = placeTypedInventorySourceProblems({
      root: REPO,
      files: {
        stock: `
          export const PLACE_STOCK_SECTION_ORDER = ['sfr', 'multifamily', 'attached', 'land', 'commercial']
          export const PLACE_STOCK_HEADINGS = {
            sfr: 'Single-family homes',
            multifamily: 'Multifamily homes',
            attached: 'Townhomes and condos',
            land: 'Land',
            commercial: 'Commercial property',
          }
          export function placeStockSectionsFromTiles() {
            return PLACE_STOCK_SECTION_ORDER.map((key) => ({ key, rows: [] }))
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/zero actives|empty stub/)
  })

  it('refuses the old four buckets: commercial is a type of its own (Matt 2026-09-23)', () => {
    const p = placeTypedInventorySourceProblems({
      root: REPO,
      files: {
        stock: `
          export const PLACE_STOCK_SECTION_ORDER = ['sfr', 'multifamily', 'attached', 'land']
          export function placeStockSectionsFromTiles() {
            return [].flatMap(() => { if (rows.length === 0) return [] })
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/five buyer buckets/)
  })
})

describe('Tip Ready --ship', () => {
  it('ships the live place-typed-inventory stub', () => {
    const raw = JSON.parse(readFileSync(join(REPO, PLACE_TYPED_INVENTORY_PARITY), 'utf8'))
    expect(isPlaceTypedInventoryDocument(raw)).toBe(true)
    expect(raw.kind).toBe(PLACE_TYPED_INVENTORY_KIND)
    expect(placeTypedInventoryShipProblems(raw, { root: REPO })).toEqual([])
    const r = spawnSync(process.execPath, [SHIP, '--ship', PLACE_TYPED_INVENTORY_PARITY], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/place-typed-inventory/)
  })
})

describe('ci:place-typed-inventory', () => {
  it('exits 0 on HEAD', () => {
    const r = spawnSync(process.execPath, [CHECK], { cwd: REPO, encoding: 'utf8', env: process.env })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(PLACE_TYPED_INVENTORY_GATE)
  })
})
