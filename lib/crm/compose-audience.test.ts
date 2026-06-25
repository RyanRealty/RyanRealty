import { describe, it, expect } from 'vitest'
import {
  audienceToSelection,
  parseComposeAudience,
  shapeComposePreview,
  normalizeScheduledAt,
  validateComposeContent,
  MIN_SCHEDULE_LEAD_MS,
} from './compose-audience'

describe('audienceToSelection', () => {
  it('maps a saved view to a view-mode selection', () => {
    expect(audienceToSelection({ kind: 'view', viewId: 7 })).toEqual({ mode: 'view', viewId: 7 })
  })

  it('maps a stage to a matching-mode selection with the stage filter', () => {
    expect(audienceToSelection({ kind: 'stage', stage: 'Past Client' })).toEqual({
      mode: 'matching',
      filters: { stage: 'Past Client' },
    })
  })

  it('throws on a non-positive viewId', () => {
    expect(() => audienceToSelection({ kind: 'view', viewId: 0 })).toThrow(/smart list/i)
    expect(() => audienceToSelection({ kind: 'view', viewId: -1 })).toThrow(/smart list/i)
  })

  it('throws on an empty stage', () => {
    expect(() => audienceToSelection({ kind: 'stage', stage: '  ' })).toThrow(/stage/i)
  })
})

describe('parseComposeAudience', () => {
  it('parses a valid view payload', () => {
    expect(parseComposeAudience({ kind: 'view', viewId: 12 })).toEqual({
      ok: true,
      audience: { kind: 'view', viewId: 12 },
    })
  })

  it('parses a valid stage payload and trims', () => {
    expect(parseComposeAudience({ kind: 'stage', stage: '  Lead  ' })).toEqual({
      ok: true,
      audience: { kind: 'stage', stage: 'Lead' },
    })
  })

  it('rejects an unknown kind', () => {
    const r = parseComposeAudience({ kind: 'segment', stage: 'x' })
    expect(r.ok).toBe(false)
  })

  it('rejects a missing viewId', () => {
    const r = parseComposeAudience({ kind: 'view' })
    expect(r.ok).toBe(false)
  })

  it('rejects null / undefined', () => {
    expect(parseComposeAudience(null).ok).toBe(false)
    expect(parseComposeAudience(undefined).ok).toBe(false)
  })

  it('round-trips through audienceToSelection', () => {
    const parsed = parseComposeAudience({ kind: 'view', viewId: 3 })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(audienceToSelection(parsed.audience)).toEqual({ mode: 'view', viewId: 3 })
    }
  })
})

describe('shapeComposePreview', () => {
  it('shapes a clean cohort (no suppressions)', () => {
    const p = shapeComposePreview({ total: 200, suppressedEstimate: 0 })
    expect(p).toEqual({
      total: 200,
      willSkip: 0,
      willSend: 200,
      summary: '200 contacts match. All can be emailed.',
    })
  })

  it('subtracts the suppression estimate from the mailable count', () => {
    const p = shapeComposePreview({ total: 412, suppressedEstimate: 38 })
    expect(p.total).toBe(412)
    expect(p.willSkip).toBe(38)
    expect(p.willSend).toBe(374)
    expect(p.summary).toContain('412 contacts match')
    expect(p.summary).toContain('38 will be skipped')
    expect(p.summary).toContain('374 will be emailed')
  })

  it('clamps willSkip to total and never goes negative on willSend', () => {
    const p = shapeComposePreview({ total: 5, suppressedEstimate: 99 })
    expect(p.willSkip).toBe(5)
    expect(p.willSend).toBe(0)
  })

  it('handles an empty audience', () => {
    const p = shapeComposePreview({ total: 0, suppressedEstimate: 0 })
    expect(p.total).toBe(0)
    expect(p.willSend).toBe(0)
    expect(p.summary).toMatch(/no contacts match/i)
  })

  it('singularizes one contact', () => {
    const p = shapeComposePreview({ total: 1, suppressedEstimate: 0 })
    expect(p.summary).toContain('1 contact match')
  })

  it('coerces junk numbers to 0 without throwing', () => {
    const p = shapeComposePreview({ total: NaN as unknown as number, suppressedEstimate: NaN as unknown as number })
    expect(p.total).toBe(0)
    expect(p.willSend).toBe(0)
  })

  it('produces a summary free of banned punctuation (em-dash, semicolon)', () => {
    const p = shapeComposePreview({ total: 412, suppressedEstimate: 38 })
    expect(p.summary).not.toMatch(/[—–;]/)
  })
})

describe('normalizeScheduledAt', () => {
  const now = Date.parse('2026-06-25T12:00:00.000Z')

  it('accepts a future time and returns ISO', () => {
    const r = normalizeScheduledAt('2026-06-25T18:00:00.000Z', now)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.iso).toBe('2026-06-25T18:00:00.000Z')
  })

  it('rejects an unparseable time', () => {
    const r = normalizeScheduledAt('not-a-date', now)
    expect(r.ok).toBe(false)
  })

  it('rejects a past time', () => {
    const r = normalizeScheduledAt('2026-06-25T11:00:00.000Z', now)
    expect(r.ok).toBe(false)
  })

  it('rejects a time inside the minimum lead window', () => {
    const tooSoon = new Date(now + MIN_SCHEDULE_LEAD_MS - 1).toISOString()
    expect(normalizeScheduledAt(tooSoon, now).ok).toBe(false)
  })

  it('accepts a time exactly at the lead boundary', () => {
    const atBoundary = new Date(now + MIN_SCHEDULE_LEAD_MS).toISOString()
    expect(normalizeScheduledAt(atBoundary, now).ok).toBe(true)
  })
})

describe('validateComposeContent', () => {
  it('trusts a saved templateId', () => {
    expect(validateComposeContent({ templateId: '5' })).toEqual({ ok: true })
  })

  it('requires both subject and body for inline content', () => {
    expect(validateComposeContent({ subject: 'Hi', body: '' }).ok).toBe(false)
    expect(validateComposeContent({ subject: '', body: 'text' }).ok).toBe(false)
  })

  it('accepts clean inline content', () => {
    expect(validateComposeContent({ subject: 'Market update', body: 'Here is your update.' })).toEqual({
      ok: true,
    })
  })

  it('rejects inline content with banned punctuation', () => {
    const r = validateComposeContent({ subject: 'Update', body: 'Great news; you saved.' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/brand voice/i)
  })
})
