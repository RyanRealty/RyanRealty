import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Footer, V3_FOOTER_COLUMNS } from '@/components/site/v3/V3Footer'

/**
 * The footer folds its sitemap on a phone: 2,599px of stacked links became 947px
 * of five named groups, measured on the homepage at 375 before and after.
 *
 * A fold is only honest if it hides nothing. These tests hold the two things a
 * fold can silently break — a destination that stops existing, and a count that
 * stops matching the group it labels — plus the reason it needs no client JS.
 */

function html() {
  return renderToStaticMarkup(
    createElement(V3Footer, { columns: V3_FOOTER_COLUMNS, copyrightYear: '2026' }),
  )
}

const hrefs = (s: string) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)

describe('the footer fold', () => {
  it('keeps EVERY destination in the markup, so folding costs no link', () => {
    const out = html()
    const wanted = V3_FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href))
    const got = new Set(hrefs(out))
    expect(wanted.length).toBeGreaterThan(30)
    for (const href of wanted) expect(got.has(href), href).toBe(true)
  })

  it('opens one disclosure per column, each holding that column list', () => {
    const out = html()
    const details = out.match(/<details class="v3-footer__fold">/g) ?? []
    expect(details).toHaveLength(V3_FOOTER_COLUMNS.length)
    expect(out.match(/<summary class="v3-footer__column-title">/g) ?? []).toHaveLength(
      V3_FOOTER_COLUMNS.length,
    )
  })

  it('labels each group with the number of destinations it actually holds', () => {
    const out = html()
    for (const column of V3_FOOTER_COLUMNS) {
      // The summary reads "<heading><count>"; a count that drifts from its own
      // list is worse than no count, because it is a promise about what opening
      // will cost.
      const re = new RegExp(
        `${column.heading}<span class="v3-footer__count">${column.links.length}</span>`,
      )
      expect(out, column.heading).toMatch(re)
    }
  })

  it('ships NO disclosure open, because an open fold saves nothing', () => {
    expect(html()).not.toMatch(/<details class="v3-footer__fold" open/)
  })

  it('stays a server component: no client JS drives the fold', () => {
    // A native details works before hydration. If this ever needs "use client"
    // the footer has stopped being free on every page on the site.
    const out = html()
    expect(out).toMatch(/<details/)
    expect(out).not.toMatch(/onclick=/i)
  })

  it('still carries the Oregon Data Share attribution OUTSIDE any fold', () => {
    // ODS display rules put source identification and the reliability
    // disclaimer on every IDX display. Behind a disclosure is not on display.
    const out = html()
    const ods = out.indexOf('Oregon Data Share')
    expect(ods).toBeGreaterThan(-1)
    const lastFoldEnd = out.lastIndexOf('</details>')
    expect(ods).toBeGreaterThan(lastFoldEnd)
  })

  it('keeps the legal row and the broker line unfolded too', () => {
    const out = html()
    const lastFoldEnd = out.lastIndexOf('</details>')
    expect(out.indexOf('Equal Housing Opportunity')).toBeGreaterThan(lastFoldEnd)
    expect(out.indexOf('Privacy')).toBeGreaterThan(lastFoldEnd)
  })
})
