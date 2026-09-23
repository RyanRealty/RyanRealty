import { describe, expect, it } from 'vitest'
import { gtmBootstrapScript } from '../../lib/analytics/gtm-bootstrap'
import { checkInlineScripts, extractScripts, formatInlineScriptReport, GTM_LOADER_TEXT } from './inline-script-health.mjs'

// The exact break production served from 2026-09-17 (f1e2a90f9, TRACK-2).
const BROKEN_BOOTSTRAP = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':}}
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TEST');`

const FIXED_BOOTSTRAP = BROKEN_BOOTSTRAP.replace("{'gtm.start':}}", "{'gtm.start':")

const page = (...scripts) => `<!doctype html><html><head>${scripts.join('')}</head><body></body></html>`

describe('checkInlineScripts', () => {
  it('fails the page production served on 2026-09-18 (the GTM parse error)', () => {
    const r = checkInlineScripts(page(`<script>${BROKEN_BOOTSTRAP}</script>`))
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0].message).toMatch(/Unexpected token/)
    expect(formatInlineScriptReport(r).ok).toBe(false)
  })

  it('passes the repaired bootstrap', () => {
    const r = checkInlineScripts(page(`<script>${FIXED_BOOTSTRAP}</script>`))
    expect(r.failures).toEqual([])
    expect(r.hasGtmLoader).toBe(true)
    expect(formatInlineScriptReport(r).ok).toBe(true)
  })

  // The same string components/GTMHead.tsx ships (lib/analytics/gtm-bootstrap.ts),
  // so this deploy check and gtm-bootstrap.test.ts judge one artifact: parse it
  // without running it. vm.Script uses the classic-script grammar a browser
  // applies; gtm-bootstrap.test.ts uses new Function. Both must agree.
  it('passes the bootstrap the site actually ships, and agrees with new Function', () => {
    const shipped = gtmBootstrapScript('home', 'GTM-WV6R4NZ5')
    expect(() => new Function(shipped)).not.toThrow()
    const r = checkInlineScripts(page(`<script>${shipped}</script>`))
    expect(r.parsed).toBe(1)
    expect(r.failures).toEqual([])
    expect(formatInlineScriptReport(r).ok).toBe(true)
    // And the 2026-09-17 break, injected into the shipped string, fails both.
    const broken = shipped.replace("{'gtm.start':\n", "{'gtm.start':}}\n")
    expect(broken).not.toBe(shipped)
    expect(() => new Function(broken)).toThrow(SyntaxError)
    expect(checkInlineScripts(page(`<script>${broken}</script>`)).failures).toHaveLength(1)
  })

  it('fails a page with no GTM loader even when every script parses', () => {
    const r = checkInlineScripts(page('<script>self.__next_f=self.__next_f||[];</script>'))
    expect(r.failures).toEqual([])
    expect(r.hasGtmLoader).toBe(false)
    const f = formatInlineScriptReport(r)
    expect(f.ok).toBe(false)
    expect(f.lines.join('\n')).toContain(GTM_LOADER_TEXT)
  })

  it('does not parse JSON-LD, JSON, external or empty scripts as JavaScript', () => {
    const r = checkInlineScripts(
      page(
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"RealEstateAgent"}</script>',
        "<script type='application/json' id='d'>{\"a\":1}</script>",
        '<script src="/_next/static/chunks/main.js" async=""></script>',
        '<script>   </script>',
        `<script>${FIXED_BOOTSTRAP}</script>`,
      ),
    )
    expect(r.total).toBe(5)
    expect(r.parsed).toBe(1)
    expect(r.failures).toEqual([])
  })

  it('treats an explicit text/javascript type like no type', () => {
    const r = checkInlineScripts(page('<script type="text/javascript">var a = ;</script>'))
    expect(r.parsed).toBe(1)
    expect(r.failures).toHaveLength(1)
  })

  it('counts an inline module without trying to compile import syntax', () => {
    const r = checkInlineScripts(page('<script type="module">import x from "/a.js"; x()</script>'))
    expect(r.modules).toBe(1)
    expect(r.failures).toEqual([])
  })

  it('never executes what it parses', () => {
    globalThis.__inlineScriptRan = false
    checkInlineScripts(page('<script>globalThis.__inlineScriptRan = true</script>'))
    expect(globalThis.__inlineScriptRan).toBe(false)
  })
})

describe('extractScripts', () => {
  it('reads type and src across quoting styles, in document order', () => {
    const s = extractScripts(
      page('<script src=/a.js></script>', "<script type='application/ld+json'>{}</script>", '<SCRIPT>1</SCRIPT >'),
    )
    expect(s.map((x) => [x.index, x.type, x.src])).toEqual([
      [0, '', '/a.js'],
      [1, 'application/ld+json', null],
      [2, '', null],
    ])
  })
})
