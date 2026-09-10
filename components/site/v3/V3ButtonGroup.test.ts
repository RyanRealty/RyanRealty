import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3Button } from './atoms'
import { V3ButtonGroup } from './V3ButtonGroup'

describe('V3ButtonGroup', () => {
  it('clusters the ask under one accessible name', () => {
    const html = renderToStaticMarkup(
      createElement(
        V3ButtonGroup,
        { label: 'Contact about this listing' },
        createElement(V3Button, { href: '/contact?intent=tour' }, 'Tour'),
        createElement(V3Button, { href: 'tel:+15412136706', variant: 'ghost' }, 'Call'),
      ),
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('Contact about this listing')
    expect(html).toContain('v3-btn-group')
    expect(html).toContain('Tour')
    expect(html).toContain('Call')
  })
})
