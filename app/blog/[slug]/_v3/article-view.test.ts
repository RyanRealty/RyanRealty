import { describe, expect, it } from 'vitest'
import { buildBlogArticleView, figureKey, sentenceAt, slugifyHeading } from './article-view'

const BODY = `
<p>The lede paragraph, which carries no heading of its own.</p>
<h2>What does a home cost right now?</h2>
<p>Over the last 12 months, the median sale price was $1,349,000, from 11 closings. There are 207 detached homes in the neighborhood.</p>
<h2>How fast do homes sell?</h2>
<p>Over the last 12 months, the median time from listing to accepted contract was 29.5 days, based on 10 homes.</p>
<h2>What do the dues cover?</h2>
<p>The median due is $87 a month, or $1,044 a year, based on the 50 current listings that report dues. <a href="https://www.example.org/dues" target="_blank" rel="noopener nofollow">The association's own page</a> lists what that buys.</p>
<h2>How old are the homes?</h2>
<p>The housing stock runs roughly 20 to 48 years old, so an inspection matters.</p>
<h2>Questions</h2>
<h3>Is this the same place?</h3>
<p>Yes, it is the same place under two names.</p>
<h3>How many homes are there?</h3>
<p>207 detached homes.</p>
<h2>Next step</h2>
<p>Talk to us, or see the <a href="/communities/awbrey-glen">community page</a>.</p>
`

describe('buildBlogArticleView', () => {
  const view = buildBlogArticleView(BODY)

  it('lists every h2 as a section and gives each one a stable id', () => {
    expect(view.sections.map((s) => s.label)).toEqual([
      'What does a home cost right now?',
      'How fast do homes sell?',
      'What do the dues cover?',
      'How old are the homes?',
      'Questions',
      'Next step',
    ])
    expect(view.html).toContain('id="what-does-a-home-cost-right-now"')
    expect(view.sections[0].id).toBe('what-does-a-home-cost-right-now')
  })

  it('keeps a heading\'s own id so a renamed section holds its old anchor', () => {
    const renamed = buildBlogArticleView(
      '<h2 id="sroa-fees-and-costs">Sunriver HOA fees (SROA) in 2026</h2><p>The fee is $172.94 a month.</p>',
    )
    expect(renamed.sections[0].id).toBe('sroa-fees-and-costs')
    expect(renamed.html).toContain('id="sroa-fees-and-costs"')
    expect(renamed.html).not.toContain('id="sunriver-hoa-fees-sroa-in-2026"')
  })

  it('keeps the lede that sits before the first heading', () => {
    expect(view.html).toContain('The lede paragraph')
  })

  it('quotes each figure verbatim, under its own question, with its own sentence', () => {
    const price = view.figures.find((f) => f.value === '$1,349,000')
    expect(price).toBeDefined()
    expect(price?.question).toBe('What does a home cost right now?')
    expect(price?.sentence).toBe(
      'Over the last 12 months, the median sale price was $1,349,000, from 11 closings.',
    )
    expect(price?.sectionId).toBe('what-does-a-home-cost-right-now')
  })

  it('drops the trailing punctuation of the sentence from the figure', () => {
    expect(view.figures.map((f) => f.value)).not.toContain('$1,349,000,')
  })

  it('prefers the price over the sample size standing beside it', () => {
    const section = view.figures.filter((f) => f.question === 'What does a home cost right now?')
    expect(section).toHaveLength(1)
    expect(section[0].value).toBe('$1,349,000')
  })

  it('takes a pace figure but never a measurement window', () => {
    expect(view.figures.map((f) => f.value)).toContain('29.5 days')
    expect(view.figures.map((f) => f.value)).not.toContain('12 months')
  })

  it('never promotes the far end of a range', () => {
    expect(view.figures.map((f) => f.value)).not.toContain('48 years')
  })

  it('attributes a link only when it stands in the figure’s own sentence', () => {
    const dues = view.figures.find((f) => f.value === '$87 a month')
    expect(dues).toBeDefined()
    // The citation is in the NEXT sentence of the same paragraph, so it is not
    // presented as the source of the dues figure.
    expect(dues?.sourceHost).toBeUndefined()
  })

  it('turns the Questions block into disclosures, first one open, text intact', () => {
    expect(view.html).toContain('<details class="v3-blog-q" open>')
    expect(view.html).toContain('Is this the same place?')
    expect(view.html).toContain('Yes, it is the same place under two names.')
    expect((view.html.match(/<details class="v3-blog-q"/g) ?? []).length).toBe(2)
  })

  it('does not turn a figure question into a disclosure', () => {
    expect(view.html).toContain('<h2 id="how-fast-do-homes-sell">How fast do homes sell?</h2>')
  })

  it('marks an outbound citation with its host and leaves an internal link alone', () => {
    expect(view.html).toContain('<span class="v3-blog-cite" aria-hidden="true">example.org</span>')
    expect(view.html).not.toContain('>ryan-realty.com<')
    const internal = view.html.slice(view.html.indexOf('/communities/awbrey-glen'))
    expect(internal).not.toContain('v3-blog-cite')
  })

  it('renders nothing rather than guessing when the body is empty', () => {
    expect(buildBlogArticleView('')).toEqual({ html: '', sections: [], figures: [] })
  })

  it('carries a qualifier onto the figure so the claim does not change', () => {
    const view2 = buildBlogArticleView(
      '<h2>What has the club given?</h2><p>The club has distributed more than $1 million to families in need.</p>',
    )
    expect(view2.figures[0].value).toBe('more than $1 million')
  })

  it('caps the rail at six figures', () => {
    const many = Array.from(
      { length: 12 },
      (_, i) => `<h2>Question ${i}?</h2><p>The figure in this answer is $${i + 1},000 flat.</p>`,
    ).join('')
    expect(buildBlogArticleView(many).figures).toHaveLength(6)
  })
})

describe('figureKey', () => {
  it('collapses two spellings of one reading', () => {
    expect(figureKey('239 units')).toBe(figureKey('239 condominiums'))
    expect(figureKey('$620 a month')).toBe(figureKey('$620'))
  })

  it('keeps a count and a duration apart when they share a number', () => {
    expect(figureKey('5 homes')).not.toBe(figureKey('5 days'))
  })
})

describe('sentenceAt', () => {
  it('returns the sentence holding the index, not the whole paragraph', () => {
    const text = 'First one here. Second has $500 in it. Third is last.'
    expect(sentenceAt(text, text.indexOf('$500'))).toBe('Second has $500 in it.')
  })
})

describe('slugifyHeading', () => {
  it('makes a url-safe id out of a question', () => {
    expect(slugifyHeading("What's for sale in Awbrey Glen right now?")).toBe(
      'what-s-for-sale-in-awbrey-glen-right-now',
    )
  })
})

// SEO & AEO Desk brief 2026-10-08 §6: the Bend monthly reports' rail showed
// "4 months" (the threshold) under "If you are buying" while the sentence said
// 3.5 (September) and 3.9 (August). Paragraphs verbatim from the live reports.
describe('months-of-supply chip reads the figure, never the threshold', () => {
  const report = (mos: string) => `
<h2>If you are buying</h2>
<p>Months of supply sits at ${mos}, which is a seller's market by the standard measure: 4 months or less favors sellers, above 4 and under 6 is balanced, 6 or more favors buyers.</p>
`
  it('September reads 3.5 months', () => {
    const chips = buildBlogArticleView(report('3.5')).figures.map((f) => f.value)
    expect(chips).toEqual(['3.5 months'])
  })
  it('August reads 3.9 months', () => {
    const chips = buildBlogArticleView(report('3.9')).figures.map((f) => f.value)
    expect(chips).toEqual(['3.9 months'])
  })
  it('a threshold alone never becomes a chip', () => {
    const chips = buildBlogArticleView(
      `<h2>What the measure means</h2><p>By the standard measure, 4 months or less favors sellers and 6 months or more favors buyers.</p>`,
    ).figures.map((f) => f.value)
    expect(chips).toEqual([])
  })
  it('a stated duration still reads', () => {
    const chips = buildBlogArticleView(
      `<h2>How fast?</h2><p>Bend homes went under contract in a median 31 days this quarter.</p>`,
    ).figures.map((f) => f.value)
    expect(chips).toEqual(['31 days'])
  })
})
