/**
 * The runtime construction gate. Matt 2026-08-05: "anytime any content / copy
 * is created it is run through this voice. Period." These assert that the
 * shapes he rejected are hard-fails at the runtime chokepoint every content
 * path already calls, not just at commit time.
 *
 * SCOPE NARROWED 2026-08-06 — see the header of scripts/voice-constructions.cjs.
 * The gate polices CONDUCT and TRUTH, not style: invented quotations, self-
 * praise, pandering, manufactured urgency, forecasts stated as fact, numbers
 * made to talk. The four shape rules it used to carry (coined maxim, meaning-
 * narration, sermon clause, obvious restatement) were retired because Buffett
 * uses all four on purpose — interpreting a number for the reader IS the
 * Berkshire letter — and enforcing them rewrote the site into government-
 * service prose in a day. VOICE.md still lists them as writing guidance; a
 * shape a good writer chooses deliberately is advice, not a gate.
 */
import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from './check'

const KILLED = [
  ['data-speaks', '450 sales say the calendar matters for your listing.'],
  ['throat-clear', 'Before the numbers, here is what this property has going for it.'],
  ['pandering', "Don't worry, we will handle everything for you."],
  ['fake urgency', "Act fast, this one won't last long."],
  ['self-praise', 'We pride ourselves on honest guidance for every client.'],
  ['false certainty', 'Your home will sell in about 30 days at this price.'],
  ['takeaway framing', 'The bottom line is that your price band is crowded.'],
] as const

/**
 * The retirement, asserted in the other direction. Without these the four
 * shape rules can be quietly reinstated by anyone who reads VOICE.md's prose
 * and assumes the omission was an oversight — which is exactly how they got
 * here the first time. Re-adding one now fails this file and sends the reader
 * to the rationale before they spend a day rewriting the site.
 */
const RETIRED = [
  ['coined maxim', 'This number is a starting point, not a verdict.'],
  ['meaning-narration', 'This is history, not a forecast. It tells you when buyers have been most active.'],
  ['sermon clause', 'Cash buyers move faster, which is one more reason the list price has to be right.'],
  ['obvious restatement', 'The bar is the median days to pending. Lower is faster.'],
] as const

describe('runtime construction gate', () => {
  for (const [label, text] of KILLED) {
    it(`blocks the ${label}`, () => {
      const r = checkBrandVoice(text)
      expect(r.ok).toBe(false)
      expect(r.violations.some((v) => v.kind === 'construction')).toBe(true)
    })
  }

  it('passes clean canon-compliant copy', () => {
    const r = checkBrandVoice(
      '131 homes are for sale in Bend between $504,000 and $616,000. The median one has been listed 53 days. 68 more are pending in the same band.',
    )
    expect(r.ok).toBe(true)
  })

  it('passes a plain report sentence with a number and its source', () => {
    const r = checkBrandVoice(
      'April homes went pending in 9 days. December homes took 39. Based on 7,205 sales closed in Bend since August 2023.',
    )
    expect(r.ok).toBe(true)
  })

  for (const [label, text] of RETIRED) {
    it(`allows the ${label} — retired 2026-08-06, a taste rule, not a gate`, () => {
      const r = checkBrandVoice(text)
      expect(r.violations.some((v) => v.kind === 'construction')).toBe(false)
    })
  }

  it('names the rule and the fix so the writer knows what to do', () => {
    const r = checkBrandVoice('The bottom line is that your price band is crowded.')
    const hit = r.violations.find((v) => v.kind === 'construction')
    expect(hit?.term).toMatch(/rule \d/)
  })
})
