import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Sheet } from '@/components/site/v3'

describe('V3Sheet line-input autocomplete', () => {
  it('maps street-address to address-line1 on a one-line input', () => {
    const markup = renderToStaticMarkup(
      createElement(V3Sheet, {
        heading: 'Price your home',
        steps: [
          {
            id: 'address',
            label: 'Which address should we price?',
            field: {
              kind: 'text',
              name: 'address',
              label: 'Home address',
              autoComplete: 'street-address',
            },
            advanceLabel: 'Continue',
          },
        ],
      }),
    )
    expect(markup).toContain('autoComplete="address-line1"')
    expect(markup).not.toContain('autoComplete="street-address"')
  })

  it('keeps street-address on a textarea', () => {
    const markup = renderToStaticMarkup(
      createElement(V3Sheet, {
        heading: 'Price your home',
        steps: [
          {
            id: 'address',
            label: 'Which address should we price?',
            field: {
              kind: 'textarea',
              name: 'address',
              label: 'Home address',
              autoComplete: 'street-address',
            },
            advanceLabel: 'Continue',
          },
        ],
      }),
    )
    expect(markup).toContain('autoComplete="street-address"')
    expect(markup).not.toContain('autoComplete="address-line1"')
  })
})
