import { describe, expect, it } from 'vitest'
import { extractAnswerFirst } from './answer-first'

describe('extractAnswerFirst', () => {
  it('leaves a body without an answer block untouched', () => {
    const html = '<p>Intro.</p><h2>One</h2><p>Body.</p>'
    expect(extractAnswerFirst(html)).toEqual({ answerHtml: null, figuresAsOf: null, body: html })
  })

  it('lifts a leading answer block and reads its as-of day', () => {
    const html =
      '\n<div class="v3-blog-answer" data-figures-as-of="2026-10-08">\n<p>Answer.</p>\n<p class="v3-blog-answer-source">Source.</p>\n</div>\n<p>Intro.</p>'
    const out = extractAnswerFirst(html)
    expect(out.answerHtml).toBe('<p>Answer.</p>\n<p class="v3-blog-answer-source">Source.</p>')
    expect(out.figuresAsOf).toBe('2026-10-08')
    expect(out.body).toBe('<p>Intro.</p>')
  })

  it('does not lift an answer block that is not first in the body', () => {
    const html = '<p>Intro.</p><div class="v3-blog-answer"><p>Answer.</p></div>'
    expect(extractAnswerFirst(html).answerHtml).toBeNull()
  })

  it('treats a missing or malformed as-of day as absent', () => {
    expect(extractAnswerFirst('<div class="v3-blog-answer"><p>A.</p></div>').figuresAsOf).toBeNull()
    expect(
      extractAnswerFirst('<div class="v3-blog-answer" data-figures-as-of="Oct 8"><p>A.</p></div>').figuresAsOf,
    ).toBeNull()
  })
})
