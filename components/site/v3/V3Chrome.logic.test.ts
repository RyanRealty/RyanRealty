import { describe, expect, it } from 'vitest'
import { chromeLinkMove } from './V3Chrome.logic'

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
const here = { origin: 'https://ryan-realty.com', pathname: '/sell', search: '' }
const link = (href: string, target = '') => {
  const u = new URL(href, 'https://ryan-realty.com')
  return { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, protocol: u.protocol, target }
}

describe('chromeLinkMove', () => {
  it('counts a link to an anchor, on this page or another, as a move to an anchor', () => {
    expect(chromeLinkMove(click, link('/sell#get-value'), here)).toBe('anchor')
    expect(chromeLinkMove(click, link('/sell?from=nav#get-value'), here)).toBe('anchor')
    expect(chromeLinkMove(click, link('/how-we-get-our-numbers#months-of-supply'), here)).toBe('anchor')
  })

  it('counts a link to another page as a move', () => {
    expect(chromeLinkMove(click, link('/housing-market'), here)).toBe('page')
    expect(chromeLinkMove(click, link('/sell?from=nav'), here)).toBe('page')
  })

  it('moves nobody on a link to the page already showing, so the menu hands focus back', () => {
    expect(chromeLinkMove(click, link('/sell'), here)).toBeNull()
  })

  it('moves nobody on a modified click, a call link or a new tab', () => {
    expect(chromeLinkMove({ ...click, metaKey: true }, link('/housing-market'), here)).toBeNull()
    expect(chromeLinkMove({ ...click, ctrlKey: true }, link('/housing-market'), here)).toBeNull()
    expect(chromeLinkMove({ ...click, shiftKey: true }, link('/housing-market'), here)).toBeNull()
    expect(chromeLinkMove({ ...click, button: 1 }, link('/housing-market'), here)).toBeNull()
    expect(chromeLinkMove(click, link('tel:+15417033095'), here)).toBeNull()
    expect(chromeLinkMove(click, link('/sell#get-value', '_blank'), here)).toBeNull()
    expect(chromeLinkMove(click, link('/housing-market', '_self'), here)).toBe('page')
  })
})
