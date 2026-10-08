/**
 * @vitest-environment jsdom
 *
 * Matt 2026-10-04: the Sunriver rail ran 7,759px down the desktop fold. Past
 * RAIL_FOLD_AT rows the rail folds behind "Show all", but every row stays in
 * the served HTML so each place name and its page link is still crawlable.
 *
 * CI 2026-10-07: the fold is ONE disclosure. The folded rows sit in their own
 * list, the list "Show all" controls and the only element carrying `hidden`,
 * because each row is the full-size partner of a map polygon (WCAG 2.5.8
 * Equivalent, ci:tap-targets) and a row hidden on its own is tied to nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot, type Root } from 'react-dom/client'
import { PlaceSubdivisionMap, PlaceSubdivisionRail } from '@/components/site/v3/PlaceSubdivisionMap.client'
import { RAIL_FOLD_AT } from '@/lib/place/rail-fold'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))

const rail = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Place ${i}`, href: `/subdivisions/place-${i}` }))

function tree(n: number) {
  return (
    <PlaceSubdivisionMap placeName="Sunriver" rail={rail(n)} homes={[]} leases={[]} keysBySlug={{}} source="regional MLS">
      <PlaceSubdivisionRail id="child-places" />
    </PlaceSubdivisionMap>
  )
}

function parse(n: number): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(tree(n)), 'text/html')
}

/** The row button for a place, by the accessible name the map polygon pairs on. */
const rowButton = (root: ParentNode, name: string) =>
  root.querySelector<HTMLButtonElement>(`button.place-subdiv-rail__button[aria-label="${name}"]`)

describe('place rail fold', () => {
  it('folds rows past the fold into one list that "Show all" controls, every name and page link kept', () => {
    const doc = parse(14)
    expect(RAIL_FOLD_AT).toBe(10)
    const more = doc.querySelector<HTMLButtonElement>('button.place-subdiv-rail__more')!
    expect(more.textContent).toBe('Show all 14')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    const folded = doc.getElementById(more.getAttribute('aria-controls') ?? '')!
    expect(folded).not.toBeNull()
    expect(folded.tagName).toBe('UL')
    expect(folded.hasAttribute('hidden')).toBe(true)
    expect(folded.querySelectorAll(':scope > li')).toHaveLength(14 - RAIL_FOLD_AT)
    // The fold list is the ONLY hidden element: no row hides on its own.
    expect([...doc.querySelectorAll('[hidden]')]).toEqual([folded])
    for (let i = 0; i < 14; i++) {
      expect(doc.querySelector(`a[href="/subdivisions/place-${i}"]`), `page link ${i}`).not.toBeNull()
      const button = rowButton(doc, `Place ${i}`)!
      expect(button, `row ${i}`).not.toBeNull()
      // At rest, or behind exactly the disclosure "Show all" opens.
      expect(folded.contains(button)).toBe(i >= RAIL_FOLD_AT)
    }
  })

  it('does not fold a short rail', () => {
    const doc = parse(RAIL_FOLD_AT)
    expect(doc.querySelector('[hidden]')).toBeNull()
    expect(doc.querySelector('button.place-subdiv-rail__more')).toBeNull()
  })
})

describe('place rail fold, in the browser', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const click = (el: Element | null) => {
    expect(el).not.toBeNull()
    act(() => (el as HTMLElement).click())
  }
  const more = () => host.querySelector('button.place-subdiv-rail__more')
  const foldList = () => host.querySelector(`[id="${more()?.getAttribute('aria-controls')}"]`)!

  it('"Show all" opens the folded list; a selected folded row stays at rest when it closes', () => {
    act(() => root.render(tree(13)))
    expect(foldList().hasAttribute('hidden')).toBe(true)

    click(more())
    expect(more()?.getAttribute('aria-expanded')).toBe('true')
    expect(foldList().hasAttribute('hidden')).toBe(false)

    // Pick the last place (Bend's would be Summit West), then fold the rail again.
    click(rowButton(host, 'Place 12'))
    click(more())
    expect(more()?.getAttribute('aria-expanded')).toBe('false')
    expect(foldList().hasAttribute('hidden')).toBe(true)
    const picked = rowButton(host, 'Place 12')!
    expect(picked.getAttribute('aria-pressed')).toBe('true')
    expect(picked.closest('[hidden]')).toBeNull()
    // The other folded rows are still one disclosure away.
    expect(foldList().contains(rowButton(host, 'Place 10'))).toBe(true)
    expect(foldList().contains(rowButton(host, 'Place 11'))).toBe(true)
  })
})
