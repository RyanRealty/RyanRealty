import { describe, expect, it, vi } from 'vitest'
import {
  BANNED_PROMPT_TOKENS,
  assertCraftClean,
  buildMotionPrompt,
  buildStillPrompt,
  findBannedTokens,
  type ShotSpec,
} from './craft'
import { centralOregonPlate, getStudioFormat, listingShot, STUDIO_FORMAT_LIST } from './formats'
import { planSlate, type StudioTrigger } from './slate'
import { unauthorisedFigures, weakOpener, writeCaption } from './caption'
import { addSpend, assertBudget, imageCost, newLedger, SpendCapError, videoCost } from './spend'
import { normalizeVerdict } from '@/lib/grok/vision'
import { produceStudioDraft, type StudioAdapters } from './produce'
import type { MarketPulse } from '@/lib/data/types/market'

const SPEC: ShotSpec = {
  lens: '35mm spherical, T2.8',
  framing: 'eye-level, wide',
  subject: 'A juniper on a sage flat',
  light: 'Low sun key from camera-left, 5400K, no second sun',
  move: 'push',
  worldMotion: 'sage in a light breeze',
}

describe('craft', () => {
  it('builds a still prompt in shot-language order with hard negatives', () => {
    const prompt = buildStillPrompt(SPEC)
    expect(prompt.indexOf('35mm spherical')).toBeLessThan(prompt.indexOf('A juniper'))
    expect(prompt).toContain('no text')
    expect(prompt).toContain('no people')
  })

  it('quantifies the camera move and states a motion budget', () => {
    const prompt = buildMotionPrompt(SPEC)
    expect(prompt).toContain('30cm over 6 seconds')
    expect(prompt).toContain('Motion amount: minimal')
    expect(prompt).toContain('no pan, no tilt')
  })

  it('keeps people negatives out when a format casts a person', () => {
    expect(buildStillPrompt({ ...SPEC, allowPeople: true })).not.toContain('no people')
  })

  it('catches booster tokens that push the model toward slop', () => {
    expect(findBannedTokens('a stunning 8k masterpiece')).toEqual(
      expect.arrayContaining(['8k', 'masterpiece', 'stunning']),
    )
    expect(() => assertCraftClean('ultra-detailed juniper')).toThrow(/booster tokens/)
    expect(findBannedTokens(buildStillPrompt(SPEC))).toEqual([])
  })

  it('has no banned token that would trip on its own generated prompts', () => {
    for (const format of STUDIO_FORMAT_LIST) {
      const spec = format.frameSource === 'mls_photo' ? listingShot() : centralOregonPlate({ timeOfDay: 'golden hour' })
      expect(findBannedTokens(buildStillPrompt(spec))).toEqual([])
      expect(findBannedTokens(buildMotionPrompt(spec))).toEqual([])
    }
    expect(BANNED_PROMPT_TOKENS.length).toBeGreaterThan(20)
  })

  it('tells the listing shot not to change the house', () => {
    const prompt = buildStillPrompt(listingShot())
    expect(prompt).toContain('do not change the house')
    expect(prompt).toContain('unchanged')
  })

  it('anchors the plate to Central Oregon so wrong_region is unlikely', () => {
    const prompt = buildStillPrompt(centralOregonPlate({ timeOfDay: 'golden hour', place: 'Tetherow' }))
    expect(prompt).toContain('Tetherow')
    expect(prompt).toMatch(/juniper|sage|basalt/)
    expect(prompt).toContain('no houses')
  })
})

describe('vision verdict normalisation', () => {
  it('lets defects override an optimistic pass', () => {
    const verdict = normalizeVerdict({ pass: true, score: 95, defects: ['rendered_text'], describes: 'x', fixHint: '' })
    expect(verdict.pass).toBe(false)
  })

  it('fails a clean frame that scores under the bar', () => {
    expect(normalizeVerdict({ pass: true, score: 60, defects: [], describes: 'x', fixHint: '' }).pass).toBe(false)
    expect(normalizeVerdict({ pass: true, score: 88, defects: [], describes: 'x', fixHint: '' }).pass).toBe(true)
  })

  it('treats a malformed reply as a fail rather than a pass', () => {
    expect(normalizeVerdict({}).pass).toBe(false)
    expect(normalizeVerdict({}).score).toBe(0)
  })
})

describe('spend', () => {
  it('prices media off the published rate card', () => {
    expect(imageCost('grok-imagine-image-2.0', 2)).toBeCloseTo(0.08, 6)
    expect(videoCost('grok-imagine-video-1.5', 6)).toBeCloseTo(0.48, 6)
  })

  it('refuses the next expensive step once the cap is reached', () => {
    const ledger = newLedger()
    addSpend(ledger, { step: 'stills', usd: 1.4 })
    expect(() => assertBudget(ledger, 0.48, 'animation')).toThrow(SpendCapError)
  })
})

describe('caption', () => {
  it('flags a figure the model invented', () => {
    expect(unauthorisedFigures('Median list price is $750K.', { 'median list price': '$749,000' })).toContain('$750')
  })

  it('accepts the exact authorised figure', () => {
    expect(unauthorisedFigures('Median list price is $749,000.', { 'median list price': '$749,000' })).toEqual([])
  })

  it('does not treat a street number or a listing key in the link as an invented figure', () => {
    // This exact false positive killed every listing draft: 61574 is the
    // address and the long number is the listing key inside the CTA URL.
    const caption =
      '61574 Devils Lake, Bend. $849,900. Two bedrooms, two baths. ' +
      'Details at https://ryan-realty.com/listing/20260825160502683924000000'
    expect(
      unauthorisedFigures(caption, { 'list price': '$849,900' }, {
        subject: '61574 Devils Lake, Bend',
        cta: 'Details at https://ryan-realty.com/listing/20260825160502683924000000',
      }),
    ).toEqual([])
  })

  it('still catches an invented figure when a subject is supplied', () => {
    expect(
      unauthorisedFigures('61574 Devils Lake, Bend. Up 12% this year.', { 'list price': '$849,900' }, {
        subject: '61574 Devils Lake, Bend',
      }),
    ).toContain('12%')
  })

  it('treats numbers inside a figure LABEL as authorised', () => {
    // "homes closed in the last 30 days" contains 30. A caption restating the
    // window is correct, and flagging it killed a finished draft.
    expect(
      unauthorisedFigures('Bend. 214 homes closed in the last 30 days.', {
        'homes closed in the last 30 days': '214',
      }),
    ).toEqual([])
  })

  it('rejects filler openers that pad a fact', () => {
    expect(weakOpener('This listing is in Bend.')).toBe('this ')
    expect(weakOpener('Just listed in Bend.')).toBe('just listed')
    expect(weakOpener('61574 Devils Lake, Bend. $849,900.')).toBeNull()
  })

  it('retries when the caption opens with filler', async () => {
    const writeStructured = vi
      .fn()
      .mockResolvedValueOnce({ value: { caption: 'This listing is in Bend.', altText: 'a' }, raw: '', costUsd: 0 })
      .mockResolvedValueOnce({ value: { caption: 'Bend, Oregon. Steady.', altText: 'a' }, raw: '', costUsd: 0 })
    const result = await writeCaption({ subject: 'Bend, Oregon', platforms: ['instagram'] }, {
      writeStructured: writeStructured as never,
    })
    expect(result.ok).toBe(true)
    expect(writeStructured).toHaveBeenCalledTimes(2)
  })

  it('retries once when the first caption invents a number, then succeeds', async () => {
    const writeStructured = vi
      .fn()
      .mockResolvedValueOnce({ value: { caption: 'About $750K here.', altText: 'a' }, raw: '', costUsd: 0 })
      .mockResolvedValueOnce({ value: { caption: 'Median list price is $749,000.', altText: 'a' }, raw: '', costUsd: 0 })

    const result = await writeCaption(
      { subject: 'Bend', figures: { 'median list price': '$749,000' }, platforms: ['instagram'] },
      { writeStructured: writeStructured as never },
    )
    expect(result.ok).toBe(true)
    expect(writeStructured).toHaveBeenCalledTimes(2)
  })

  it('gives up rather than shipping a caption that keeps inventing figures', async () => {
    const writeStructured = vi
      .fn()
      .mockResolvedValue({ value: { caption: 'Roughly $750K.', altText: 'a' }, raw: '', costUsd: 0 })
    const result = await writeCaption(
      { subject: 'Bend', figures: { 'median list price': '$749,000' }, platforms: ['instagram'] },
      { writeStructured: writeStructured as never },
    )
    expect(result.ok).toBe(false)
  })

  it('strips dashes, which are a hard fail at the publish boundary', async () => {
    const writeStructured = vi
      .fn()
      .mockResolvedValue({ value: { caption: 'Bend is steady — for now.', altText: 'a' }, raw: '', costUsd: 0 })
    const result = await writeCaption({ subject: 'Bend', platforms: ['instagram'] }, {
      writeStructured: writeStructured as never,
    })
    if (result.ok) expect(result.result.caption).not.toMatch(/[–—]/)
  })
})

describe('slate', () => {
  const pulse = { geoType: 'city', geoSlug: 'bend' } as unknown as MarketPulse
  const triggers: StudioTrigger[] = [
    { kind: 'new_listing', query: '220189422', label: '1844 NW Awbrey Rd, Bend', weight: 40 },
    { kind: 'community_inventory', query: 'tetherow', label: 'Tetherow', weight: 12 },
    { kind: 'community_inventory', query: 'caldera-springs', label: 'Caldera Springs', weight: 9 },
  ]

  it('leads with the perishable thing: a listing that just came on', () => {
    const slate = planSlate({ pulse, triggers, max: 3, today: new Date('2026-08-26T12:00:00Z') })
    expect(slate[0].formatId).toBe('listing_motion')
    expect(slate[0].subjectQuery).toBe('220189422')
  })

  it('adds the regional pulse on Mondays only', () => {
    const monday = planSlate({ pulse, triggers, max: 3, today: new Date('2026-08-24T12:00:00Z') })
    const tuesday = planSlate({ pulse, triggers, max: 3, today: new Date('2026-08-25T12:00:00Z') })
    expect(monday.some((i) => i.formatId === 'market_pulse')).toBe(true)
    expect(tuesday.some((i) => i.formatId === 'market_pulse')).toBe(false)
  })

  it('rotates communities by day instead of always picking the same one', () => {
    const a = planSlate({ pulse, triggers, max: 3, today: new Date('2026-08-26T12:00:00Z') })
    const b = planSlate({ pulse, triggers, max: 3, today: new Date('2026-08-27T12:00:00Z') })
    const pick = (s: ReturnType<typeof planSlate>) => s.find((i) => i.formatId === 'place_video')?.subjectQuery
    expect(pick(a)).not.toEqual(pick(b))
  })

  it('answers the room when nothing of ours moved', () => {
    const slate = planSlate({ pulse: null, triggers: [], max: 3, today: new Date('2026-08-26T12:00:00Z') })
    expect(slate).toHaveLength(1)
    expect(slate[0].formatId).toBe('trend_reactive')
  })

  it('never exceeds the requested size', () => {
    expect(planSlate({ pulse, triggers, max: 1, today: new Date('2026-08-24T12:00:00Z') })).toHaveLength(1)
    expect(planSlate({ pulse, triggers, max: 0, today: new Date('2026-08-24T12:00:00Z') })).toHaveLength(0)
  })
})

describe('produce pipeline', () => {
  function adapters(overrides: Partial<StudioAdapters> = {}): StudioAdapters {
    return {
      resolveSubject: vi.fn().mockResolvedValue({
        label: 'Bend, Oregon',
        figures: { 'active listings': '412' },
        citations: [{ figure: '412', source: 'Supabase', table: 'market_pulse_live' }],
        place: 'Bend',
      }),
      generateStills: vi
        .fn()
        .mockResolvedValue({ images: [Buffer.from('a'), Buffer.from('b')], model: 'grok-imagine-image-2.0', costTicks: null }),
      inspectFrame: vi
        .fn()
        .mockResolvedValue({ pass: true, score: 91, defects: [], describes: 'desert', fixHint: '', costUsd: null }),
      animate: vi
        .fn()
        .mockResolvedValue({ url: 'https://x.ai/tmp.mp4', model: 'grok-imagine-video-1.5', durationSeconds: 6, costTicks: null }),
      writeCaption: vi
        .fn()
        .mockResolvedValue({ ok: true, result: { caption: '412 active listings.', altText: 'alt', costUsd: 0, attempts: 1 } }),
      downloadUrl: vi.fn().mockResolvedValue(Buffer.from('mp4')),
      storeMedia: vi
        .fn()
        .mockImplementation(async ({ filename }) => ({ ok: true, url: `https://cdn.test/${filename}` })),
      insertPending: vi.fn().mockResolvedValue({ ok: true, id: 'draft-1' }),
      markReady: vi.fn().mockResolvedValue({ ok: true }),
      killDraft: vi.fn().mockResolvedValue({ ok: true }),
      ...overrides,
    }
  }

  const input = {
    formatId: 'market_pulse' as const,
    brokerSlug: 'matt',
    requestedBy: 'matt@ryan-realty.com',
    origin: 'console' as const,
  }

  it('produces a ready draft with citations and a publish payload, unapproved', async () => {
    const a = adapters()
    const result = await produceStudioDraft(input, a)
    expect(result.ok).toBe(true)

    const ready = (a.markReady as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(ready.executorResponse.citations).toHaveLength(1)
    expect(ready.executorResponse.publish_payload.mediaUrl).toBe('https://cdn.test/clip.mp4')
    expect(ready.executorResponse.publish_payload.approvalRef).toEqual({ actionId: 'draft-1' })
    // The human stamp is not ours to make.
    expect(ready.payloadPatch.caption).toBe('412 active listings.')
  })

  it('stores its own copy instead of pointing at the expiring generator URL', async () => {
    const a = adapters()
    await produceStudioDraft(input, a)
    const stored = (a.storeMedia as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].filename)
    expect(stored).toContain('clip.mp4')
    const ready = (a.markReady as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(String(ready.executorResponse.media.url)).not.toContain('x.ai')
  })

  it('kills the draft when no frame survives inspection, and never animates', async () => {
    const a = adapters({
      inspectFrame: vi
        .fn()
        .mockResolvedValue({ pass: false, score: 40, defects: ['rendered_text'], describes: '', fixHint: 'drop the sign', costUsd: null }),
    })
    const result = await produceStudioDraft(input, a)
    expect(result.ok).toBe(false)
    expect(a.animate).not.toHaveBeenCalled()
    expect(a.killDraft).toHaveBeenCalled()
  })

  it('regenerates once using the inspector fix hint before giving up', async () => {
    const inspectFrame = vi
      .fn()
      .mockResolvedValueOnce({ pass: false, score: 55, defects: ['wrong_region'], describes: '', fixHint: 'use juniper not palm', costUsd: null })
      .mockResolvedValueOnce({ pass: false, score: 58, defects: ['wrong_region'], describes: '', fixHint: 'use juniper not palm', costUsd: null })
      .mockResolvedValue({ pass: true, score: 90, defects: [], describes: 'desert', fixHint: '', costUsd: null })
    const a = adapters({ inspectFrame })
    const result = await produceStudioDraft(input, a)
    expect(result.ok).toBe(true)
    expect(a.generateStills).toHaveBeenCalledTimes(2)
    const retryPrompt = (a.generateStills as ReturnType<typeof vi.fn>).mock.calls[1][0].prompt
    expect(retryPrompt).toContain('use juniper not palm')
  })

  it('refuses a figures format that produced no citations', async () => {
    const a = adapters({
      resolveSubject: vi.fn().mockResolvedValue({ label: 'Bend', figures: {}, citations: [] }),
    })
    const result = await produceStudioDraft(input, a)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/No trace, no ship/)
  })

  it('kills rather than shipping a caption the voice gate rejected, without paying for motion', async () => {
    const a = adapters({
      writeCaption: vi.fn().mockResolvedValue({ ok: false, error: 'Caption failed twice: banned language' }),
    })
    const result = await produceStudioDraft(input, a)
    expect(result.ok).toBe(false)
    expect(a.killDraft).toHaveBeenCalled()
    expect(a.markReady).not.toHaveBeenCalled()
    // The caption runs BEFORE animation: a caption failure after the clip is
    // rendered throws away a finished video. This cost $0.48 once.
    expect(a.animate).not.toHaveBeenCalled()
  })

  it('does not generate or inspect a frame for a real MLS photograph', async () => {
    const a = adapters({
      resolveSubject: vi.fn().mockResolvedValue({
        label: '1844 NW Awbrey Rd, Bend',
        figures: { 'list price': '$895,000' },
        citations: [{ figure: '$895,000', source: 'Supabase', table: 'listings' }],
        sourcePhotoUrl: 'https://mls.test/photo.jpg',
      }),
    })
    const result = await produceStudioDraft({ ...input, formatId: 'listing_motion', subjectQuery: '220189422' }, a)
    expect(result.ok).toBe(true)
    expect(a.generateStills).not.toHaveBeenCalled()
    expect(a.inspectFrame).not.toHaveBeenCalled()
    const animateCall = (a.animate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(animateCall.imageUrl).toBe('https://mls.test/photo.jpg')
  })

  it('requires a subject for formats that need one', async () => {
    const result = await produceStudioDraft({ ...input, formatId: 'listing_motion' }, adapters())
    expect(result.ok).toBe(false)
  })

  it('knows every format it advertises', () => {
    for (const format of STUDIO_FORMAT_LIST) expect(getStudioFormat(format.id)).toBeTruthy()
    expect(getStudioFormat('nope')).toBeNull()
  })
})
