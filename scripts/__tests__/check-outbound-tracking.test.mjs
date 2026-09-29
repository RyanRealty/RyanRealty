import { describe, expect, it } from 'vitest'
import {
  classifyHref,
  enclosingFunctionName,
  evaluateHtml,
  extractHrefs,
  findSendCalls,
  hasOpenPixel,
  judgeReasons,
} from '../check-outbound-tracking.mjs'

const ORIGIN = 'https://ryan-realty.com'
const PAMPHLET = `${ORIGIN}/docs/oregon-initial-agency-disclosure-pamphlet.pdf`
const ctx = { siteOrigin: ORIGIN, pamphletUrls: [PAMPHLET] }

describe('classifyHref', () => {
  it('counts a click tracker on the site origin, with a token, as tracked', () => {
    expect(classifyHref(`${ORIGIN}/api/track/e/click?t=abc`, ctx)).toBe('tracked')
    expect(classifyHref('/api/track/e/click?t=abc', ctx)).toBe('tracked')
  })

  it('rejects a tracker with no token, or on another origin', () => {
    expect(classifyHref(`${ORIGIN}/api/track/e/click`, ctx)).toBe('untracked')
    expect(classifyHref('https://evil.test/api/track/e/click?t=abc', ctx)).toBe('untracked')
  })

  it('allows tel, mailto, and the agency pamphlet only', () => {
    expect(classifyHref('tel:+15417033095', ctx)).toBe('tel')
    expect(classifyHref('mailto:matt@ryan-realty.com', ctx)).toBe('mailto')
    expect(classifyHref(PAMPHLET, ctx)).toBe('pamphlet')
    expect(classifyHref(`${PAMPHLET}?utm_source=email`, ctx)).toBe('pamphlet')
    expect(classifyHref(`${ORIGIN}/search`, ctx)).toBe('untracked')
  })

  it('decodes entities before classifying so an encoded tracker still counts', () => {
    expect(classifyHref(`${ORIGIN}/api/track/e/click?t=abc&amp;x=1`, ctx)).toBe('tracked')
  })

  it('does not treat an unsubscribe href as an exception', () => {
    expect(classifyHref(`${ORIGIN}/api/email/unsubscribe?t=abc`, ctx)).toBe('untracked')
    expect(classifyHref(`${ORIGIN}/newsletter/unsubscribe?token=x`, ctx)).toBe('untracked')
  })
})

describe('pixel and href extraction', () => {
  it('reads anchor hrefs and ignores image src that is not a click', () => {
    const html = '<a href="https://ryan-realty.com/search">Search</a><img src="https://ryan-realty.com/images/brokers/ryan-matt.jpg" />'
    expect(extractHrefs(html)).toEqual(['https://ryan-realty.com/search'])
  })

  it('detects the open pixel only on the site origin with a token', () => {
    expect(hasOpenPixel(`<img src="${ORIGIN}/api/track/e/open?t=abc" />`, ORIGIN)).toBe(true)
    expect(hasOpenPixel(`<img src="${ORIGIN}/api/track/e/open?t=abc&amp;x=1" />`, ORIGIN)).toBe(true)
    expect(hasOpenPixel(`<img src="${ORIGIN}/api/track/e/open" />`, ORIGIN)).toBe(false)
    expect(hasOpenPixel(`<img src="https://evil.test/api/track/e/open?t=abc" />`, ORIGIN)).toBe(false)
    expect(hasOpenPixel('<img src="https://ryan-realty.com/hero.jpg" />', ORIGIN)).toBe(false)
  })

  it('reports each distinct decoded raw href once, plus a missing pixel', () => {
    const html = [
      '<a href="tel:+15417033095">call</a>',
      `<a href="${PAMPHLET}">pamphlet</a>`,
      '<a href="https://ryan-realty.com/search?a=1&amp;b=2">one</a>',
      '<a href="https://ryan-realty.com/search?a=1&b=2">two</a>',
      `<a href="${ORIGIN}/api/track/e/click?t=abc">tracked</a>`,
    ].join('')
    expect(evaluateHtml(html, ctx)).toEqual([
      'open pixel missing: no img src at /api/track/e/open with a t token',
      'untracked href: https://ryan-realty.com/search?a=1&b=2',
    ])
  })

  it('passes a document whose only raw links are tel, mailto, and the pamphlet', () => {
    const html = [
      `<a href="${ORIGIN}/api/track/e/click?t=abc">Search</a>`,
      '<a href="mailto:matt@ryan-realty.com">email</a>',
      `<a href="${PAMPHLET}">pamphlet</a>`,
      `<img src="${ORIGIN}/api/track/e/open?t=pix" width="1" height="1" />`,
    ].join('')
    expect(evaluateHtml(html, ctx)).toEqual([])
  })
})

describe('judgeReasons ratchet', () => {
  it('passes a clean template that is not baselined', () => {
    expect(judgeReasons([], null)).toEqual({ status: 'pass', problems: [] })
  })

  it('fails a new reason when the template is not baselined', () => {
    const judged = judgeReasons(['untracked href: https://ryan-realty.com/search'], null)
    expect(judged.status).toBe('novel')
    expect(judged.problems).toEqual(['new failure: untracked href: https://ryan-realty.com/search'])
  })

  it('accepts a baseline whose reason set matches exactly', () => {
    expect(judgeReasons(['b', 'a'], ['a', 'b'])).toEqual({ status: 'baselined', problems: [] })
  })

  it('fails when a baselined template grows a new reason', () => {
    const judged = judgeReasons(['a', 'b'], ['a'])
    expect(judged.status).toBe('extra')
    expect(judged.problems).toContain('new failure: b')
  })

  it('fails when a baselined reason no longer reproduces, so the file must shrink', () => {
    const partial = judgeReasons(['a'], ['a', 'b'])
    expect(partial.status).toBe('stale')
    expect(partial.problems).toEqual(['baseline reason cleared and must be removed: b'])
    const cleared = judgeReasons([], ['a'])
    expect(cleared.status).toBe('stale')
    expect(cleared.problems).toEqual(['baseline entry now passes and must be removed'])
  })
})

describe('sender enclosing function', () => {
  it('names the function around a try, not the try itself', () => {
    const src = [
      'async function sendOne() {',
      '  try {',
      '    await sendEmail({ to: "a@example.com" })',
      '  } catch (e) {',
      '    return null',
      '  }',
      '}',
    ].join('\n')
    const calls = findSendCalls(src)
    expect(calls).toHaveLength(1)
    expect(calls[0].enclosing).toBe('sendOne')
    expect(enclosingFunctionName(src, src.indexOf('sendEmail'))).toBe('sendOne')
  })

  it('skips the sendEmail definition and still records .emails.send inside it', () => {
    const src = [
      'export async function sendEmail(options) {',
      '  return client.emails.send(options)',
      '}',
      'async function notify() {',
      '  await sendEmail({ to: "a@example.com" })',
      '}',
    ].join('\n')
    const calls = findSendCalls(src)
    expect(calls.map((c) => `${c.enclosing}:${c.fn}`)).toEqual([
      'notify:sendEmail',
      'sendEmail:.emails.send',
    ])
  })
})
