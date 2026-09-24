/**
 * @vitest-environment jsdom
 *
 * SITE-119 — ci:route-content-floor must not count aria-hidden decoration
 * as section items. The cities and community Atlas docks render four empty
 * sales-legend swatch <li>s inside <ol aria-hidden="true">. The 2026-09-12
 * seed counted those chips (observed 9 = 5 real rows + 4 chips). This file
 * mounts the live markup shape in jsdom and asserts measurePage() reports 5.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { SECTION_TOLERANCE, measurePage, seedSectionFloors } from '../lib/content-floor.mjs'

function atlasDock({ swatchAriaHidden = 'true', includeKeyMarks = true } = {}) {
  const swatchAttr = swatchAriaHidden === null ? '' : ` aria-hidden="${swatchAriaHidden}"`
  const mark = includeKeyMarks ? '<span class="v3-atlas__key-mark" aria-hidden="true"></span>' : ''
  return `
    <section id="atlas">
      <div class="v3-atlas__dock">
        <div
          class="v3-atlas__sales-legend"
          role="img"
          aria-label="Sales heat, fewer sales to more sales, last 90 days."
        >
          <span class="v3-atlas__sales-legend-end">fewer sales</span>
          <ol class="v3-atlas__sales-swatches"${swatchAttr}>
            <li class="v3-atlas__sales-swatch v3-atlas__sales-swatch--1"></li>
            <li class="v3-atlas__sales-swatch v3-atlas__sales-swatch--2"></li>
            <li class="v3-atlas__sales-swatch v3-atlas__sales-swatch--3"></li>
            <li class="v3-atlas__sales-swatch v3-atlas__sales-swatch--4"></li>
          </ol>
          <span class="v3-atlas__sales-legend-end">more sales</span>
          <p class="v3-atlas__sales-legend-window">last 90 days</p>
        </div>
        <ul class="v3-atlas__key" aria-label="What the marks mean">
          <li class="v3-atlas__key-item">${mark}12 for sale</li>
          <li class="v3-atlas__key-item">${mark}3 pending</li>
        </ul>
      </div>
      <ul class="v3-atlas__live" aria-label="Latest activity">
        <li class="v3-atlas__live-item">listed</li>
        <li class="v3-atlas__live-item">pending</li>
        <li class="v3-atlas__live-item">closed</li>
      </ul>
    </section>
  `
}

function naiveTopmostItemCount(section) {
  const itemSelector = 'li, article, tr, [data-floor-item]'
  let items = 0
  for (const c of Array.from(section.querySelectorAll(itemSelector))) {
    let p = c.parentElement
    let topmost = true
    while (p && p !== section) {
      if (p.matches(itemSelector)) {
        topmost = false
        break
      }
      p = p.parentElement
    }
    if (topmost) items += 1
  }
  return items
}

describe('content-floor measurePage — SITE-119 aria-hidden decoration', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not count the four empty sales-legend swatch <li>s (cities / community Atlas)', () => {
    document.body.innerHTML = `<main>${atlasDock()}</main>`
    const section = document.getElementById('atlas')
    // The pre-SITE-119 counter: 4 empty swatches + 2 key rows + 3 live rows.
    expect(naiveTopmostItemCount(section)).toBe(9)
    const measured = measurePage()
    expect(measured.sectionDepth.atlas.items).toBe(5)
  })

  it('still counts a real key row whose child mark is aria-hidden', () => {
    document.body.innerHTML = `
      <main>
        <section id="atlas">
          <ul class="v3-atlas__key" aria-label="What the marks mean">
            <li class="v3-atlas__key-item">
              <span class="v3-atlas__key-mark" aria-hidden="true"></span>
              12 for sale
            </li>
          </ul>
        </section>
      </main>
    `
    expect(measurePage().sectionDepth.atlas.items).toBe(1)
  })

  it('treats bare aria-hidden the same as aria-hidden="true"', () => {
    document.body.innerHTML = `
      <main>
        <section id="atlas">
          <ol class="v3-atlas__sales-swatches" aria-hidden>
            <li class="v3-atlas__sales-swatch"></li>
            <li class="v3-atlas__sales-swatch"></li>
          </ol>
          <ul><li>Bend 627 closes</li></ul>
        </section>
      </main>
    `
    expect(measurePage().sectionDepth.atlas.items).toBe(1)
  })

  it('reports why a section read low: candidates, hidden rows, and what hid them', () => {
    document.body.innerHTML = `
      <main>
        <div class="v3-overlay-host" aria-hidden="true">
          <section id="towns"><ul class="v3-ledger__list"><li>Bend 13 for lease</li><li>Redmond 12 for lease</li></ul></section>
        </div>
        <section id="edges"><ul><li>Talk to a broker</li></ul></section>
      </main>
    `
    const measured = measurePage()
    expect(measured.sectionDepth.towns.items).toBe(0)
    expect(measured.sectionDiag.towns).toEqual({
      tag: 'section',
      candidates: 2,
      hiddenItems: 2,
      hiddenBy: 'div.v3-overlay-host',
      overlayHidden: false,
    })
    expect(measured.sectionDiag.edges).toEqual({ tag: 'section', candidates: 1, hiddenItems: 0, hiddenBy: null, overlayHidden: false })
  })

  it('counts rows a modal manager hid (data-aria-hidden), never the page\'s own aria-hidden', () => {
    document.body.innerHTML = `
      <main>
        <section id="towns" aria-hidden="true" data-aria-hidden="true">
          <ul><li>Bend 13 for lease</li><li>Redmond 12 for lease</li></ul>
        </section>
        <section id="atlas">
          <ol aria-hidden="true"><li></li><li></li></ol>
          <ul><li>Bend 627 closes</li></ul>
        </section>
        <div role="dialog" data-state="open" class="signin-dialog"></div>
      </main>
    `
    const measured = measurePage()
    expect(measured.sectionDepth.towns.items).toBe(2)
    expect(measured.sectionDiag.towns.overlayHidden).toBe(true)
    expect(measured.sectionDepth.atlas.items).toBe(1)
    expect(measured.openDialogs).toEqual(['div.signin-dialog'])
  })

  it('does not skip a row under aria-hidden="false"', () => {
    document.body.innerHTML = `
      <main>
        <section id="atlas">
          <ul aria-hidden="false">
            <li>visible row</li>
          </ul>
        </section>
      </main>
    `
    expect(measurePage().sectionDepth.atlas.items).toBe(1)
  })

  it('documents the proposed re-seed math without writing it: 5 real items → floor 4', () => {
    const { floors } = seedSectionFloors({ atlas: { items: 5, words: 36 } })
    expect(floors.atlas.items).toBe(Math.floor(5 * SECTION_TOLERANCE))
    expect(floors.atlas.items).toBe(4)
    // The 2026-09-12 seed used the decorated 9 → floor 8. That drop is
    // counted-decoration and needs Matt's explicit yes — not this PR.
    const decorated = seedSectionFloors({ atlas: { items: 9, words: 36 } })
    expect(decorated.floors.atlas.items).toBe(8)
  })
})
