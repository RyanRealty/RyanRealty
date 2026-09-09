import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, type Page } from '@playwright/test'

/**
 * The tap-target gate's disclosure rule (SITE-07, 2026-09-09), exercised in a
 * real Chromium.
 *
 * `collectControls` in scripts/check-tap-targets.mjs runs INSIDE the page
 * (the gate serialises it with `toString()`), so it is tested the same way:
 * its source is lifted out of the gate file and evaluated over three
 * fixtures. The rule it holds: a control behind a CLOSED disclosure is
 * recorded only when the disclosure's trigger is full size AND the control
 * itself, briefly revealed, measures full size — and it is recorded at its
 * OWN box. The first version recorded such a control at the trigger's box
 * without measuring it, which let every link in the closed phone drawer
 * excuse any small visible control that shared its href.
 *
 * This lives in the e2e lane because it needs a layout engine; the unit lane
 * runs on a runner with no browser (scripts/__tests__/check-tap-targets.test.mjs
 * holds the rule's shape in the source text there). It never navigates, so it
 * needs no server.
 */

// Resolved from the repo root, where playwright.config.ts lives: the spec is
// transpiled to CommonJS, where `import.meta.url` is unavailable.
const GATE = readFileSync(resolve(process.cwd(), 'scripts/check-tap-targets.mjs'), 'utf8')

/** The in-page function, lifted verbatim: from its declaration to the first `}` at column 0. */
function collectControlsSource(): string {
  const start = GATE.indexOf('function collectControls(')
  if (start < 0) throw new Error('collectControls not found in the gate')
  const end = GATE.indexOf('\n}\n', start)
  return GATE.slice(start, end + 2)
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

type Control = { skip?: string; name?: string; href?: string; w: number; h: number; via?: string }

async function collect(page: Page): Promise<Control[]> {
  await page.setContent(FIXTURE)
  return page.evaluate(`(${collectControlsSource()})('a[href], button', [], 44)`) as Promise<Control[]>
}

/* The gate signs a control by class, ancestor class, accessible name or href
   (never by id), so the fixtures are read back by the name or href they carry. */
const byName = (found: Control[], name: string) => found.filter((c) => !c.skip && c.name === name)
const byHref = (found: Control[], href: string) => found.filter((c) => !c.skip && c.href === href)

test.describe('check-tap-targets: a control behind a closed disclosure', () => {
  test("is recorded at its OWN box, not the trigger's, when both are full size", async ({ page }) => {
    const found = await collect(page)
    const rec = byName(found, 'hidden a')
    expect(rec).toHaveLength(1)
    expect(rec[0].via).toBe('disclosure')
    // 120 wide proves the control was measured; the trigger is 60.
    expect(rec[0].w).toBeGreaterThanOrEqual(110)
    expect(rec[0].h).toBeGreaterThanOrEqual(44)
  })

  test('earns nothing behind a trigger under the floor', async ({ page }) => {
    const found = await collect(page)
    expect(byName(found, 'hidden b')).toHaveLength(0)
  })

  test('earns nothing when it is itself under the floor, so it can never excuse a small visible twin', async ({ page }) => {
    const found = await collect(page)
    // Only the visible link is recorded for /x, and it is small; the hidden one,
    // 20px once revealed, produced no record — so nothing full size shares the
    // href and equivalentPartner would find no partner.
    const links = byHref(found, '/x')
    expect(links).toHaveLength(1)
    expect(links[0].via).toBeUndefined()
    expect(links[0].w).toBeLessThan(44)
    expect(found.filter((c) => !c.skip && c.href === '/x' && c.w >= 44 && c.h >= 44)).toHaveLength(0)
  })

  test('leaves the page as it found it', async ({ page }) => {
    await collect(page)
    const state = await page.evaluate(() => ({
      raDisplay: getComputedStyle(document.getElementById('ra')!).display,
      rcHidden: document.getElementById('rc')!.hasAttribute('hidden'),
      rcInline: document.getElementById('rc')!.getAttribute('style') ?? '',
    }))
    expect(state.raDisplay).toBe('none')
    expect(state.rcHidden).toBe(true)
    // removeProperty leaves an empty style attribute behind; either is untouched.
    expect(state.rcInline).toBe('')
  })

  test('still records the triggers themselves as ordinary controls', async ({ page }) => {
    const found = await collect(page)
    expect(byName(found, 'more a')).toHaveLength(1)
    expect(byName(found, 'b')).toHaveLength(1)
    expect(byName(found, 'b')[0].w).toBeLessThan(44)
  })
})
