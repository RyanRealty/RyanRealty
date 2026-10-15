import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAutomatedBrowser } from './use-shot-triggers'

const DIR = join(process.cwd(), 'app/contact/_v3')

describe('contact shot triggers stay out of reach for people (UX review F01)', () => {
  it('only an automated browser gets the triggers', () => {
    expect(isAutomatedBrowser({ webdriver: true })).toBe(true)
    expect(isAutomatedBrowser({ webdriver: false })).toBe(false)
    expect(isAutomatedBrowser({})).toBe(false)
    expect(isAutomatedBrowser(undefined)).toBe(false)
  })

  it('every contact trigger is gated, hidden from assistive tech, and out of the tab order', () => {
    for (const file of ['ContactAsk.client.tsx', 'ContactHoursLive.client.tsx']) {
      const src = readFileSync(join(DIR, file), 'utf8')
      expect(src).toContain('useShotTriggers()')
      expect(src).toContain('{shotTriggers ? (')
      expect(src).toContain('aria-hidden="true"')
      const triggers = src.match(/data-taste="[a-z-]+"/g) ?? []
      const unfocusable = src.match(/tabIndex=\{-1\}\s+data-taste=/g) ?? []
      expect(triggers.length).toBeGreaterThan(0)
      expect(unfocusable.length).toBe(triggers.length)
    }
  })
})
