import { describe, expect, it } from 'vitest'
import { checkInlineScripts, extractInlineScripts, formatInlineScriptReport, parseAttributes } from './inline-script-check.mjs'
import { gtmBootstrapScript } from './gtm-bootstrap'

/**
 * P15 / TRACK-2 (visibility audit 2026-09-22): the live homepage shipped a GTM
 * bootstrap that did not parse, so gtm.js never loaded, and every gate passed
 * because gates regex source text. These tests hold the shared parser that the
 * daily crawl probe runs (and deploy:verify is built to import) against the
 * SERVED page.
 */
const page = (...scripts: string[]) => `<!doctype html><html><head>${scripts.join('')}</head><body></body></html>`
const GOOD_GTM = `<script>${gtmBootstrapScript('home', 'GTM-TEST123')}</script>`
// The exact defect class from 2026-09-17: a stray `}}` inside the push.
const BROKEN_GTM = `<script>window.dataLayer=window.dataLayer||[];(function(w,d,s,l,i){w[l].push({'gtm.start':}});var j=d.createElement(s);j.src='https://www.googletagmanager.com/gtm.js?id='+i;})(window,document,'script','dataLayer','GTM-TEST123');</script>`
// Next streams an escaped copy of every rendered string in its flight payload.
const FLIGHT_WITH_GTM_TEXT = `<script>self.__next_f.push([1,"window.dataLayer=[];'https://www.googletagmanager.com/gtm.js?id=GTM-TEST123'"])</script>`

describe('parseAttributes', () => {
  it('reads quoted, unquoted and valueless attributes, lower-casing names', () => {
    expect(parseAttributes(` TYPE="application/ld+json" id='x' async data-n=3`)).toEqual({
      type: 'application/ld+json',
      id: 'x',
      async: '',
      'data-n': '3',
    })
  })
})

describe('extractInlineScripts', () => {
  it('skips src scripts and classifies by type', () => {
    const scripts = extractInlineScripts(
      page(
        '<script src="/a.js"></script>',
        '<script>var a=1</script>',
        '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
        '<script type="module">import x from "y"</script>',
        '<script type="text/template"><div></div></script>',
      ),
    )
    expect(scripts.map((s) => [s.index, s.kind])).toEqual([
      [2, 'js'],
      [3, 'json'],
      [4, 'module'],
      [5, 'other'],
    ])
  })
})

describe('checkInlineScripts', () => {
  it('passes a page whose inline scripts all parse and whose GTM loader carries the container', () => {
    const r = checkInlineScripts(
      page(GOOD_GTM, FLIGHT_WITH_GTM_TEXT, '<script type="application/ld+json">{"a":1}</script>'),
      { gtmContainerId: 'GTM-TEST123' },
    )
    expect(r.failures).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.gtm).toEqual({ loaderFound: true, loaderParses: true, containerIds: ['GTM-TEST123'], expectedId: 'GTM-TEST123' })
    expect(r.js).toBe(2)
    expect(r.json).toBe(1)
  })

  it('fails the 2026-09-17 defect: the loader is present but does not parse', () => {
    const r = checkInlineScripts(page(BROKEN_GTM), { gtmContainerId: 'GTM-TEST123' })
    expect(r.ok).toBe(false)
    expect(r.parseErrors).toHaveLength(1)
    expect(r.failures.some((f) => f.startsWith('inline script #1 does not parse'))).toBe(true)
    expect(r.failures).toContain('GTM loader does not parse, so gtm.js never loads')
  })

  it('does not count the flight payload copy as the loader', () => {
    const r = checkInlineScripts(page(FLIGHT_WITH_GTM_TEXT))
    expect(r.gtm.loaderFound).toBe(false)
    expect(r.failures).toEqual(['GTM loader missing: no inline script loads gtm.js'])
  })

  it('fails when the loader carries a different container than expected', () => {
    const r = checkInlineScripts(page(GOOD_GTM), { gtmContainerId: 'GTM-OTHER99' })
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toMatch(/does not carry container GTM-OTHER99 \(found GTM-TEST123\)/)
  })

  it('fails on a JSON-LD block that does not parse', () => {
    const r = checkInlineScripts(page(GOOD_GTM, '<script type="application/ld+json">{"@context":"https://schema.org",}</script>'))
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toMatch(/^inline JSON #2 does not parse/)
  })

  it('never executes the script it parses', () => {
    const g = globalThis as { __inlineCheckRan?: boolean }
    delete g.__inlineCheckRan
    checkInlineScripts(page('<script>globalThis.__inlineCheckRan = true</script>'), { requireGtm: false })
    expect(g.__inlineCheckRan).toBeUndefined()
  })

  it('counts module and unknown-type scripts as skipped, not failed', () => {
    const r = checkInlineScripts(page(GOOD_GTM, '<script type="module">import x from "y"; export default x</script>'))
    expect(r.ok).toBe(true)
    expect(r.skipped).toBe(1)
  })
})

describe('formatInlineScriptReport', () => {
  it('prints one tally line for a healthy page and passes it', () => {
    const r = formatInlineScriptReport(checkInlineScripts(page(GOOD_GTM, '<script type="application/ld+json">{"a":1}</script>')))
    expect(r.ok).toBe(true)
    expect(r.lines).toEqual([
      '1 inline script(s) and 1 JSON block(s) parsed of 2 inline; 0 parse error(s); 0 skipped; GTM loader present (GTM-TEST123)',
    ])
  })

  it('fails the 2026-09-17 page and names every failure on its own line', () => {
    const r = formatInlineScriptReport(checkInlineScripts(page(BROKEN_GTM)))
    expect(r.ok).toBe(false)
    expect(r.lines[0]).toMatch(/1 parse error\(s\); 0 skipped; GTM loader DOES NOT PARSE$/)
    expect(r.lines.slice(1)).toEqual([
      expect.stringMatching(/^  inline script #1 does not parse: /),
      '  GTM loader does not parse, so gtm.js never loads',
    ])
  })

  it('says MISSING when no inline script loads gtm.js', () => {
    const r = formatInlineScriptReport(checkInlineScripts(page(FLIGHT_WITH_GTM_TEXT)))
    expect(r.ok).toBe(false)
    expect(r.lines[0]).toMatch(/GTM loader MISSING$/)
  })
})
