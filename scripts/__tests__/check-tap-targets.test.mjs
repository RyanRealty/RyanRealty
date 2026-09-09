/**
 * The tap-target gate's disclosure rule (SITE-07, 2026-09-09).
 *
 * `collectControls` runs INSIDE the page (the gate serialises it with
 * `toString()`), so it is tested the same way: its source is lifted out of the
 * gate file and evaluated in a real Chromium over three fixtures. The rule it
 * holds: a control behind a CLOSED disclosure is recorded only when the
 * disclosure's trigger is full size AND the control itself, briefly revealed,
 * measures full size — and it is recorded at its OWN box. The first version
 * recorded such a control at the trigger's box without measuring it, which let
 * every link in the closed phone drawer excuse any small visible control that
 * shared its href.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

const GATE = readFileSync(new URL('../check-tap-targets.mjs', import.meta.url), 'utf8')

/** The in-page function, lifted verbatim: from its declaration to the first `}` at column 0. */
function collectControlsSource() {
  const start = GATE.indexOf('function collectControls(')
  if (start < 0) throw new Error('collectControls not found in the gate')
  const end = GATE.indexOf('\n}\n', start)
  return GATE.slice(start, end + 2)
}

/** The sandbox's Chromium when playwright's pinned build is not installed. */
function launchOptions() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  if (!existsSync(root)) return {}
  const dirs = readdirSync(root)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse()
  for (const d of dirs) {
    const exe = join(root, d, 'chrome-linux', 'chrome')
    if (existsSync(exe)) return { executablePath: exe }
  }
  return {}
}

const FIXTURE = `<!doctype html><html><head><style>
  body { margin: 0; padding: 8px; }
  button, a { display: inline-block; box-sizing: border-box; padding: 0; margin: 4px; border: 0; }
  .fold { display: none; }
</style></head><body>
  <!-- (a) a full-size trigger; the hidden control measures 120x44 when revealed -->
  <button id="ta" aria-expanded="false" aria-controls="ra" style="width:60px;height:48px">more a</button>
  <div id="ra" class="fold"><button id="ca" style="width:120px;height:44px">hidden a</button></div>

  <!-- (b) a trigger under the floor; the same hidden control earns nothing -->
  <button id="tb" aria-expanded="false" aria-controls="rb" style="width:30px;height:30px">b</button>
  <div id="rb" class="fold"><button id="cb" style="width:120px;height:44px">hidden b</button></div>

  <!-- (c) a full-size trigger over a SMALL hidden link, and a small visible link
       with the same href: the hidden one must not stand as its partner -->
  <button id="tc" aria-expanded="false" aria-controls="rc" style="width:60px;height:48px">menu c</button>
  <div id="rc" hidden><a id="cc" href="/x" style="width:20px;height:20px">x</a></div>
  <a id="vc" href="/x" style="width:20px;height:20px">x</a>
</body></html>`

let browser
let page
let found

beforeAll(async () => {
  browser = await chromium.launch(launchOptions())
  page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  await page.setContent(FIXTURE)
  found = await page.evaluate(`(${collectControlsSource()})('a[href], button', [], 44)`)
}, 60_000)

afterAll(async () => {
  await browser?.close()
})

/* The gate signs a control by class, ancestor class, accessible name or href
   (never by id), so the fixtures are read back by the name or href they carry. */
const byName = (name) => found.filter((c) => !c.skip && c.name === name)
const byHref = (href) => found.filter((c) => !c.skip && c.href === href)

describe('check-tap-targets: a control behind a closed disclosure', () => {
  it('is recorded at its OWN box, not the trigger\'s, when both are full size', () => {
    const rec = byName('hidden a')
    expect(rec).toHaveLength(1)
    expect(rec[0].via).toBe('disclosure')
    // 120 wide proves the control was measured; the trigger is 60.
    expect(rec[0].w).toBeGreaterThanOrEqual(110)
    expect(rec[0].h).toBeGreaterThanOrEqual(44)
  })

  it('earns nothing behind a trigger under the floor', () => {
    expect(byName('hidden b')).toHaveLength(0)
  })

  it('earns nothing when it is itself under the floor, so it can never excuse a small visible twin', () => {
    // Only the visible link is recorded for /x, and it is small; the hidden one,
    // 20px once revealed, produced no record — so nothing full size shares the
    // href and equivalentPartner would find no partner.
    const links = byHref('/x')
    expect(links).toHaveLength(1)
    expect(links[0].via).toBeUndefined()
    expect(links[0].w).toBeLessThan(44)
    expect(found.filter((c) => !c.skip && c.href === '/x' && c.w >= 44 && c.h >= 44)).toHaveLength(0)
  })

  it('leaves the page as it found it', async () => {
    const state = await page.evaluate(() => ({
      raDisplay: getComputedStyle(document.getElementById('ra')).display,
      rcHidden: document.getElementById('rc').hasAttribute('hidden'),
      rcInline: document.getElementById('rc').getAttribute('style'),
    }))
    expect(state.raDisplay).toBe('none')
    expect(state.rcHidden).toBe(true)
    // removeProperty leaves an empty style attribute behind; either is untouched.
    expect(state.rcInline ?? '').toBe('')
  })

  it('still records the triggers themselves as ordinary controls', () => {
    expect(byName('more a')).toHaveLength(1)
    expect(byName('b')).toHaveLength(1)
    expect(byName('b')[0].w).toBeLessThan(44)
  })
})
