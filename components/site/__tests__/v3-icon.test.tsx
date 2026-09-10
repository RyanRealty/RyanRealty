import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QUIET_MARK_ICON, V3_ICON_NAMES, V3Icon } from '../v3/V3Icon'

describe('V3Icon', () => {
  it('renders an Iconoir stroke mark in currentColor, aria-hidden', () => {
    const html = renderToStaticMarkup(<V3Icon name="Phone" size={16} />)
    expect(html).toContain('viewBox="0 0 24 24"')
    expect(html).toContain('width="16"')
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('labels the svg when a title is passed', () => {
    const html = renderToStaticMarkup(<V3Icon name="Phone" title="Call" />)
    expect(html).toContain('aria-label="Call"')
    expect(html).not.toContain('aria-hidden="true"')
  })

  it('covers every quiet channel except the MOS two-bar drawing', () => {
    expect(Object.keys(QUIET_MARK_ICON).sort()).toEqual(
      ['call', 'email', 'external', 'history', 'map', 'market', 'page', 'person', 'review', 'schedule', 'text'].sort(),
    )
    for (const name of Object.values(QUIET_MARK_ICON)) {
      expect(V3_ICON_NAMES).toContain(name)
    }
  })

  it('ships the chrome, door, social, and bell names', () => {
    for (const name of [
      'NavArrowDown',
      'Menu',
      'Xmark',
      'ArrowRight',
      'Home',
      'HomeSale',
      'Building',
      'Instagram',
      'Facebook',
      'Youtube',
      'Tiktok',
      'X',
      'Linkedin',
      'BellNotification',
    ] as const) {
      expect(V3_ICON_NAMES).toContain(name)
      const html = renderToStaticMarkup(<V3Icon name={name} />)
      expect(html).toContain('<path')
    }
  })
})
