import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildReplyIntentPrompt,
  classifyInboundReply,
  deterministicReplyIntent,
  sanitizeRecommendedReply,
} from './reply-intent'

/** A fetch stub that fails the test if the network is ever touched. */
function forbidNetwork() {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('network call not allowed in this test')
  }))
}

/** A fetch stub returning a canned Anthropic Messages API response. */
function stubModelResponse(json: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    json: async () => ({
      content: [{ type: 'text', text: typeof json === 'string' ? json : JSON.stringify(json) }],
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('deterministicReplyIntent (pre-pass, no model call)', () => {
  it('classifies STOP-adjacent phrasing as not_interested', () => {
    for (const body of [
      'Please remove me from your list',
      'take me off your list',
      'do not text me again',
      "don't contact me",
      'quit texting me',
      'lose my number',
      'unsubscribe',
    ]) {
      const r = deterministicReplyIntent(body)
      expect(r?.intent, body).toBe('not_interested')
      expect(r?.source).toBe('deterministic')
      expect(r?.recommendedReply).toBe('Understood, I will not text you again.')
    }
  })

  it('classifies profanity as not_interested', () => {
    const r = deterministicReplyIntent('fuck off dude')
    expect(r?.intent).toBe('not_interested')
    expect(r?.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('classifies explicit wrong-number phrasing', () => {
    const r = deterministicReplyIntent('You have the wrong number, never owned that house')
    expect(r?.intent).toBe('wrong_number')
    expect(r?.recommendedReply).toContain('remove this number')
  })

  it('classifies empty body and bare acks as other with no suggested reply', () => {
    for (const body of ['', '   ', 'ok', 'OK!', 'Thanks.', 'thank you', 'got it', 'sounds good']) {
      const r = deterministicReplyIntent(body)
      expect(r?.intent, JSON.stringify(body)).toBe('other')
      expect(r?.recommendedReply).toBe('')
    }
  })

  it('returns null for substantive replies (model decides)', () => {
    expect(deterministicReplyIntent('Yes I would love to hear what you think it could sell for')).toBeNull()
    expect(deterministicReplyIntent('Who is this and how did you get my number?')).toBeNull()
    expect(deterministicReplyIntent('Maybe in the spring, we are not ready yet')).toBeNull()
  })
})

describe('classifyInboundReply — deterministic path never touches the network', () => {
  it('resolves STOP-adjacent without fetch and without an API key', async () => {
    forbidNetwork()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const r = await classifyInboundReply({ body: 'stop texting me', context: {} })
    expect(r?.intent).toBe('not_interested')
    expect(r?.source).toBe('deterministic')
  })

  it('kill switch CRM_REPLY_INTENT_DISABLED=1 returns null even for deterministic input', async () => {
    forbidNetwork()
    vi.stubEnv('CRM_REPLY_INTENT_DISABLED', '1')
    const r = await classifyInboundReply({ body: 'stop texting me', context: {} })
    expect(r).toBeNull()
  })

  it('returns null (fail-open) when no deterministic match and no API key', async () => {
    forbidNetwork()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const r = await classifyInboundReply({ body: 'What do you think the house is worth?', context: {} })
    expect(r).toBeNull()
  })
})

describe('classifyInboundReply — model path (mocked API)', () => {
  it('parses a valid model response and scrubs banned punctuation', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = stubModelResponse({
      intent: 'interested',
      confidence: 0.87,
      recommended_reply: 'Happy to walk you through it — when is a good time for a quick call; morning or afternoon?',
    })
    const r = await classifyInboundReply({
      body: 'Sure, tell me more',
      context: { kind: 'expired', personName: 'Dana', address: '61500 Larkspur Loop' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r?.intent).toBe('interested')
    expect(r?.confidence).toBe(0.87)
    expect(r?.source).toBe('model')
    expect(r?.recommendedReply).not.toMatch(/[—–;]/)
    expect(r?.recommendedReply).toContain('when is a good time for a quick call')
  })

  it('voids a recommended reply containing a number the system did not provide (§0)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse({
      intent: 'interested',
      confidence: 0.9,
      recommended_reply: 'Homes like yours are selling around $450,000 right now.',
    })
    const r = await classifyInboundReply({ body: 'ok what could it sell for', context: { kind: 'fsbo' } })
    expect(r?.intent).toBe('interested')
    expect(r?.recommendedReply).toBe('')
  })

  it('keeps numbers the prospect themselves said', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse({
      intent: 'question',
      confidence: 0.8,
      recommended_reply: 'Yes, 61500 Larkspur Loop is the property I reached out about.',
    })
    const r = await classifyInboundReply({
      body: 'Is this about 61500 Larkspur Loop?',
      context: { kind: 'expired', address: '61500 Larkspur Loop' },
    })
    expect(r?.recommendedReply).toContain('61500 Larkspur Loop')
  })

  it('returns null on an invalid intent from the model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse({ intent: 'enthusiastic', confidence: 0.9, recommended_reply: 'x' })
    expect(await classifyInboundReply({ body: 'tell me more', context: {} })).toBeNull()
  })

  it('returns null on non-JSON output', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse('The prospect sounds interested.')
    expect(await classifyInboundReply({ body: 'tell me more', context: {} })).toBeNull()
  })

  it('returns null on a non-2xx API response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse({ intent: 'interested', confidence: 1, recommended_reply: '' }, false, 529)
    expect(await classifyInboundReply({ body: 'tell me more', context: {} })).toBeNull()
  })

  it('returns null when fetch itself throws (network error)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    expect(await classifyInboundReply({ body: 'tell me more', context: {} })).toBeNull()
  })

  it('clamps out-of-range confidence and tolerates fenced JSON', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    stubModelResponse('```json\n{"intent":"later","confidence":7,"recommended_reply":"No rush at all. I will check back in a few months."}\n```')
    const r = await classifyInboundReply({ body: 'maybe down the road', context: {} })
    expect(r?.intent).toBe('later')
    expect(r?.confidence).toBe(1)
    expect(r?.recommendedReply).toBe('No rush at all. I will check back in a few months.')
  })
})

describe('sanitizeRecommendedReply', () => {
  it('replaces em/en dashes and semicolons', () => {
    expect(sanitizeRecommendedReply('Sounds good — call me; anytime', 'Sounds good call me anytime')).toBe(
      'Sounds good , call me. anytime',
    )
  })

  it('voids replies with $ or % absent from the source text', () => {
    expect(sanitizeRecommendedReply('It could list near $500,000.', 'what is it worth')).toBe('')
    expect(sanitizeRecommendedReply('Rates dropped 1%', 'any news')).toBe('')
  })

  it('allows digit runs present in the source text', () => {
    expect(sanitizeRecommendedReply('I texted about 123 Delaware Ave.', 'yes 123 Delaware Ave')).toBe(
      'I texted about 123 Delaware Ave.',
    )
  })

  it('caps length at 300 characters', () => {
    const long = 'word '.repeat(100)
    expect(sanitizeRecommendedReply(long, long).length).toBeLessThanOrEqual(300)
  })
})

describe('buildReplyIntentPrompt (construction snapshot — no network)', () => {
  it('expired prospect with name and address', () => {
    forbidNetwork()
    expect(
      buildReplyIntentPrompt({
        body: 'Is this about the Larkspur house?',
        context: { kind: 'expired', personName: 'Dana Smith', address: '61500 Larkspur Loop' },
      }),
    ).toMatchSnapshot()
  })

  it('fsbo prospect with no name or address', () => {
    forbidNetwork()
    expect(
      buildReplyIntentPrompt({ body: 'who is this', context: { kind: 'fsbo' } }),
    ).toMatchSnapshot()
  })

  it('truncates the body at 500 characters', () => {
    const { user } = buildReplyIntentPrompt({ body: 'a'.repeat(600), context: {} })
    expect(user).toContain('a'.repeat(500))
    expect(user).not.toContain('a'.repeat(501))
  })
})
