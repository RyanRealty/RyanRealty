import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Compare, type V3CompareProps } from '@/components/site/v3/V3Compare.client'

const COMPARE_CSS = readFileSync(resolve('components/site/v3/V3Compare.css'), 'utf8')
const COMPARE_SRC = readFileSync(resolve('components/site/v3/V3Compare.client.tsx'), 'utf8')

function props(partial: Partial<V3CompareProps> = {}): V3CompareProps {
  return {
    id: 'calculator',
    eyebrow: 'Payment',
    heading: 'Same $10,000, two ways',
    claim: 'Put toward your rate, that money can lower your payment more than the same dollars off the price.',
    amount: {
      label: 'Seller dollars',
      value: 10_000,
      min: 0,
      max: 47_000,
      step: 500,
      formatted: '$10,000',
      onChange: () => {},
      hint: 'Starts at the median Bend credit.',
    },
    outcomes: [
      {
        key: 'price-cut',
        label: 'Off the price',
        value: 55.39,
        formatted: '55',
        prefix: '$',
        unit: 'a month lower',
        sentence: 'Payment $3,798.95 a month.',
        detail: 'Cash to close down $2,000.',
      },
      {
        key: 'concession',
        label: 'Toward your rate',
        value: 169.07,
        formatted: '169',
        prefix: '$',
        unit: 'a month lower',
        sentence: 'Payment $3,685.27 a month.',
      },
    ],
    verdict: 'Toward the rate saves $113.68 more a month.',
    status: { text: '$10,000 is within the 6% Conventional cap of $41,751 at 80% LTV.' },
    inputs: {
      label: 'Your numbers',
      fields: [
        { kind: 'number', name: 'price', label: 'Home price', value: 695_850, onChange: () => {} },
        {
          kind: 'select',
          name: 'loan',
          label: 'Loan type',
          value: 'conventional',
          options: [
            { value: 'conventional', label: 'Conventional' },
            { value: 'fha', label: 'FHA' },
          ],
          onChange: () => {},
        },
      ],
    },
    source: 'Freddie Mac PMMS, 30-year fixed 7.40%, week of Oct 8, 2026.',
    sourceName: 'Freddie Mac PMMS',
    legal: 'Not lending advice. Figures are principal and interest only.',
    ...partial,
  }
}

describe('V3Compare', () => {
  it('publishes both figures, the amount, the verdict and the status in the first HTML', () => {
    const html = renderToStaticMarkup(createElement(V3Compare, props()))
    expect(html).toContain('Same $10,000, two ways')
    expect(html).toContain('$10,000')
    expect(html).toContain('>55<')
    expect(html).toContain('>169<')
    expect(html).toContain('Off the price')
    expect(html).toContain('Toward your rate')
    expect(html).toContain('Toward the rate saves $113.68 more a month.')
    expect(html).toContain('within the 6% Conventional cap')
    expect(html).not.toMatch(/>0</)
  })

  it('draws the larger outcome as the lead on one shared scale', () => {
    const html = renderToStaticMarkup(createElement(V3Compare, props()))
    const lead = html.indexOf('v3-compare__outcome--lead')
    const concession = html.indexOf('Toward your rate')
    const priceCut = html.indexOf('Off the price')
    expect(lead).toBeGreaterThan(priceCut)
    expect(lead).toBeLessThan(concession)
    expect(html).toContain('--v3-compare-share:1')
    expect(html).toMatch(/--v3-compare-share:0\.32/)
  })

  it('renders the scrubber and the folded inputs as house controls, never from components/ui', () => {
    const html = renderToStaticMarkup(createElement(V3Compare, props()))
    expect(html).toContain('type="range"')
    expect(html).toContain('aria-valuetext="$10,000"')
    expect(html).toContain('<details class="v3-compare__inputs"')
    expect(html).toContain('Your numbers')
    expect(html).toContain('class="v3-input__control"')
    expect(html).toContain('v3-input__control--select')
    expect(COMPARE_SRC).not.toContain('@/components/ui')
  })

  it('names the section by its heading and drops a nameless one', () => {
    const named = renderToStaticMarkup(createElement(V3Compare, props()))
    expect(named).toContain('aria-labelledby="calculator-heading"')
    const blank = renderToStaticMarkup(createElement(V3Compare, props({ heading: '   ' })))
    expect(blank).toBe('')
  })

  it('paints the exception status with the exception token and no second hue', () => {
    const html = renderToStaticMarkup(
      createElement(V3Compare, props({ status: { text: 'Over the cap.', exception: true } })),
    )
    expect(html).toContain('v3-compare__status--exception')
    expect(COMPARE_CSS).toContain('var(--v3-exception)')
    expect(COMPARE_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
