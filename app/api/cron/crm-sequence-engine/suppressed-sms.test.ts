import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SUPPRESSED_SMS_FALLBACK_EMAIL_FLAG,
  decideSuppressedSmsStep,
  looksSuspect,
  suppressedSmsFallbackEmailEnabled,
  type Step,
} from './helpers'

/**
 * FUNNEL-3 (visibility audit 2026-09-22). An SMS step finished the WHOLE
 * enrollment when texting was suppressed, so 78 of 81 Buyer Master enrollments in
 * the 30 days to 2026-09-23 ended at step 1 after one email. A text-only block now skips the step;
 * a suspect or a wider block still halts; steps are never reordered.
 */

const NO_CONSENT = ['sms:no-sms-consent']
const base = { suspect: false, hasFallbackEmail: true, fallbackEmailEnabled: false }

describe('decideSuppressedSmsStep', () => {
  it('skips a step blocked only on the sms channel', () => {
    expect(decideSuppressedSmsStep({ ...base, reasons: NO_CONSENT })).toBe('skip')
    expect(decideSuppressedSmsStep({ ...base, reasons: ['sms:no-sms-consent', 'sms:stop-keyword'] })).toBe('skip')
  })

  it('a suspect never advances', () => {
    expect(decideSuppressedSmsStep({ ...base, reasons: NO_CONSENT, suspect: true })).toBe('halt')
  })

  it('an all-channel block, a compliance tag or a failed check still halts', () => {
    for (const reasons of [
      ['all:fleet:test'],
      ['sms:no-sms-consent', 'tag:contact:do-not-text'],
      ['tag:compliance:hard-stop'],
      ['suppression-check-failed: timeout'],
      [],
    ]) {
      expect(decideSuppressedSmsStep({ ...base, reasons }), reasons.join('|')).toBe('halt')
    }
  })

  it('sends the step email stand-in only when the switch is on and the step has one', () => {
    expect(decideSuppressedSmsStep({ ...base, reasons: NO_CONSENT, fallbackEmailEnabled: true })).toBe('fallback-email')
    expect(
      decideSuppressedSmsStep({ ...base, reasons: NO_CONSENT, fallbackEmailEnabled: true, hasFallbackEmail: false }),
    ).toBe('skip')
  })
})

describe('the fallback-email switch', () => {
  it('is OFF unless set to on', () => {
    expect(suppressedSmsFallbackEmailEnabled({})).toBe(false)
    expect(suppressedSmsFallbackEmailEnabled({ [SUPPRESSED_SMS_FALLBACK_EMAIL_FLAG]: 'true' })).toBe(false)
    expect(suppressedSmsFallbackEmailEnabled({ [SUPPRESSED_SMS_FALLBACK_EMAIL_FLAG]: ' ON ' })).toBe(true)
  })
})

describe('looksSuspect — the engine belt on the intake screen', () => {
  it('reads the tag', () => {
    expect(looksSuspect({ tags: ['quality:suspect'], name: 'Jane Doe', first_name: 'Jane' })).toBe(true)
  })

  it('catches a scripted row created before the screen existed', () => {
    expect(looksSuspect({ tags: [], first_name: 'bJSKIwsurKTralgVeDiGblO', name: 'bJSKIwsurKTralgVeDiGblO' })).toBe(true)
    expect(looksSuspect({ tags: [], name: 'Lead jordyaprobertsgxi97@gmail.com', emails: [{ value: 'jordyaprobertsgxi97@gmail.com' }] })).toBe(true)
  })

  it('lets a real person through', () => {
    expect(looksSuspect({ tags: ['audience:buyer'], first_name: 'Tengiz', last_name: 'Nozadze', emails: [{ value: 'ten1987la@gmail.com' }] })).toBe(false)
    expect(looksSuspect({ tags: [], name: 'Lead kwagnera@hotmail.com', emails: [{ value: 'kwagnera@hotmail.com' }] })).toBe(false)
  })
})

/**
 * The live master sequences as stored on 2026-09-23 (crm_sequences ids 2 and 1,
 * channels and confirm flags only). Walk them the way the engine advances:
 * a message step sends, a suppressed SMS step asks decideSuppressedSmsStep, and
 * the walk parks at the first confirm:true step (awaiting_broker_next).
 */
const BUYER_MASTER: Step[] = [{ channel: 'email' }, { channel: 'sms', delayMinutes: 30, fallbackEmailBody: 'x' }, { channel: 'task', confirm: true }]
const SELLER_MASTER: Step[] = [
  { channel: 'email' },
  { channel: 'sms', delayMinutes: 30, fallbackEmailBody: 'x' },
  { channel: 'task', confirm: true },
  { channel: 'email', confirm: true },
]

function walk(steps: Step[], reasons: string[], suspect: boolean): { end: 'suppressed' | 'awaiting_broker_next' | 'completed'; at: number } {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.channel === 'sms') {
      const d = decideSuppressedSmsStep({ reasons, suspect, hasFallbackEmail: Boolean(s.fallbackEmailBody), fallbackEmailEnabled: false })
      if (d === 'halt') return { end: 'suppressed', at: i }
    }
    const next = steps[i + 1]
    if (!next) return { end: 'completed', at: i + 1 }
    if (next.confirm) return { end: 'awaiting_broker_next', at: i + 1 }
  }
  return { end: 'completed', at: steps.length }
}

describe('no live master sequence ends before its last automatic step on a text-only block', () => {
  it.each([
    ['Buyer Master', BUYER_MASTER],
    ['Seller Master', SELLER_MASTER],
  ])('%s reaches the broker-confirmed step', (_name, steps) => {
    expect(walk(steps, NO_CONSENT, false)).toEqual({ end: 'awaiting_broker_next', at: 2 })
  })

  it('a suspect still stops at the text step', () => {
    expect(walk(BUYER_MASTER, NO_CONSENT, true)).toEqual({ end: 'suppressed', at: 1 })
  })

  it('the route asks the decision before it halts, and passes the suspect belt', () => {
    const route = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
    const smsGateAt = route.indexOf("const gate = await isSuppressed(person.id, 'sms')")
    const decideAt = route.indexOf('decideSuppressedSmsStep({', smsGateAt)
    const haltAt = route.indexOf("if (onSuppressed === 'halt') {", smsGateAt)
    const finishAt = route.indexOf("await finish({ status: 'suppressed' })", smsGateAt)
    expect(smsGateAt).toBeGreaterThan(-1)
    expect(decideAt).toBeGreaterThan(smsGateAt)
    expect(haltAt).toBeGreaterThan(decideAt)
    // The SMS branch's only whole-enrollment 'suppressed' finish sits under the halt decision.
    expect(finishAt).toBeGreaterThan(haltAt)
    expect(route.slice(smsGateAt, decideAt)).not.toContain("status: 'suppressed'")
    expect(route).toMatch(/suspect:\s*looksSuspect\(person\)/)
  })
})
