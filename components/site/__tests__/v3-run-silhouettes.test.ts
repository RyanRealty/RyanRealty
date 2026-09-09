import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Ledger, type V3LedgerPlainRow } from '@/components/site/v3/V3Ledger'
import { v3Text } from '@/components/site/v3/atoms'

/**
 * SITE-07 quality pass (2026-09-09). Two defects the neighborhood class lost
 * points on, both fixed in the primitive each lives in:
 *
 *  1. The atlas chips were a hidden-scrollbar horizontal rail under 48rem, and
 *     the record showed the third chip cut mid-word at the viewport edge. The
 *     mobile mandate bans horizontal scroll and decisions.md bans section
 *     rails, so the chips wrap at every width and a long set folds on a phone.
 *  2. Three consecutive Ledgers (pulse, walk, magazine) differed by a thumb
 *     size and a date style: three names, one silhouette. Walk is now a
 *     date-led timeline and magazine a card grid.
 *
 * These tests hold the stylesheet to that: no rail, a fold, and per-layout
 * rules that change layout rather than decoration. They read the CSS as text,
 * the way place-grain-openings.test.ts reads a page, because a rule that lives
 * only in a screenshot is lost the next time someone "tidies" the file.
 */

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of every rule whose selector list matches. */
function rulesFor(css: string, selector: string | RegExp): string[] {
  const out: string[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const sel = m[1]!.trim()
    const hit = typeof selector === 'string' ? sel.split(',').some((s) => s.trim() === selector) : selector.test(sel)
    if (hit) out.push(m[2]!)
  }
  return out
}

/** The body of every media block whose query matches. */
function mediaBlocks(css: string, query: RegExp): string[] {
  const out: string[] = []
  const re = /@media([^{]+)\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (!query.test(m[1]!)) continue
    let depth = 1
    let i = re.lastIndex
    for (; i < css.length && depth > 0; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') depth -= 1
    }
    out.push(css.slice(re.lastIndex, i - 1))
  }
  return out
}

describe('V3Atlas chips: wrapped at every width, folded on a phone', () => {
  const css = stripComments(readFileSync(resolve('components/site/v3/V3Atlas.css'), 'utf8'))
  const chips = rulesFor(css, '.v3-atlas__chips').join('\n')

  it('is a wrapping row, never a scroll rail', () => {
    expect(chips).toMatch(/flex-wrap:\s*wrap/)
    for (const rule of rulesFor(css, /\.v3-atlas__chips\b/)) {
      expect(rule).not.toMatch(/overflow-x:\s*auto/)
      expect(rule).not.toMatch(/scrollbar-width:\s*none/)
      expect(rule).not.toMatch(/flex-wrap:\s*nowrap/)
      expect(rule).not.toMatch(/scroll-snap-type/)
    }
    expect(css).not.toMatch(/\.v3-atlas__chips::-webkit-scrollbar/)
  })

  it('folds behind one trailing chip at every width: eight on a phone, twenty-four from 48rem', () => {
    const phone = mediaBlocks(css, /max-width:\s*47\.99rem/).join('\n')
    // On a phone both rests fold and the narrow count shows.
    expect(phone).toMatch(/\.v3-atlas__chips-rest\.is-folded,\s*\.v3-atlas__chips-rest-wide\.is-folded\s*\{[^}]*display:\s*none/)
    expect(phone).toMatch(/\.v3-atlas__chip-name--wide\s*\{[^}]*display:\s*none/)
    // From 48rem only the wide rest folds, the wide count shows, and a set that
    // fits in twenty-four offers no chip at all.
    const wide = mediaBlocks(css, /min-width:\s*48rem/).join('\n')
    expect(wide).toMatch(/\.v3-atlas__chips-rest-wide\.is-folded\s*\{[^}]*display:\s*none/)
    expect(wide).toMatch(/\.v3-atlas__chip-name--narrow\s*\{[^}]*display:\s*none/)
    expect(wide).toMatch(/\.v3-atlas__chip--more-narrow-only\s*\{[^}]*display:\s*none/)
    // The chip itself is offered at every width, in the register's own style.
    expect(rulesFor(css, '.v3-atlas__chip--more').join('\n')).toMatch(/display:\s*inline-flex/)
    expect(rulesFor(css, '.v3-atlas__chip--more').some((r) => /display:\s*none/.test(r))).toBe(false)
    // The folded chips stay in the same wrapping row as the first eight.
    expect(rulesFor(css, /\.v3-atlas__chips-rest(-wide)?$/).join('\n')).toMatch(/display:\s*contents/)
  })

  it('gives a chip name room so the ellipsis is the exception', () => {
    const name = rulesFor(css, '.v3-atlas__chip-name').join('\n')
    expect(name).toMatch(/max-width:\s*18rem/)
    expect(name).toMatch(/white-space:\s*nowrap/)
  })

  it('lands its hash under the sticky chrome, not beneath it', () => {
    expect(rulesFor(css, '.v3.v3-atlas[id]').join('\n')).toMatch(/scroll-margin-top:\s*calc\(var\(--v3-chrome-h\)/)
  })
})

describe('V3Ledger: pulse, walk and magazine are three silhouettes', () => {
  const css = stripComments(readFileSync(resolve('components/site/v3/V3Ledger.css'), 'utf8'))

  it('walk is a timeline: rows hang off one left rule and lead with a calendar tile', () => {
    const list = rulesFor(css, '.v3-ledger--walk .v3-ledger__list').join('\n')
    expect(list).toMatch(/border-left:\s*var\(--v3-rule-hairline\)/)
    expect(list).toMatch(/border-bottom:\s*0/)
    const row = rulesFor(css, '.v3-ledger--walk .v3-ledger__row').join('\n')
    expect(row).toMatch(/border-top:\s*0/)
    expect(row).toMatch(/grid-template-areas/)
    const tile = rulesFor(css, '.v3-ledger--walk .v3-ledger__tile').join('\n')
    expect(tile).toMatch(/grid-area:\s*tile/)
    expect(rulesFor(css, '.v3-ledger--walk .v3-ledger__tile-day').join('\n')).toMatch(/tabular-nums/)
  })

  it('magazine is a card grid: two columns from 40rem with the lead spanning both, 3:2 photos, hairline edges', () => {
    const list = rulesFor(css, '.v3-ledger--magazine .v3-ledger__list').join('\n')
    expect(list).toMatch(/display:\s*grid/)
    const wide = mediaBlocks(css, /min-width:\s*40rem/).join('\n')
    expect(wide).toMatch(/\.v3-ledger--magazine \.v3-ledger__list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    expect(wide).toMatch(/\.v3-ledger--magazine \.v3-ledger__item:first-child\s*\{[^}]*grid-column:\s*1 \/ -1/)
    const thumb = rulesFor(css, '.v3-ledger--magazine .v3-ledger__thumb').join('\n')
    expect(thumb).toMatch(/aspect-ratio:\s*3 \/ 2/)
    expect(thumb).toMatch(/object-fit|width:\s*100%/)
    const card = rulesFor(css, /\.v3-ledger--magazine \.v3-ledger__row\b/).join('\n')
    expect(card).toMatch(/border:\s*var\(--v3-rule-hairline\)/)
    expect(card).toMatch(/border-radius:\s*var\(--v3-radius-card\)/)
    expect(card).not.toMatch(/box-shadow/)
    expect(css).not.toMatch(/gradient\(/)
  })

  it('the magazine lead card sets its detail line in body type at every width', () => {
    const wide = mediaBlocks(css, /min-width:\s*40rem/).join('\n')
    expect(wide).toMatch(/\.v3-ledger--magazine \.v3-ledger__item:first-child \.v3-ledger__detail\s*\{[^}]*font-family:\s*var\(--v3-font-body\)/)
    expect(rulesFor(css, '.v3-ledger--magazine .v3-ledger__thumb').join('\n')).not.toMatch(/border-radius:\s*0\b/)
  })

  it('walk carries no photo rule: the tile is the mark', () => {
    expect(rulesFor(css, '.v3-ledger--walk .v3-ledger__thumb')).toEqual([])
  })

  it('pulse stays the feed and shares no layout rule with the other two', () => {
    expect(rulesFor(css, '.v3-ledger--pulse .v3-ledger__list')).toEqual([])
    expect(rulesFor(css, '.v3-ledger--pulse .v3-ledger__thumb').join('\n')).toMatch(/width:\s*4\.5rem/)
  })

  it('a row label wraps instead of clipping while the figure stays on one line', () => {
    expect(rulesFor(css, '.v3-ledger__label').join('\n')).toMatch(/white-space:\s*normal/)
    expect(rulesFor(css, '.v3-ledger__value').join('\n')).toMatch(/white-space:\s*nowrap/)
  })

  it('uses only tokens for color', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch)\(/)
  })
})

describe('V3Ledger walk rows render the calendar tile from preformatted strings', () => {
  const row: V3LedgerPlainRow = {
    href: '/listing/1',
    when: v3Text('12pm-3pm'),
    date: { weekday: v3Text('Thu'), day: v3Text('10'), month: v3Text('Sep') },
    what: v3Text('2765 High Lakes Loop'),
  }
  const render = (layout: 'walk' | 'list' | 'magazine') =>
    renderToStaticMarkup(
      createElement(V3Ledger, { heading: v3Text('Open houses'), layout, rows: [row, { ...row, href: '/listing/2' }] }),
    )

  it('walk leads with the tile and keeps the list of links', () => {
    const html = render('walk')
    expect(html).toMatch(/v3-ledger--walk/)
    expect(html).toMatch(
      /<span class="v3-ledger__tile"><span class="v3-ledger__tile-weekday">Thu<\/span><span class="v3-ledger__tile-day">10<\/span><span class="v3-ledger__tile-month">Sep<\/span><\/span>/,
    )
    expect(html).toMatch(/v3-ledger__row--tile/)
    expect(html).toMatch(/<ul class="v3-ledger__list">/)
    expect((html.match(/href="\/listing\/\d"/g) ?? []).length).toBe(2)
    expect((html.match(/<li class="v3-ledger__item">/g) ?? []).length).toBe(2)
  })

  it('walk draws no media even when the row carries it; list still does', () => {
    const withMedia = { ...row, media: { src: '/images/x.jpg' } }
    const walk = renderToStaticMarkup(
      createElement(V3Ledger, { heading: v3Text('Open houses'), layout: 'walk', rows: [withMedia] }),
    )
    expect(walk).not.toMatch(/v3-ledger__thumb/)
    expect(walk).not.toMatch(/v3-ledger__what--media/)
    const list = renderToStaticMarkup(
      createElement(V3Ledger, { heading: v3Text('Activity'), layout: 'list', rows: [withMedia] }),
    )
    expect(list).toMatch(/v3-ledger__thumb/)
  })

  it('the other layouts print `when` alone and never the tile', () => {
    for (const layout of ['list', 'magazine'] as const) {
      const html = render(layout)
      expect(html).not.toMatch(/v3-ledger__tile/)
      expect(html).toMatch(/v3-ledger__when">12pm-3pm</)
      expect(html).toMatch(/<ul class="v3-ledger__list">/)
    }
  })
})
