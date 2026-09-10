import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3Button } from '../v3/atoms'
import { V3ButtonGroup } from '../v3/V3ButtonGroup'

describe('V3ButtonGroup', () => {
  it('clusters the ask under one accessible name', () => {
    const html = renderToStaticMarkup(
      <V3ButtonGroup label="Contact about this listing">
        <V3Button href="/contact?intent=tour">Tour</V3Button>
        <V3Button href="tel:+15412136706" variant="ghost">
          Call
        </V3Button>
      </V3ButtonGroup>,
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('Contact about this listing')
    expect(html).toContain('v3-btn-group')
    expect(html).toContain('Tour')
    expect(html).toContain('Call')
  })
})
