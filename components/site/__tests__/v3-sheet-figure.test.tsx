import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Sheet } from '@/components/site/v3/V3Sheet'

/**
 * The Sheet's `figure` slot (SITE-92 round 5): the data an ask stands on,
 * rendered between the head and the step, OUTSIDE the form, and only then
 * does the sheet take the figured layout. A sheet with no figure renders as
 * it always did.
 */

function render(figure?: React.ReactNode) {
  return renderToStaticMarkup(
    createElement(V3Sheet, {
      id: 'alerts',
      eyebrow: 'New listings',
      heading: 'Get new Central Oregon listings by email',
      steps: [
        {
          id: 'email',
          label: 'Where should new Central Oregon listings go?',
          field: { kind: 'email', name: 'email', label: 'Email', required: true },
          children: 'One email per new listing. Unsubscribe any time.',
          advanceLabel: 'Get alerts',
        },
      ],
      showEcho: false,
      showProgress: false,
      ...(figure ? { figure } : {}),
    }),
  )
}

describe('V3Sheet figure', () => {
  it('seats the figure between the head and the form, outside the form, and takes the figured layout', () => {
    const html = render(createElement('div', { 'data-figure': '' }, '256 houses'))
    expect(html).toContain('v3-sheet--figured')
    const head = html.indexOf('v3-sheet-head')
    const figure = html.indexOf('v3-sheet-figure')
    const form = html.indexOf('<form')
    expect(head).toBeGreaterThan(-1)
    expect(figure).toBeGreaterThan(head)
    expect(form).toBeGreaterThan(figure)
    expect(html).toContain('data-figure')
  })

  it('renders as before when there is no figure', () => {
    const html = render()
    expect(html).not.toContain('v3-sheet--figured')
    expect(html).not.toContain('v3-sheet-figure')
    expect(html).toContain('Where should new Central Oregon listings go?')
  })
})
