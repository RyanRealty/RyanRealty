import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Answers } from '@/components/site/v3/V3Answers'

/**
 * A node's outbound edges fold past six.
 *
 * The community page closed on FORTY-ONE of them as one flat list — every
 * recorded governing document, every golf course, every sibling resort, plus
 * the generic site edges — about 2,000px of the section's 3,405px. Folding
 * rather than cutting is the point: the internal-link gates read these edges
 * and a crawler reads a closed disclosure exactly as it reads an open list, so
 * the fold may cost the reader scrolling but must never cost a destination.
 */

const q = [{ question: 'Does Tetherow have an HOA?', body: 'Yes. Annual dues run $2,052.' }]

function doors(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    label: `Door ${i + 1}`,
    href: `/communities/door-${i + 1}`,
  }))
}

function render(doorCount: number, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(V3Answers, {
      id: 'faq',
      heading: 'Tetherow real estate questions',
      questions: q,
      doors: doors(doorCount),
      ...extra,
    }),
  )
}

describe('V3Answers doors', () => {
  it('leaves a short set in the flow — six exits are not a scrolling list', () => {
    const html = render(6)
    expect(html).not.toContain('v3-answers__edges')
    expect(html).toContain('v3-answers__doors')
    expect(html.match(/v3-answers__door-item/g)).toHaveLength(6)
  })

  it('folds past six, and NEVER drops a destination', () => {
    const html = render(41)
    expect(html).toContain('<details class="v3-answers__edges">')
    // Every one of the 41 is still an anchor in the served HTML.
    expect(html.match(/v3-answers__door-item/g)).toHaveLength(41)
    for (let i = 1; i <= 41; i += 1) {
      expect(html, `door ${i}`).toContain(`/communities/door-${i}`)
    }
  })

  it('ships the fold CLOSED, or it saves nothing', () => {
    expect(render(41)).not.toContain('<details class="v3-answers__edges" open')
  })

  it('names the count, so the fold is an offer and not a hiding place', () => {
    const html = render(41)
    expect(html).toMatch(/v3-answers__edges-count">41/)
  })

  it('labels the set by where it goes, not by the questions above it', () => {
    const html = render(41)
    expect(html).toContain('Where to go next')
    // The old wording read "Everything else about Tetherow real estate
    // questions" — the heading glued to a prefix, which is about the questions
    // rather than the destinations.
    expect(html).not.toContain('Everything else about')
  })

  it('lets a caller name the set itself', () => {
    expect(render(41, { doorsLabel: 'Tetherow documents and neighbours' })).toContain(
      'Tetherow documents and neighbours',
    )
  })

  it('wears the same +/- mark as the questions beside it, not a second glyph', () => {
    const html = render(41)
    // One mark class in the section, used by both the questions and the fold.
    expect(html).toContain('v3-answers__mark')
    expect(html).not.toContain('v3-answers__edges-mark')
  })

  it('still renders nothing when there is neither a question nor a door', () => {
    const html = renderToStaticMarkup(
      createElement(V3Answers, { id: 'faq', heading: 'Questions', questions: [], doors: [] }),
    )
    expect(html).toBe('')
  })

  it('folds the doors even when every question was dropped as unnameable', () => {
    const html = renderToStaticMarkup(
      createElement(V3Answers, {
        id: 'faq',
        heading: 'Questions',
        questions: [{ question: '   ', body: '' }],
        doors: doors(20),
      }),
    )
    expect(html).toContain('v3-answers__edges')
    expect(html.match(/v3-answers__door-item/g)).toHaveLength(20)
  })
})
