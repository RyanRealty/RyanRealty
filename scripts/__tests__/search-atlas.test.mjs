import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SEARCH_ATLAS_GATE,
  SEARCH_ATLAS_KIND,
  SEARCH_ATLAS_PARITY,
  isSearchAtlasDocument,
  searchAtlasCiProblems,
  searchAtlasShipProblems,
  searchAtlasSourceProblems,
} from '../lib/search-atlas.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
const CHECK = join(REPO, 'scripts/check-search-atlas.mjs')

describe('search-atlas lock', () => {
  it('passes the live tree', () => {
    expect(searchAtlasCiProblems({ root: REPO })).toEqual([])
  })

  it('refuses a 40/60 portal split page', () => {
    const p = searchAtlasSourceProblems({
      root: REPO,
      files: {
        page: `
          export default function Page() {
            return <main className="search-app-frame">portal</main>
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/srch-atlas/)
  })

  it('refuses mute comparison without SearchCompareMark', () => {
    const p = searchAtlasSourceProblems({
      root: REPO,
      files: {
        card: `
          export function SplitListingCard() {
            return <span className="srch-ppsf" />
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/SearchCompareMark/)
  })

  it('refuses seven dock pills without sheet class', () => {
    const p = searchAtlasSourceProblems({
      root: REPO,
      files: {
        filters: `
          export function SearchFilters() {
            return <V3MorphSearch><V3Range /></V3MorphSearch>
          }
        `,
      },
    })
    expect(p.join('\n')).toMatch(/srch-chip--sheet/)
  })
})

describe('Tip Ready --ship', () => {
  it('ships the live search-atlas stub', () => {
    const raw = JSON.parse(readFileSync(join(REPO, SEARCH_ATLAS_PARITY), 'utf8'))
    expect(isSearchAtlasDocument(raw)).toBe(true)
    expect(raw.kind).toBe(SEARCH_ATLAS_KIND)
    expect(searchAtlasShipProblems(raw, { root: REPO })).toEqual([])
    const r = spawnSync(process.execPath, [SHIP, '--ship', SEARCH_ATLAS_PARITY], {
      cwd: REPO,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/search-atlas/)
  })
})

describe('ci:search-atlas', () => {
  it('exits 0 on HEAD', () => {
    const r = spawnSync(process.execPath, [CHECK], { cwd: REPO, encoding: 'utf8', env: process.env })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(SEARCH_ATLAS_GATE)
  })
})
