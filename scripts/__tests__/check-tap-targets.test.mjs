/**
 * The tap-target gate's disclosure rule (SITE-07, 2026-09-09) — the SHAPE.
 *
 * `collectControls` runs inside a browser page (the gate serialises it with
 * `toString()`), so its behaviour is exercised in a real Chromium by
 * e2e/gate-tap-targets.spec.ts, in the lane that installs browsers. The unit
 * lane has none — the first version of this file launched Chromium from
 * vitest and failed CI on a runner with no browser — so what this file holds
 * is the rule's structure in the source text, the way the other gate tests
 * read their gate: a control behind a closed disclosure is measured at its
 * OWN box, only through a full-size trigger, only when it is itself full
 * size, and the page is restored afterwards. The first version recorded such
 * a control at the trigger's box unmeasured, which let every link in the
 * closed phone drawer excuse a small visible control sharing its href.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const GATE = readFileSync(new URL('../check-tap-targets.mjs', import.meta.url), 'utf8')

/** The in-page function, from its declaration to the first `}` at column 0. */
function collectControlsSource() {
  const start = GATE.indexOf('function collectControls(')
  expect(start).toBeGreaterThan(-1)
  const end = GATE.indexOf('\n}\n', start)
  return GATE.slice(start, end + 2)
}

describe('check-tap-targets: the disclosure rule, in the source', () => {
  const src = collectControlsSource()

  it('finds the trigger only when it is presented and full size itself', () => {
    const owners = src.slice(src.indexOf('const disclosureOwners ='), src.indexOf('const disclosedBox ='))
    expect(owners).toMatch(/\[aria-expanded="false"\]\[aria-controls\]/)
    expect(owners).toMatch(/tr\.width === 0 \|\| tr\.height === 0\) continue/)
    expect(owners).toMatch(/box\.w >= minPx && box\.h >= minPx\) return owners/)
  })

  it('measures the hidden control at its own box with the disclosure briefly open, and restores the page', () => {
    const box = src.slice(src.indexOf('const disclosedBox ='), src.indexOf('const out = []'))
    expect(box).toMatch(/removeAttribute\('hidden'\)/)
    expect(box).toMatch(/setProperty\('display', 'revert', 'important'\)/)
    expect(box).toMatch(/el\.getBoundingClientRect\(\)/)
    expect(box).toMatch(/return hitBox\(el, r\)/)
    expect(box).toMatch(/finally \{/)
    expect(box).toMatch(/setAttribute\('hidden', ''\)/)
    expect(box).toMatch(/removeProperty\('display'\)/)
  })

  it('records a disclosed control only when IT measures full size, never at the trigger\'s size', () => {
    expect(src).toMatch(/const via = owners \? disclosedBox\(el, owners\) : null/)
    expect(src).toMatch(/if \(via && via\.w >= minPx && via\.h >= minPx\) \{/)
    expect(src).toMatch(/via: 'disclosure'/)
    // The first version's helper, which returned the trigger's box, is gone.
    expect(GATE).not.toMatch(/disclosureBox\b/)
    expect(GATE).not.toMatch(/recorded at the trigger's box and can stand/)
  })

  it('says what it now sees in the header', () => {
    expect(GATE).toMatch(/opened for one synchronous measurement/)
    expect(GATE).toMatch(/recorded at their OWN box/)
    expect(GATE).not.toMatch(/contents of a closed\n \*\s+disclosure or menu, dialogs/)
  })

  it('serialises minPx into the page so the rule and the floor cannot drift apart', () => {
    expect(GATE).toMatch(/function collectControls\(selector, thirdPartyRoots, minPx\)/)
    expect(GATE).toMatch(/\$\{JSON\.stringify\(THIRD_PARTY_ROOTS\)\}, \$\{MIN_PX\}\)/)
  })
})
