import { describe, expect, it } from 'vitest'
import { extractAnswerFirst } from '@/app/blog/[slug]/_v3/answer-first'
import { extractBlogFaq } from './publish-blog-faq'
import { ensureChatgptLandingBody } from './chatgpt-landing-answers'

describe('ensureChatgptLandingBody', () => {
  it('leaves unrelated posts untouched', () => {
    const html = '<p>Intro.</p><h2>One</h2><p>Body.</p>'
    expect(ensureChatgptLandingBody('some-other-guide', html)).toBe(html)
  })

  it('prepends a Broken Top answer and appends Questions from facts already on the page', () => {
    const html = '<p>Broken Top opened in the early 1990s.</p><h2>The Golf Course</h2><p>Private club.</p>'
    const out = ensureChatgptLandingBody('broken-top-bend-golf-community', html)
    const answer = extractAnswerFirst(out)
    expect(answer.answerHtml).toMatch(/gated golf community on Bend's west side/)
    expect(answer.answerHtml).not.toMatch(/top team|premier/i)
    expect(answer.body).toContain('Broken Top opened in the early 1990s.')
    const faq = extractBlogFaq(out)
    expect(faq.map((i) => i.question)).toEqual([
      'Is Broken Top gated?',
      'Does buying a home in Broken Top include golf membership?',
      'What are Broken Top HOA fees?',
      'How far is Broken Top from downtown Bend?',
    ])
    expect(faq[1]?.answer).toMatch(/Membership is separate/)
    expect(out).not.toMatch(/\u2014|\u2013/)
  })

  it('does not duplicate an existing answer block or Questions section', () => {
    const html = `<div class="v3-blog-answer"><p>Already answered.</p></div>
<p>Body.</p>
<h2>Questions</h2>
<h3>One?</h3>
<p>Yes.</p>`
    const out = ensureChatgptLandingBody('hoa-guide-central-oregon', html)
    expect(extractAnswerFirst(out).answerHtml).toBe('<p>Already answered.</p>')
    expect(extractBlogFaq(out)).toEqual([{ question: 'One?', answer: 'Yes.' }])
  })

  it('lifts the July market report lead from the body and keeps an existing FAQ', () => {
    const html = `<p>Bend's July closings are in. Here are the numbers.</p>
<h2>The July numbers</h2>
<ul><li>Median sale price: <strong>$750,000</strong></li></ul>
<h2>The bottom line</h2>
<p>180 homes closed in Bend in July at a $750,000 median.</p>
<h2>Questions</h2>
<h3>What was the median home price in Bend in July 2026?</h3>
<p>$750,000 for a single-family home.</p>`
    const out = ensureChatgptLandingBody('bend-oregon-market-report-july-2026', html)
    const answer = extractAnswerFirst(out)
    expect(answer.answerHtml).toMatch(/July closings are in/)
    expect(answer.body).not.toMatch(/July closings are in/)
    expect(extractBlogFaq(out)).toHaveLength(1)
    expect(answer.body).toContain('<h2>The July numbers</h2>')
    expect(answer.body).toContain('180 homes closed')
  })

  it('adds HOA-guide Questions from the page and never names clients or a top team', () => {
    const html = '<p>In Central Oregon, HOAs range from basic subdivision associations.</p>'
    const out = ensureChatgptLandingBody('hoa-guide-central-oregon', html)
    expect(extractAnswerFirst(out).answerHtml).toMatch(/about \$50 a month/)
    const text = out.toLowerCase()
    expect(text).not.toMatch(/top team/)
    expect(text).not.toMatch(/\bclient\b/)
    expect(extractBlogFaq(out).length).toBeGreaterThanOrEqual(3)
  })
})
