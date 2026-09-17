import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import { TeamClosings } from './TeamClosings'

const LISTING_HREF = '/homes-for-sale/bend/nw-crossing/123-nw-bond-st-22001234'
const PHOTO = 'https://cdn.resize.sparkplatform.com/ore/800x600/true/closing-photo.jpg'
const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const CLOSINGS = readFileSync('app/team/_v3/TeamClosings.tsx', 'utf8')
const REACH = readFileSync('app/team/_v3/TeamReach.tsx', 'utf8')
const TRIO = readFileSync('app/team/_v3/TeamTrio.tsx', 'utf8')

function row(over: Partial<V3LedgerFigureRow> = {}): V3LedgerFigureRow {
  return {
    href: LISTING_HREF,
    what: v3Text('123 NW Bond St, Bend'),
    value: v3Text('$875,000'),
    when: v3Text('Sold Sep 2026'),
    detail: v3Text('3 bd · 2 ba · 1,840 sqft'),
    media: { src: PHOTO },
    ...over,
  }
}

describe('team catalog installs', () => {
  it('imports carousel, card, button-group, and avatar from components/ui', () => {
    expect(CLOSINGS).toMatch(/from '@\/components\/ui\/carousel'/)
    expect(CLOSINGS).toMatch(/from '@\/components\/ui\/card'/)
    expect(REACH).toMatch(/from '@\/components\/ui\/button-group'/)
    expect(TRIO).toMatch(/from '@\/components\/ui\/avatar'/)
    expect(PAGE).toContain('<TeamClosings')
    expect(PAGE).toContain('<TeamTrio')
  })
})

describe('TeamClosings listing door', () => {
  it('puts the closing photo, sold price, and beds/baths/sqft on the listing href', () => {
    const html = renderToStaticMarkup(createElement(TeamClosings, { rows: [row()] }))
    expect(html).toContain(`href="${LISTING_HREF}"`)
    expect(html).toContain(PHOTO)
    expect(html).toContain('$875,000')
    expect(html).toContain('3 bd · 2 ba · 1,840 sqft')
    expect(html).toContain('data-slot="carousel"')
    expect(html).toContain('data-slot="card"')
  })
})
