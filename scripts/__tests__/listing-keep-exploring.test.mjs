import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KEEP_EXPLORING_LOCK,
  LISTING_KEEP_EXPLORING_GATE,
  listingKeepExploringProblems,
} from '../lib/listing-keep-exploring.mjs'

const REPO = process.cwd()

describe('listing-keep-exploring lock', () => {
  it('passes HEAD', () => {
    expect(listingKeepExploringProblems({ root: REPO })).toEqual([])
  })

  it('refuses View more that falls back to city search', () => {
    const helper = `export function listingKeepExploringDoor() { return { name: 'Bend', href: '/homes-for-sale/bend' } }
export function pickListingAtlasRelatedPlats() { return [] }
export const LISTING_KEEP_EXPLORING_CHIP_FOLD_AT = 8
export const LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME = LISTING_KEEP_EXPLORING_CHIP_FOLD_AT - 1
`
    const page = `const featuredViewAllHref = homesForSalePath(listing.city)
`
    const problems = listingKeepExploringProblems({
      root: REPO,
      files: {
        helper,
        page,
        atlas: 'pickListingAtlasRelatedPlats({ plats, subject, hasLocalFrame })',
      },
    })
    expect(problems.some((m) => /homes-for-sale|homesForSalePath|listingKeepExploringDoor/.test(m))).toBe(
      true,
    )
  })

  it('refuses the 60/80 legal-plat dump', () => {
    const problems = listingKeepExploringProblems({
      root: REPO,
      files: {
        atlas: `const ranked = hasLocalFrame ? withGeometry : [...withGeometry]
const cap = hasLocalFrame ? 80 : 60
const cells = ranked.slice(0, cap)
`,
      },
    })
    expect(problems.some((m) => /60\/80|\+52|slice/.test(m))).toBe(true)
  })

  it('ci:listing-keep-exploring exits 0 on HEAD', () => {
    const r = spawnSync('node', [join(REPO, 'scripts/check-listing-keep-exploring.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(LISTING_KEEP_EXPLORING_GATE)
    expect(KEEP_EXPLORING_LOCK.chipFoldAt).toBe(8)
  })
})
