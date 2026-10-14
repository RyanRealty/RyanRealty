import { describe, expect, it } from 'vitest'
import { DELIVERABLES, formatRules, printable, resolveTarget, rulesForTarget, rulesJson } from './print'
import { RULES } from './rules'
import { rulesVersion } from './rules-version'

const target = (asked: string) => {
  const t = resolveTarget(asked)
  if ('error' in t) throw new Error(t.error)
  return t
}

describe('resolveTarget', () => {
  it('takes a deliverable or a video type, and a buyer ad is a video and a paid ad', () => {
    expect(target('still')).toEqual({ asked: 'still', deliverables: ['still'], videoType: null })
    expect(target('listing')).toEqual({ asked: 'listing', deliverables: ['video'], videoType: 'listing' })
    expect(target('buyer_ad')).toEqual({ asked: 'buyer_ad', deliverables: ['video', 'paid_ad'], videoType: 'buyer_ad' })
  })

  it('names what is valid when it is neither', () => {
    const t = resolveTarget('podcast')
    expect('error' in t && t.error).toMatch(/neither a deliverable \(video, still, carousel, post_copy, paid_ad\) nor a video type \(listing, market_update/)
    expect([...DELIVERABLES]).toEqual(['video', 'still', 'carousel', 'post_copy', 'paid_ad'])
  })
})

describe('rulesForTarget', () => {
  it('gives a video type the video rules and leaves out the rules of other types', () => {
    const buyer = rulesForTarget(target('buyer_ad')).map((r) => r.id)
    const listing = rulesForTarget(target('listing')).map((r) => r.id)
    const persona = RULES.find((r) => /names a persona/.test(r.title))!
    const civic = RULES.find((r) => /civic piece lists its sources/.test(r.title))!
    expect(buyer).toContain(persona.id)
    expect(listing).not.toContain(persona.id)
    expect(buyer).not.toContain(civic.id)
    expect(rulesForTarget(target('news_civic')).map((r) => r.id)).toContain(civic.id)
  })

  it('gives the generic video target every video rule, type-limited ones included', () => {
    const all = rulesForTarget(target('video')).map((r) => r.id)
    expect(all).toContain(RULES.find((r) => /names a persona/.test(r.title))!.id)
  })

  it('gives a paid ad the ad rules and a post only its own', () => {
    const ad = rulesForTarget(target('paid_ad')).map((r) => r.title)
    expect(ad.some((t) => /Ad targeting uses no age, gender or ZIP/.test(t))).toBe(true)
    const post = rulesForTarget(target('post_copy'))
    expect(post.length).toBeGreaterThan(0)
    expect(post.every((r) => r.appliesTo.includes('post_copy'))).toBe(true)
  })
})

describe('formatRules', () => {
  it('prints every rule once, grouped by step, with ID, status, title, source and the number as it stands', () => {
    const text = formatRules(target('buyer_ad'))
    const rows = printable(target('buyer_ad'))
    for (const { rule } of rows) expect(text.match(new RegExp(`^${rule.id} \\[`, 'gm'))?.length, rule.id).toBe(1)
    expect(text).toMatch(/== Step brief \(Brief\): \d+ rules? ==/)
    expect(text).toMatch(/== Step master \(Master\)/)
    expect(text.indexOf('== Step brief')).toBeLessThan(text.indexOf('== Step board'))
    expect(text.indexOf('== Step board')).toBeLessThan(text.indexOf('== Step master'))
    expect(text).toContain(`Rules version ${rulesVersion().slice(0, 12)}`)
    // The buyer ad's own hook limit, read from video_types.json: 1.5, not the default 2.
    expect(text).toMatch(/number: defaults\.hook_max_s = 1\.5 \(lower is tighter\)/)
    expect(text).toMatch(/number: defaults\.min_hold_s = 2\.5 \(higher is tighter\)/)
    expect(text).toMatch(/\[planned, certifier\]/)
    expect(text).toMatch(/\[enforced\] .*hook lands/i)
  })

  it('shows the default with the types that set their own when no type was asked for', () => {
    expect(formatRules(target('video'))).toMatch(/number: defaults\.hook_max_s = 2 \(buyer_ad 1\.5\) \(lower is tighter\)/)
  })

  it('says how many rules are enforced and how many only planned', () => {
    const rows = printable(target('video'))
    const enforced = rows.filter((r) => r.rule.status === 'enforced').length
    expect(formatRules(target('video'))).toContain(`${rows.length} rules: ${enforced} are enforced by a step today, ${rows.length - enforced} are planned`)
  })

  it('has no dash in anything it prints', () => {
    expect(/[–—]/.test(formatRules(target('buyer_ad')))).toBe(false)
  })

  it('prints for a program too', () => {
    const j = rulesJson(target('listing')) as { rules: Array<{ id: string; step: string }>; rulesVersion: string }
    expect(j.rulesVersion).toBe(rulesVersion())
    expect(j.rules.length).toBe(rulesForTarget(target('listing')).length)
    expect(j.rules[0]).toHaveProperty('title')
  })
})
