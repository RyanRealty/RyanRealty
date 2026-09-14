import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import { FirmClosings } from './FirmClosings'

const LISTING_HREF = '/homes-for-sale/bend/nw-crossing/123-nw-bond-st-22001234'
const PHOTO = 'https://cdn.resize.sparkplatform.com/ore/800x600/true/closing-photo.jpg'

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

function render(rows: readonly V3LedgerFigureRow[]) {
  return renderToStaticMarkup(createElement(FirmClosings, { rows }))
}

describe('FirmClosings listing door', () => {
  it('puts the closing photo inside the listing href the row already has', () => {
    const html = render([row()])
    expect(html).toContain(`href="${LISTING_HREF}"`)
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*href="${LISTING_HREF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*<img[^>]*src="${PHOTO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      ),
    )
    expect(html).not.toMatch(/<img[^>]*src="[^"]+"[^>]*>[\s\S]*<\/div>\s*<a[^>]*>See this closing/)
  })

  it('does not invent a listing path when the row has no href', () => {
    const html = render([row({ href: '   ' })])
    expect(html).toContain(`src="${PHOTO}"`)
    expect(html).not.toContain(`href="${LISTING_HREF}"`)
    expect(html).not.toMatch(/href="\/homes-for-sale\//)
  })
})
