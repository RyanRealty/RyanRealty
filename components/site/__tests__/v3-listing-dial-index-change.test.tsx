/**
 * @vitest-environment jsdom
 *
 * The dial's onIndexChange (2026-09-25 integration). Three shelves keep a
 * figure for ONE listing beside the dial rather than in its card: the
 * new-construction concession, the /buy asking-price ladder's filled mark and
 * the type page's Atlas ring. They followed the dial by reading its DOM
 * (useListingDialIndex, a MutationObserver on aria-selected); they follow it
 * through the callback now. This holds the callback's contract (every kind of
 * turn fires it once with the new index; mount and a no-op turn do not) and
 * that two of those shelves move with the dial.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { V3ListingDial, type V3ListingDialItem } from '@/components/site/v3/V3ListingDial.client'
import { NewConLeadShelf } from '@/app/new-construction/_v3/NewConLeadShelf.client'
import type { NewConHomeCard } from '@/app/new-construction/_v3/load-lead-shelf'
import { BuyHomesShelf } from '@/app/buy/_v3/BuyHomesShelf.client'
import type { HomeRailCard } from '@/app/_v3/home-rail-items'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

function listing(n: number): V3ListingDialItem {
  return {
    listingKey: `k${n}`,
    href: `/homes-for-sale/bend/${n}-main-st-22000000${n}`,
    photoUrl: `https://cdn.resize.sparkplatform.com/ore/800x600/true/k${n}-o.jpg`,
    price: 500_000 + n * 10_000,
    addressLine: `${n} Main St`,
    cityLine: 'Bend 97701',
    beds: 3,
    baths: 2,
    sqft: 1_600,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: null,
    city: 'Bend',
    listNumber: `22000000${n}`,
    // No reel lookups in a unit test.
    hasVideo: false,
  }
}

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

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('nothing to click')
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function key(el: Element | null | undefined, k: string) {
  if (!el) throw new Error('nothing to key')
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })
}

describe('V3ListingDial onIndexChange', () => {
  it('fires once per turn with the new index, for every way of turning, and never on mount', () => {
    const seen: number[] = []
    render(
      <V3ListingDial
        id="d"
        label="Homes"
        listings={[listing(1), listing(2), listing(3), listing(4)]}
        onIndexChange={(i) => seen.push(i)}
      />,
    )
    expect(seen).toEqual([])

    click(host.querySelector('[aria-label="Next listing"]'))
    expect(seen).toEqual([1])

    click(host.querySelector('#d-tab-3'))
    expect(seen).toEqual([1, 3])

    key(host.querySelector('[role="tablist"]'), 'Home')
    expect(seen).toEqual([1, 3, 0])

    // Previous from the first wraps to the last, as the readout does.
    click(host.querySelector('[aria-label="Previous listing"]'))
    expect(seen).toEqual([1, 3, 0, 3])

    key(host.querySelector('[role="tablist"]'), 'ArrowRight')
    expect(seen).toEqual([1, 3, 0, 3, 0])
  })

  it('does not fire for a turn onto the card already showing', () => {
    const onIndexChange = vi.fn()
    render(<V3ListingDial id="d" label="Homes" listings={[listing(1), listing(2)]} onIndexChange={onIndexChange} />)
    click(host.querySelector('#d-tab-0'))
    expect(onIndexChange).not.toHaveBeenCalled()
  })

  it('reports the index the card and the readout show', () => {
    let last = -1
    render(
      <V3ListingDial
        id="d"
        label="Homes"
        listings={[listing(1), listing(2), listing(3)]}
        onIndexChange={(i) => {
          last = i
        }}
      />,
    )
    click(host.querySelector('#d-tab-2'))
    expect(last).toBe(2)
    expect(host.querySelector('#d-tab-2')?.getAttribute('aria-selected')).toBe('true')
    expect(host.querySelector('#d-card-2')?.hasAttribute('hidden')).toBe(false)
    expect(host.querySelector('.v3-dial__pos-now')?.textContent).toBe('03')
  })
})

function railCard(n: number, price: number): HomeRailCard {
  const row = listing(n)
  return {
    listingKey: row.listingKey,
    href: row.href,
    photoUrls: [row.photoUrl!],
    price,
    addressLine: row.addressLine,
    cityLine: row.cityLine,
    beds: 3,
    baths: 2,
    sqft: 1_600,
    pricePerSqft: 300,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: null,
    city: 'Bend',
    listNumber: row.listNumber,
    badges: [],
    hasTour: false,
    tourUrl: null,
    tourLabel: '3D',
    statusLabel: null,
  }
}

describe('what sits beside the dial follows it', () => {
  it('the new-construction concession turns with the dial', () => {
    const cards: NewConHomeCard[] = [1, 2, 3].map((n) => ({
      ...railCard(n, 500_000 + n),
      builderName: `Builder ${n}`,
      concession: null,
    }))
    render(<NewConLeadShelf heading="Live homes" note="note" cards={cards} seeAllHref="/x" />)
    const shownBuilder = () =>
      [...host.querySelectorAll('.newcon-lead__card-offer')]
        .filter((el) => !el.hasAttribute('hidden'))
        .map((el) => el.textContent)
    expect(shownBuilder()).toEqual(['Built by Builder 1'])
    click(host.querySelector('[aria-label="Next listing"]'))
    expect(shownBuilder()).toEqual(['Built by Builder 2'])
    click(host.querySelector('#newcon-lead-dial-tab-2'))
    expect(shownBuilder()).toEqual(['Built by Builder 3'])
  })

  it('the /buy ladder fills the mark of the home the dial shows', () => {
    const cards = [railCard(1, 450_000), railCard(2, 520_000), railCard(3, 610_000)]
    render(<BuyHomesShelf row={{ id: 'homes-lead', heading: 'Homes', cards }} />)
    // The first band ("Any price") is the one open; its ladder is the first.
    const ladder = host.querySelector('.buy-ladder')!
    const on = () => [...ladder.querySelectorAll('.buy-ladder__mark')].findIndex((m) => m.classList.contains('is-on'))
    expect(on()).toBe(0)
    const dial = host.querySelector('.buy-shelf__dial')!
    click(dial.querySelector('[aria-label="Next listing"]'))
    expect(on()).toBe(1)
  })
})
