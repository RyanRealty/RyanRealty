import { describe, expect, it } from 'vitest'
import {
  QUALITY_SUSPECT_TAG,
  caseSwitches,
  classifyLeadQuality,
  describeSignals,
  hasSuspectTag,
  isDisposableEmail,
  isDotTrickEmail,
  isGluedName,
  isPatternEmail,
  isRandomToken,
  isRandomTokenName,
  isRoleAccountEmail,
  isSuspectSilencedAlertKind,
  qualityTags,
} from './lead-quality'

/**
 * FUNNEL-1 (visibility audit 2026-09-22). The shapes below are copied from the
 * 30-day read of crm_people (site doors) and from the pre-August book, so each
 * rule is tested against the rows it was written for: scripted rows must trip
 * it, real names and addresses must not.
 */

// Contact-form and join names from the 30-day read (every one scripted).
const BOT_NAMES = [
  'wriGVtBlPLxMRdxYUpcvg',
  'bJSKIwsurKTralgVeDiGblO',
  'QKlvETWISqnRlVJW',
  'LdJxqaFNBYKDdRGK',
  'xFTASUZOhtmkVANKQH', // 3 case changes, long upper runs
  'xcoiOIOgkndpvKAIJ',
  'BbxYggNvulOdbPey', // capitalised parts by chance, none a syllable
  'CfyyerAQhlfDrIkTRU LSYdfFluScaZUpTBfWdVM', // two random tokens, 2026-06-10 import
]

// Real names from the same read and from the book, plus glued names a person types.
const HUMAN_NAMES = [
  'ROBERT KESTER',
  'Tengiz Nozadze',
  'Kimberley Holland',
  'Janell k winegar',
  'Hannah Melotto',
  'Christopherson',
  'DeLaCruzGarcia',
  'JohnMcGregor',
  'Maria DeLaCruzGarcia',
  'McKenzie',
  "Mary-Jane O'Neil",
  '',
]

describe('random-token names', () => {
  it.each(BOT_NAMES)('flags %s', (name) => {
    expect(isRandomTokenName(name)).toBe(true)
  })

  it.each(HUMAN_NAMES)('passes %s', (name) => {
    expect(isRandomTokenName(name)).toBe(false)
  })

  it('counts case changes between letters', () => {
    expect(caseSwitches('aBcD')).toBe(3)
    expect(caseSwitches('Robert')).toBe(1)
  })

  it('tells a glued name from capitalised noise', () => {
    expect(isGluedName('JohnMcGregor')).toBe(true)
    expect(isGluedName('BbxYggNvulOdbPey')).toBe(false)
    expect(isRandomToken('Short')).toBe(false)
  })
})

describe('email shapes', () => {
  it('dot trick: shards of one word, or an invalid dot', () => {
    for (const e of [
      'k.el.v.f.ee@gmail.com',
      'c.h.anem.m.e.rso.n27.4@gmail.com',
      'cp.zu.yne.xs.v32@gmail.com',
      'shu..be.r.gma.n@gmail.com',
      '.lead@gmail.com',
    ]) {
      expect(isDotTrickEmail(e), e).toBe(true)
    }
  })

  it('dot trick: words joined by dots are a person', () => {
    for (const e of [
      'popsy.is.a.chocoholic@gmail.com',
      'on.one.is.here.ok@gmail.com',
      'exit.king.realty.srq1@gmail.com',
      'j.a.c.dafoo@gmail.com',
      'yoli.guzman66@icloud.com',
      'k.el.v.f.ee@yahoo.com', // not Gmail: dots are not ignored there
    ]) {
      expect(isDotTrickEmail(e), e).toBe(false)
    }
  })

  it('Faker-style Gmail local: 15+ letters then 2 or 3 digits', () => {
    for (const e of ['jordyaprobertsgxi97@gmail.com', 'francogaflatleycvp84@gmail.com', 'miriamrayburnhf649@gmail.com']) {
      expect(isPatternEmail(e), e).toBe(true)
    }
    for (const e of ['marilynjessen03@gmail.com', 'scottmallison11@gmail.com', 'jwinegar1978@gmail.com', 'lisadavis6@gmail.com']) {
      expect(isPatternEmail(e), e).toBe(false)
    }
  })

  it('role mailboxes and throwaway domains', () => {
    expect(isRoleAccountEmail('abuse@ziggo.nl')).toBe(true)
    expect(isRoleAccountEmail('info@smallbiz.com')).toBe(false)
    expect(isDisposableEmail('x@mailinator.com')).toBe(true)
    expect(isDisposableEmail('x@gmail.com')).toBe(false)
  })
})

describe('classifyLeadQuality', () => {
  it('a real contact-form submit is clean', () => {
    expect(classifyLeadQuality({ name: 'Tengiz Nozadze', email: 'ten1987la@gmail.com' })).toEqual({
      suspect: false,
      signals: [],
    })
  })

  it('a scripted contact-form submit is suspect, with every signal named', () => {
    const v = classifyLeadQuality({ name: 'wriGVtBlPLxMRdxYUpcvg', email: 'k.el.v.f.ee@gmail.com' })
    expect(v.suspect).toBe(true)
    expect(v.signals).toEqual(['random-token-name', 'dot-trick-email'])
  })

  it('a filled honeypot alone is suspect', () => {
    expect(classifyLeadQuality({ name: 'Hannah Melotto', email: 'h@melottogroup.com', honeypot: true }).signals).toEqual([
      'honeypot',
    ])
  })

  it('the Faker address counts only on a nameless (alerts-sheet) submit', () => {
    expect(classifyLeadQuality({ email: 'jordyaprobertsgxi97@gmail.com' }).suspect).toBe(true)
    // A typed real name with the same-shaped address: 19 of 5,551 Gmail rows in
    // the pre-August book look like this and are real owners.
    expect(classifyLeadQuality({ name: 'Christopher Pearson', email: 'christopherpearson53@gmail.com' }).suspect).toBe(false)
  })
})

describe('tags, alert kinds, words', () => {
  it('tags a suspect with the flag plus one tag per signal', () => {
    const v = classifyLeadQuality({ name: 'QKlvETWISqnRlVJW', email: 'abuse@ziggo.nl' })
    expect(qualityTags(v)).toEqual([
      QUALITY_SUSPECT_TAG,
      'quality:signal:random-token-name',
      'quality:signal:role-account-email',
    ])
    expect(qualityTags({ suspect: false, signals: [] })).toEqual([])
  })

  it('hasSuspectTag reads the one flag', () => {
    expect(hasSuspectTag(['source:contact-form', QUALITY_SUSPECT_TAG])).toBe(true)
    expect(hasSuspectTag(['quality:signal:honeypot'])).toBe(false)
    expect(hasSuspectTag(null)).toBe(false)
  })

  it('silences lead pings, never a reply, a booking, a CMA or the digest', () => {
    for (const k of ['new-lead', 'untouched-5m', 'untouched-24h', 'return-visit:abc:220222277', 'return-visit:cma:slug']) {
      expect(isSuspectSilencedAlertKind(k), k).toBe(true)
    }
    for (const k of ['reply:sms', 'reply:cma:slug', 'appointment-booked:9', 'cma-ready:slug', 'task-reminder:2026-09-23']) {
      expect(isSuspectSilencedAlertKind(k), k).toBe(false)
    }
  })

  it('says why in plain words', () => {
    expect(describeSignals(['honeypot'])).toBe('the hidden form field was filled')
  })
})
