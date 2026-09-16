import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetCursorCliPresentCacheForTests,
  grokTransportFromEnv,
  resolveGrokTransport,
  runWithGrokTransport,
  runWithGrokTransportAsync,
} from './transport'
import { grokConfigured } from './client'

describe('grok transport', () => {
  const priorTransport = process.env.GROK_TRANSPORT
  const priorXai = process.env.XAI_API_KEY

  afterEach(() => {
    if (priorTransport === undefined) delete process.env.GROK_TRANSPORT
    else process.env.GROK_TRANSPORT = priorTransport
    if (priorXai === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = priorXai
    _resetCursorCliPresentCacheForTests()
  })

  it('defaults to xai when env unset', () => {
    delete process.env.GROK_TRANSPORT
    expect(grokTransportFromEnv()).toBe('xai')
    expect(resolveGrokTransport()).toBe('xai')
  })

  it('ALS override wins over env', async () => {
    process.env.GROK_TRANSPORT = 'xai'
    expect(resolveGrokTransport()).toBe('xai')
    await runWithGrokTransportAsync('cursor', async () => {
      expect(resolveGrokTransport()).toBe('cursor')
    })
    expect(resolveGrokTransport()).toBe('xai')
  })

  it('runWithGrokTransport sync nests', () => {
    process.env.GROK_TRANSPORT = 'xai'
    runWithGrokTransport('cursor', () => {
      expect(resolveGrokTransport()).toBe('cursor')
    })
    expect(resolveGrokTransport()).toBe('xai')
  })

  it('grokConfigured on xai transport follows XAI_API_KEY', () => {
    delete process.env.GROK_TRANSPORT
    delete process.env.XAI_API_KEY
    expect(grokConfigured()).toBe(false)
    process.env.XAI_API_KEY = 'xai-test'
    expect(grokConfigured()).toBe(true)
  })
})
