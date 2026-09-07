import { describe, expect, it } from 'vitest'
import { extractBlogFaq, publishBlogFaq } from './publish-blog-faq'

const BODY = `
<p>Intro.</p>
<h2>How to use this guide</h2>
<p>Words.</p>
<h2>Questions</h2>
<h3>What is the best neighborhood in Bend?</h3>
<p>There is no single best neighborhood. It depends on <a href="/neighborhoods">the district</a> &amp; the budget.</p>
<h3>Which areas are walkable?</h3>
<p>River West and Old Bend.</p>
<h2>Next step</h2>
<h3>Not a question</h3>
<p>Not an answer.</p>
`

describe('extractBlogFaq', () => {
  it('reads h3/p pairs under the Questions heading only', () => {
    const items = extractBlogFaq(BODY)
    expect(items).toEqual([
      {
        question: 'What is the best neighborhood in Bend?',
        answer: 'There is no single best neighborhood. It depends on the district & the budget.',
      },
      { question: 'Which areas are walkable?', answer: 'River West and Old Bend.' },
    ])
  })

  it('returns nothing when the post has no Questions section', () => {
    expect(extractBlogFaq('<p>Body</p><h2>Other</h2><h3>Q</h3><p>A</p>')).toEqual([])
    expect(extractBlogFaq(null)).toEqual([])
    expect(extractBlogFaq('')).toEqual([])
  })

  it('reads to the end of the body when Questions is the last section', () => {
    const items = extractBlogFaq('<h2>Questions</h2><h3>One?</h3><p>Yes.</p><h3>Two?</h3><p>No.</p>')
    expect(items.map((i) => i.question)).toEqual(['One?', 'Two?'])
  })

  it('skips a pair with an empty answer', () => {
    expect(extractBlogFaq('<h2>Questions</h2><h3>One?</h3><p></p><h3>Two?</h3><p>Yes.</p>')).toEqual([
      { question: 'Two?', answer: 'Yes.' },
    ])
  })
})

describe('publishBlogFaq', () => {
  it('shapes the MetadataBlock faqPage input', () => {
    expect(publishBlogFaq(BODY)).toEqual({
      type: 'faqPage',
      items: [
        {
          question: 'What is the best neighborhood in Bend?',
          answer: 'There is no single best neighborhood. It depends on the district & the budget.',
        },
        { question: 'Which areas are walkable?', answer: 'River West and Old Bend.' },
      ],
    })
  })

  it('is null without a Questions section so no empty FAQPage ships', () => {
    expect(publishBlogFaq('<p>Body</p>')).toBeNull()
  })
})
