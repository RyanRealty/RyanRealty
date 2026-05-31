import { describe, it, expect } from 'vitest'
import { classifyAiReferrer, isAiReferrer } from './ai-referrers'

describe('classifyAiReferrer', () => {
  it('classifies bare hosts', () => {
    expect(classifyAiReferrer('chatgpt.com')).toBe('ChatGPT')
    expect(classifyAiReferrer('perplexity.ai')).toBe('Perplexity')
    expect(classifyAiReferrer('gemini.google.com')).toBe('Gemini')
    expect(classifyAiReferrer('claude.ai')).toBe('Claude')
  })

  it('classifies GA4 source/medium strings', () => {
    expect(classifyAiReferrer('chatgpt.com / referral')).toBe('ChatGPT')
    expect(classifyAiReferrer('perplexity.ai / referral')).toBe('Perplexity')
    expect(classifyAiReferrer('copilot.microsoft.com / referral')).toBe('Copilot')
  })

  it('strips www and matches subdomains', () => {
    expect(classifyAiReferrer('www.perplexity.ai')).toBe('Perplexity')
    expect(classifyAiReferrer('chat.openai.com / referral')).toBe('ChatGPT')
  })

  it('is case-insensitive', () => {
    expect(classifyAiReferrer('ChatGPT.com / Referral')).toBe('ChatGPT')
  })

  it('does NOT classify plain search or social as AI', () => {
    expect(classifyAiReferrer('google / organic')).toBeNull()
    expect(classifyAiReferrer('google / cpc')).toBeNull()
    expect(classifyAiReferrer('bing / organic')).toBeNull()
    expect(classifyAiReferrer('m.facebook.com / referral')).toBeNull()
    expect(classifyAiReferrer('(direct) / (none)')).toBeNull()
    expect(classifyAiReferrer('l.instagram.com / referral')).toBeNull()
  })

  it('is host-boundary safe (no naive substring match)', () => {
    expect(classifyAiReferrer('notchatgpt.com.evil.test / referral')).toBeNull()
    expect(classifyAiReferrer('fake-you.com.example / referral')).toBeNull()
  })

  it('handles null/empty', () => {
    expect(classifyAiReferrer(null)).toBeNull()
    expect(classifyAiReferrer(undefined)).toBeNull()
    expect(classifyAiReferrer('')).toBeNull()
  })

  it('isAiReferrer mirrors classify', () => {
    expect(isAiReferrer('chatgpt.com / referral')).toBe(true)
    expect(isAiReferrer('google / organic')).toBe(false)
  })
})
