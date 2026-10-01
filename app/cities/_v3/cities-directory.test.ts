import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = readFileSync(resolve('app/cities/_v3/CitiesDirectory.tsx'), 'utf8')
const page = readFileSync(resolve('app/cities/page.tsx'), 'utf8')
const fold = readFileSync(resolve('app/cities/_v3/cities-fold.css'), 'utf8')
const css = readFileSync(resolve('app/cities/_v3/cities-directory.css'), 'utf8')
const compare = readFileSync(resolve('components/site/v3/V3MosCompare.client.tsx'), 'utf8')

describe('SITE-161 cities directory fold', () => {
  it('opens the index on photographed city doors with live counts', () => {
    expect(page).toMatch(/<CitiesDirectory/)
    expect(page).toMatch(/id="city-directory"/)
    expect(page).toMatch(/href: `\/cities\/\$\{city\.slug\}`/)
    expect(dir).toMatch(/InfiniteMasonry/)
    expect(dir).toMatch(/V3Number/)
    expect(dir).toMatch(/city\.countLabel/)
    expect(dir).toMatch(/for sale/)
  })

  it('puts named cities above Atlas at 375 and the combobox above the MOS scale', () => {
    expect(fold).toMatch(/\.cities-fold__directory \{[\s\S]*?order: 1;/)
    expect(fold).toMatch(/\.cities-fold__drawing \{[\s\S]*?order: 3;/)
    expect(compare.indexOf('data-taste="city-combo"')).toBeLessThan(
      compare.indexOf('v3-mos-compare__field'),
    )
    expect(compare).toMatch(/ComboboxInput/)
    expect(compare).toMatch(/Search a city/)
  })
})

/**
 * The scrolling box's bottom edge must fall on a photograph, never through a
 * name or a count (found 2026-10-01: "50 for sale" and "111 for sale" printed
 * half-cut at 375 because the edge, 20.5rem, fell through the second row's
 * counts). Measured on a production build at 375: every card is 164.8px (6.5rem
 * photograph, cities-fold.css, plus 60.8px of name, bar and count), rows sit
 * 174.8px apart (a 10px gap), so row 2's last label ends at 337.4px
 * (21.09rem) and row 3's photograph spans 349.6px to 453.6px (21.85rem to
 * 28.35rem), its name starting at 459.2px (28.7rem). A box edge anywhere in
 * 21.09rem to 28.7rem is clean; one inside the photograph is also the cue that
 * the box scrolls.
 */
describe('the cities directory box never cuts a label', () => {
  const rem = (raw: string | undefined) => Number.parseFloat(raw ?? 'NaN')
  const boxBlock = css.match(/\.cities-directory__masonry \{\n  height: ([\d.]+)rem;/)
  const frameBlock = css.match(
    /\.cities-directory\.is-masonry \.cities-directory__masonry-frame \{\n  display: block;\n  min-height: ([\d.]+)rem;/,
  )
  const ROW_2_LABELS_END_REM = 337.4 / 16
  const ROW_3_PHOTO_TOP_REM = 349.6 / 16
  const ROW_3_NAME_TOP_REM = 459.2 / 16

  it('puts the phone edge on the third row\'s photograph, below every label of row 2', () => {
    const h = rem(boxBlock?.[1])
    expect(h).toBeGreaterThan(ROW_3_PHOTO_TOP_REM)
    expect(h).toBeLessThan(ROW_3_NAME_TOP_REM)
    expect(h).toBeGreaterThan(ROW_2_LABELS_END_REM)
  })

  it('reserves exactly the box height while masonry mounts, so nothing shifts', () => {
    expect(rem(frameBlock?.[1])).toBe(rem(boxBlock?.[1]))
  })

  it('snaps rows to the top edge below 64rem, so a stopped scroll keeps the same edge', () => {
    expect(css).toMatch(
      /@media \(max-width: 63\.99rem\) \{\n  \.cities-directory__masonry \{\n    scroll-snap-type: y mandatory;/,
    )
    expect(css).toMatch(/\.cities-directory__masonry \.cities-directory__card \{\n    scroll-snap-align: start;/)
  })

  it('leaves the desktop box alone (one row of six, the tallest card is 244.8px)', () => {
    expect(css).toMatch(/@media \(min-width: 64rem\) \{[\s\S]*?\.cities-directory__masonry \{\n    height: 16rem;/)
    expect(css).toMatch(/\.cities-directory\.is-masonry \.cities-directory__masonry-frame \{\n    min-height: 16rem;/)
  })
})
