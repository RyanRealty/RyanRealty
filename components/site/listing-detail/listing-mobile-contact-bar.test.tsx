/**
 * @vitest-environment jsdom
 *
 * Listing sticky publishes its height so the cookie bar sits above
 * Schedule · Call and cannot cover those 44px actions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Broker } from '@/lib/data/types/broker'
import ListingMobileContactBar from './ListingMobileContactBar.client'

const SRC = readFileSync(resolve('components/site/listing-detail/ListingMobileContactBar.client.tsx'), 'utf8')

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const broker = {
  slug: 'matthew-ryan',
  fullName: 'Matt Ryan',
  title: 'Principal Broker',
  email: 'matt@ryan-realty.com',
  phoneDirect: '541.703.3095',
  phoneFub: null,
  headshotPng: '/images/brokers/matthew-ryan.png',
  headshotJpg: '/images/brokers/matthew-ryan.jpg',
  licenseNumber: null,
  bio: null,
  isPrincipal: true,
} as Broker

describe('ListingMobileContactBar source', () => {
  it('publishes listing sticky height for the cookie bar to sit above', () => {
    expect(SRC).toContain('--listing-sticky-height')
    expect(SRC).toContain('dataset.listingSticky')
    expect(SRC).toContain('Schedule a tour')
    expect(SRC).toContain('lmc-tour')
    expect(SRC).toContain('lmc-call')
  })
})

describe('ListingMobileContactBar occupancy', () => {
  let container: HTMLDivElement
  let root: Root | null = null

  async function mount() {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(React.createElement(ListingMobileContactBar, { broker, listingKey: '220226279' }))
    })
  }

  function unmount() {
    if (!root) return
    const current = root
    root = null
    act(() => current.unmount())
    container.remove()
  }

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
    delete document.documentElement.dataset.listingSticky
    document.documentElement.style.removeProperty('--listing-sticky-height')
  })

  afterEach(() => {
    unmount()
    delete document.documentElement.dataset.listingSticky
    document.documentElement.style.removeProperty('--listing-sticky-height')
  })

  it('does not claim the listing-sticky slot before the bar is shown', async () => {
    await mount()
    expect(document.documentElement.dataset.listingSticky).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--listing-sticky-height')).toBe('')
    expect(container.querySelector('.listing-mobile-cta')?.getAttribute('data-shown')).toBe('false')
  })

  it('publishes listing-sticky height after the visitor scrolls to the bar', async () => {
    await mount()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 400, writable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(container.querySelector('.listing-mobile-cta')?.getAttribute('data-shown')).toBe('true')
    expect(document.documentElement.dataset.listingSticky).toBe('true')
    expect(document.documentElement.style.getPropertyValue('--listing-sticky-height')).toMatch(/px$/)
    expect(container.textContent).toContain('Schedule a tour')
    expect(container.textContent).toContain('Call')
  })
})
