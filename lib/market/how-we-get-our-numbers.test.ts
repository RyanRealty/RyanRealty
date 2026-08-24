import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HOW_NUMBER_ENTRIES,
  HOW_NUMBER_FAQS,
  HOW_WE_GET_OUR_NUMBERS_PATH,
  HUD_KPI_HOW,
  PANEL_HOW,
  assertHowNumberCopy,
  howNumberHref,
} from './how-we-get-our-numbers'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from './classify'

const EM_DASH = /\u2014/
const BANNED = /\b(luxury|premier|boutique|stunning|nestled|curated|bespoke|elevate|seamless|world-class)\b/i

describe('how-we-get-our-numbers copy', () => {
  it('does not leak internal stamps or table names', () => {
    expect(() => assertHowNumberCopy()).not.toThrow()
  })

  it('prints the canonical MOS clauses verbatim, never a competing formula', () => {
    const mos = HOW_NUMBER_ENTRIES.find((entry) => entry.id === 'months-of-supply')
    expect(mos?.body).toContain(MOS_METHODOLOGY_CLAUSE)
    expect(mos?.body).toContain(MOS_THRESHOLD_CLAUSE)
    const joined = HOW_NUMBER_ENTRIES.flatMap((entry) => entry.body).join(' ')
    expect(joined).not.toMatch(/closed last 30 days|times 2/i)
  })

  it('covers every HUD KPI label with a dictionary id', () => {
    const ids = new Set(HOW_NUMBER_ENTRIES.map((entry) => entry.id))
    for (const [label, id] of Object.entries(HUD_KPI_HOW)) {
      expect(ids.has(id), `${label} -> ${id}`).toBe(true)
    }
    for (const id of Object.values(PANEL_HOW)) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('keeps ids unique and voice-clean', () => {
    const ids = HOW_NUMBER_ENTRIES.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    const text = [
      ...HOW_NUMBER_ENTRIES.flatMap((entry) => [entry.term, ...entry.body]),
      ...HOW_NUMBER_FAQS.flatMap((faq) => [faq.question, faq.answer]),
    ].join('\n')
    expect(text).not.toMatch(EM_DASH)
    expect(text).not.toMatch(BANNED)
    expect(text).not.toMatch(/;/ )
  })

  it('builds hash hrefs on the dictionary path', () => {
    expect(howNumberHref('closed-30-days')).toBe(
      `${HOW_WE_GET_OUR_NUMBERS_PATH}#closed-30-days`,
    )
  })
})

describe('HUD and leftover panels jump to the dictionary', () => {
  it('KbMarketHud maps every printed KPI label through HUD_KPI_HOW', () => {
    const hud = readFileSync(resolve('components/site/kb/KbMarketHud.client.tsx'), 'utf8')
    expect(hud).toMatch(/HUD_KPI_HOW/)
    expect(hud).toMatch(/MetricHowLink/)
    const labels = [...hud.matchAll(/lbl:\s*'([^']+)'/g)].map((match) => match[1])
    expect(labels.length).toBeGreaterThan(5)
    for (const label of labels) {
      expect(HUD_KPI_HOW[label as keyof typeof HUD_KPI_HOW], label).toBeDefined()
    }
  })

  it('leftover, mix, and extra-type headers carry a how-link', () => {
    const pace = readFileSync(resolve('app/cities/[slug]/PublicPaceStats.tsx'), 'utf8')
    const mix = readFileSync(resolve('app/cities/[slug]/PublicMixStats.tsx'), 'utf8')
    const types = readFileSync(resolve('app/cities/[slug]/PublicProductTypes.tsx'), 'utf8')
    expect(pace).toMatch(/MetricHowLink/)
    expect(pace).toMatch(/PANEL_HOW\.pace/)
    expect(mix).toMatch(/MetricHowLink/)
    expect(mix).toMatch(/PANEL_HOW\.mix/)
    expect(types).toMatch(/MetricHowLink/)
    expect(types).toMatch(/PANEL_HOW\.products/)
  })

  it('the dictionary page renders every entry id', () => {
    const page = readFileSync(resolve('app/how-we-get-our-numbers/page.tsx'), 'utf8')
    expect(page).toMatch(/HOW_NUMBER_ENTRIES/)
    expect(page).toMatch(/HOW_WE_GET_OUR_NUMBERS_PATH/)
    expect(page).toMatch(/HowNumberHashScroll/)
    expect(page).not.toMatch(/market_pulse_live|market_metric|market_stats_cache/)
  })
})
