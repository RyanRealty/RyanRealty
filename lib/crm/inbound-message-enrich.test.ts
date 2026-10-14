import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  QUALITY_UNVERIFIED_TAG,
  hasUnverifiedTag,
} from '@/lib/crm/lead-quality'
import {
  ELIZE_INBOUND_SMS,
  REAL_NAME_PERSON,
  SCAM_INBOUND_SMS,
  SCAM_FROM_NUMBER,
  fallbackExtract,
  isPlaceholderPersonName,
  isOurVoicemailGreeting,
  looksLikeBulkTextScam,
  mergeExtract,
  normalizeExtract,
  planInboundEnrichment,
  type PersonSnapshot,
} from '@/lib/crm/inbound-message-enrich'

function placeholderPerson(over: Partial<PersonSnapshot> = {}): PersonSnapshot {
  return {
    name: 'Call lead 9453937490',
    first_name: null,
    last_name: null,
    source: 'inbound-call',
    tags: ['source:inbound-call'],
    stage: 'Lead',
    custom: {},
    timeframe: null,
    neighborhood_slug: null,
    subdivision: null,
    ...over,
  }
}

describe('isPlaceholderPersonName', () => {
  it('treats Call lead / Text lead / blank / bare phone as placeholders', () => {
    expect(isPlaceholderPersonName('Call lead 9453937490')).toBe(true)
    expect(isPlaceholderPersonName('Text lead 5415550100')).toBe(true)
    expect(isPlaceholderPersonName('Lead 5415550100')).toBe(true)
    expect(isPlaceholderPersonName('')).toBe(true)
    expect(isPlaceholderPersonName(null)).toBe(true)
    expect(isPlaceholderPersonName('+19453937490')).toBe(true)
  })

  it('does not treat a real name as a placeholder', () => {
    expect(isPlaceholderPersonName('Elize Marais')).toBe(false)
    expect(isPlaceholderPersonName('Jane Doe')).toBe(false)
  })
})

describe('Elize inbound SMS fixture', () => {
  it('extracts Elize Marais, buyer intent, and Tetherow from the stored text', () => {
    const extract = fallbackExtract({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' })
    expect(extract.firstName).toBe('Elize')
    expect(extract.lastName).toBe('Marais')
    expect(extract.intent).toBe('buyer')
    expect(extract.areas.map((a) => a.toLowerCase())).toEqual(expect.arrayContaining(['tetherow', 'bend']))
    expect(extract.scamLikely).toBe(false)
  })

  it('plans a name write, buyer lead type, Tetherow, and a transcript note on a placeholder person', () => {
    const extract = fallbackExtract({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' })
    const plan = planInboundEnrichment({
      person: placeholderPerson(),
      extract,
      body: ELIZE_INBOUND_SMS,
      channel: 'sms',
      fromNumber: '+19453937490',
    })
    expect(plan.setName).toEqual({ first: 'Elize', last: 'Marais', name: 'Elize Marais' })
    expect(plan.tagsToAdd).toEqual(expect.arrayContaining(['audience:buyer', 'source:inbound-sms']))
    expect(plan.tagsToAdd).not.toContain(QUALITY_UNVERIFIED_TAG)
    expect(plan.source).toBeNull()
    expect(plan.neighborhoodSlug).toBe('tetherow')
    expect(plan.subdivision).toBe('Tetherow')
    expect(plan.customPatch.lead_type).toBe('buyer')
    expect(plan.noteTitle.toLowerCase()).toContain('elize marais')
    expect(plan.noteBody).toContain(ELIZE_INBOUND_SMS)
    expect(plan.noteBody.toLowerCase()).toContain('tetherow')
    expect(plan.skipReason).toBeNull()
  })

  it('does not treat the Texas-area Elize text as a bulk-text scam', () => {
    const verdict = looksLikeBulkTextScam({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' })
    expect(verdict.scam).toBe(false)
  })
})

describe('real-name no-overwrite', () => {
  it('keeps Jane Doe and still writes the transcript note and buyer tags', () => {
    const extract = fallbackExtract({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' })
    const plan = planInboundEnrichment({
      person: REAL_NAME_PERSON,
      extract,
      body: ELIZE_INBOUND_SMS,
      channel: 'sms',
      fromNumber: '+19453937490',
    })
    expect(plan.setName).toBeNull()
    expect(plan.tagsToAdd).toEqual(expect.arrayContaining(['audience:buyer']))
    expect(plan.noteBody).toContain(ELIZE_INBOUND_SMS)
    expect(plan.customPatch.lead_type).toBe('buyer')
  })
})

describe('scam / unverified fixture', () => {
  it('flags generic out-of-area cash-buyer wording as unverified and does not set buyer', () => {
    const extract = fallbackExtract({ body: SCAM_INBOUND_SMS, fromNumber: SCAM_FROM_NUMBER })
    expect(extract.scamLikely).toBe(true)
    const plan = planInboundEnrichment({
      person: placeholderPerson({ name: 'Text lead 2125550199', source: 'inbound-sms', tags: ['source:inbound-sms'] }),
      extract,
      body: SCAM_INBOUND_SMS,
      channel: 'sms',
      fromNumber: SCAM_FROM_NUMBER,
    })
    expect(plan.tagsToAdd).toEqual(expect.arrayContaining([QUALITY_UNVERIFIED_TAG, 'quality:signal:bulk-text']))
    expect(plan.tagsToAdd).not.toContain('audience:buyer')
    expect(plan.neighborhoodSlug).toBeNull()
    expect(plan.noteTitle.toLowerCase()).toContain('unverified')
    expect(plan.noteBody).toContain(SCAM_INBOUND_SMS)
    expect(plan.skipReason).toBe('unverified-scam')
    expect(hasUnverifiedTag(plan.tagsToAdd)).toBe(true)
  })
})

describe('industry:contact and greeting', () => {
  it('does not rename or retag an industry contact', () => {
    const extract = fallbackExtract({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' })
    const plan = planInboundEnrichment({
      person: placeholderPerson({ tags: ['source:inbound-call', 'industry:contact'] }),
      extract,
      body: ELIZE_INBOUND_SMS,
      channel: 'sms',
      fromNumber: '+19453937490',
    })
    expect(plan.setName).toBeNull()
    expect(plan.tagsToAdd).not.toContain('audience:buyer')
    expect(plan.skipReason).toBe('industry-contact')
    expect(plan.noteBody).toContain(ELIZE_INBOUND_SMS)
  })

  it('skips our own voicemail greeting so Matt is not written as the caller', () => {
    const greeting = 'Hey, this is Matt with Ryan Realty. Leave me a message.'
    expect(isOurVoicemailGreeting(greeting)).toBe(true)
    const plan = planInboundEnrichment({
      person: placeholderPerson(),
      extract: fallbackExtract({ body: greeting }),
      body: greeting,
      channel: 'voicemail',
      fromNumber: '+19453937490',
    })
    expect(plan.setName).toBeNull()
    expect(plan.skipReason).toBe('our-greeting')
    expect(plan.tagsToAdd).not.toContain('audience:buyer')
  })
})

describe('normalizeExtract / mergeExtract fail-soft', () => {
  it('accepts Claude-shaped JSON for the Elize message', () => {
    const parsed = normalizeExtract({
      first_name: 'Elize',
      last_name: 'Marais',
      intent: 'buyer',
      areas: ['Tetherow', 'Bend'],
      timing: '',
      budget: '',
      scam_likely: false,
      scam_reasons: [],
      confidence: 0.9,
    })
    expect(parsed?.firstName).toBe('Elize')
    expect(parsed?.intent).toBe('buyer')
    expect(parsed?.areas).toEqual(['Tetherow', 'Bend'])
  })

  it('returns null on garbage and lets merge fall back', () => {
    expect(normalizeExtract(null)).toBeNull()
    expect(normalizeExtract('nope')).toBeNull()
    const merged = mergeExtract(null, fallbackExtract({ body: ELIZE_INBOUND_SMS, fromNumber: '+19453937490' }))
    expect(merged.firstName).toBe('Elize')
    expect(merged.source).toBe('fallback')
  })
})

describe('extractInboundLeadFacts — Claude path, no live network', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.doUnmock('@/lib/ai/anthropic')
  })

  it('returns null when the key is missing (fail-soft)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const { extractInboundLeadFacts } = await import('@/lib/crm/inbound-message-extract')
    await expect(
      extractInboundLeadFacts({ body: ELIZE_INBOUND_SMS, channel: 'sms', fromNumber: '+19453937490' }),
    ).resolves.toBeNull()
  })

  it('parses a Claude tool_use payload for Elize', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.resetModules()
    vi.doMock('@/lib/ai/anthropic', () => ({
      CLASSIFIER_MODEL: 'claude-haiku-4-5-20251001',
      createAnthropic: () => ({
        messages: {
          create: async () => ({
            content: [
              {
                type: 'tool_use',
                input: {
                  first_name: 'Elize',
                  last_name: 'Marais',
                  intent: 'buyer',
                  areas: ['Tetherow'],
                  timing: '',
                  budget: '',
                  scam_likely: false,
                  scam_reasons: [],
                  confidence: 0.88,
                },
              },
            ],
          }),
        },
      }),
    }))
    const { extractInboundLeadFacts } = await import('@/lib/crm/inbound-message-extract')
    const got = await extractInboundLeadFacts({
      body: ELIZE_INBOUND_SMS,
      channel: 'sms',
      fromNumber: '+19453937490',
    })
    expect(got?.firstName).toBe('Elize')
    expect(got?.lastName).toBe('Marais')
    expect(got?.intent).toBe('buyer')
    expect(got?.areas).toEqual(['Tetherow'])
    expect(got?.source).toBe('model')
  })

  it('returns null when Claude throws', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.resetModules()
    vi.doMock('@/lib/ai/anthropic', () => ({
      CLASSIFIER_MODEL: 'claude-haiku-4-5-20251001',
      createAnthropic: () => ({
        messages: { create: async () => { throw new Error('api down') } },
      }),
    }))
    const { extractInboundLeadFacts } = await import('@/lib/crm/inbound-message-extract')
    await expect(
      extractInboundLeadFacts({ body: ELIZE_INBOUND_SMS, channel: 'sms' }),
    ).resolves.toBeNull()
  })
})
