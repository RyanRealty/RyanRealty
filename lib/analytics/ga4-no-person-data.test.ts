/**
 * No personal information reaches GA4 (Matt 2026-10-14). Google's GA4 terms
 * forbid it, and a mailing address is personal information.
 *
 * Found live 2026-10-14: the homepage "value your home" box lands on
 * `/sell?address=<what the person typed>` and GA4 received that as dl= on the
 * page_view and on every event after it; a CMA's address slug reached GA4 as
 * page_location, page_path and page_title through the server mirror; and
 * valuation_requested sent `cma_slug`.
 *
 * The rule has ONE implementation, stripGa4UrlParams
 * (app/api/visitors/track/strip-identity.ts), and this file fails when a GA4
 * sender writes a page_location or page_referrer that did not come from it:
 *
 *   - browser: the inline bootstrap's page_view and `gtag('set')`
 *     (gtm-bootstrap.ts), PageViewTracker, setGa4PageLocation;
 *   - server: ga4ServerContext, the page-view mirror, and fireGa4Event, which
 *     runs ga4SafeEventParams on every Measurement Protocol event whatever the
 *     sender passes (ga4-measurement-protocol.test.ts holds that behavior).
 *
 * A new writer passes by calling stripGa4UrlParams (or reading a value that
 * did, in the same file). Writing a raw URL fails here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SCAN = ['app', 'lib', 'components']
const SKIP_DIR = new Set(['node_modules', '.next', '__tests__', 'fixtures'])
/** The implementation itself, which defines the rule rather than using it. */
const IMPLEMENTATION = 'app/api/visitors/track/strip-identity.ts'

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.|\.d\.ts$/.test(name)) out.push(full)
  }
  return out
}

/** A value expression counts as safe when it calls the strip or is the bootstrap's JS twin. */
const SAFE_SOURCE = /stripGa4UrlParams\(|GA4_SAFE_URL_FN_JS|ga4SafeUrlFnJs\(|ga4SafeUrlJs\(/

/** Names the file assigns from a safe source, plus names assigned from those (one hop). */
function safeNames(src: string): Set<string> {
  const names = new Set<string>()
  // lookahead, so `o={...},r=...` yields both o and r
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*[:=](?!=)(?=([^\n;]*))/g)) {
    if (SAFE_SOURCE.test(m[2]!)) names.add(m[1]!)
  }
  // one hop: `M = N` or `M = N(...)` where N is safe (the bootstrap's `pl=ga(location.href)`)
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*(?:\(|[;\n,)}]|$)/g)) {
    if (names.has(m[2]!)) names.add(m[1]!)
  }
  return names
}

type Write = { file: string; line: number; key: string; value: string }

/** Every `page_location: X` / `page_referrer: X` key and `.page_location = X` assignment. */
function writes(file: string, src: string): Write[] {
  const out: Write[] = []
  src.split('\n').forEach((text, i) => {
    const t = text.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    for (const m of text.matchAll(/\b(page_location|page_referrer)\s*(?::|(?<![=!<>])=(?!=))\s*([^,\n};]+)/g)) {
      const value = m[2]!.trim()
      // a type annotation, not a value
      if (/^(string|number|unknown|undefined|null)\b/.test(value)) continue
      out.push({ file, line: i + 1, key: m[1]!, value })
    }
  })
  return out
}

function isSafe(w: Write, names: Set<string>): boolean {
  if (SAFE_SOURCE.test(w.value)) return true
  const ident = /^([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\)?;?$/.exec(w.value)
  if (!ident) return false
  const last = ident[1]!.split(/\??\./).pop()!
  return names.has(last)
}

describe('every GA4 page_location and page_referrer comes from stripGa4UrlParams', () => {
  const files = SCAN.flatMap((d) => sourceFiles(join(ROOT, d)))
  const all: Array<Write & { safe: boolean }> = []
  for (const full of files) {
    const file = relative(ROOT, full)
    if (file === IMPLEMENTATION) continue
    const src = readFileSync(full, 'utf8')
    if (!/page_(location|referrer)/.test(src)) continue
    const names = safeNames(src)
    for (const w of writes(file, src)) all.push({ ...w, safe: isSafe(w, names) })
  }

  it('finds the known senders (the scan is not silently empty)', () => {
    const seen = new Set(all.map((w) => w.file))
    for (const f of [
      'app/api/visitors/track/route.ts',
      'components/PageViewTracker.tsx',
      'lib/analytics/ga4-server-context.ts',
      'lib/analytics/ga4-browser-events.ts',
      'lib/analytics/gtm-bootstrap.ts',
    ]) {
      expect(seen, f).toContain(f)
    }
  })

  it('no writer hands GA4 a raw URL', () => {
    const raw = all.filter((w) => !w.safe).map((w) => `${w.file}:${w.line} ${w.key} = ${w.value}`)
    expect(raw).toEqual([])
  })

  it('every client-side navigation re-sets the safe address for all hits', () => {
    expect(readFileSync(join(ROOT, 'components/PageViewTracker.tsx'), 'utf8')).toMatch(/setGa4PageLocation\(/)
  })

  it('every Measurement Protocol event and the event sent before it go through ga4SafeEventParams', () => {
    const mp = readFileSync(join(ROOT, 'lib/ga4-measurement-protocol.ts'), 'utf8')
    expect(mp.match(/ga4SafeEventParams\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(mp).toMatch(/ga4SafeUserProperties\(/)
  })
})
