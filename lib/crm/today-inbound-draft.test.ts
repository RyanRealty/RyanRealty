import { describe, expect, it } from 'vitest'
import {
  composeTodayInboundDraft,
  todayInboundYesEnabled,
  type TodayInboundDraftInput,
} from './today-inbound-draft'

function draft(partial: Partial<TodayInboundDraftInput> & Pick<TodayInboundDraftInput, 'intent'>): string {
  return composeTodayInboundDraft({
    inboundBody: partial.inboundBody ?? 'Yes, tell me more',
    inboundChannel: partial.inboundChannel ?? 'sms',
    intent: partial.intent,
    whoLabels: partial.whoLabels ?? [],
    nextStep: partial.nextStep ?? 'Reply. They are interested.',
    recommendedReply: partial.recommendedReply,
    personName: partial.personName ?? 'Dana',
    address: partial.address,
  })
}

describe('composeTodayInboundDraft', () => {
  it('uses a classified recommendedReply when it sanitizes clean', () => {
    expect(
      draft({
        intent: 'interested',
        inboundBody: 'Sure, tell me more',
        recommendedReply: 'Happy to walk you through it. When is a good time for a quick call?',
      }),
    ).toBe('Happy to walk you through it. When is a good time for a quick call?')
  })

  it('writes a short interested SMS and flavors seller who-labels', () => {
    expect(draft({ intent: 'interested', whoLabels: [] })).toBe(
      'Thanks for writing back. When is a good time to talk?',
    )
    expect(draft({ intent: 'interested', whoLabels: ['Expired listing'] })).toBe(
      'Thanks for writing back. Happy to talk about the house.',
    )
    expect(draft({ intent: 'interested', whoLabels: ['Buyer'] })).toBe(
      'Thanks for writing back. Happy to help you look.',
    )
  })

  it('writes a short question SMS without answering the question', () => {
    expect(
      draft({
        intent: 'question',
        inboundBody: 'How did you get my number?',
        nextStep: 'Reply. They asked a question.',
      }),
    ).toBe('Happy to answer that. When works for a quick call?')
  })

  it('uses the locked not_interested close', () => {
    expect(
      draft({
        intent: 'not_interested',
        inboundBody: 'Please remove me from your list',
        nextStep: 'Stop outreach. They are not interested.',
      }),
    ).toBe('Understood, I will not text you again.')
  })

  it('uses the locked wrong_number close', () => {
    expect(
      draft({
        intent: 'wrong_number',
        inboundBody: 'You have the wrong number',
        nextStep: 'Remove this number.',
      }),
    ).toBe('Apologies for the mix-up. I will remove this number from my list.')
  })

  it('returns empty for other, empty body, and empty classified suggestion', () => {
    expect(draft({ intent: 'other', inboundBody: 'ok', recommendedReply: '' })).toBe('')
    expect(draft({ intent: null, inboundBody: '' })).toBe('')
    expect(draft({ intent: 'other', inboundBody: '   ' })).toBe('')
  })

  it('voids a classified reply that invents a number, then falls back', () => {
    expect(
      draft({
        intent: 'interested',
        inboundBody: 'ok what could it sell for',
        recommendedReply: 'Homes like yours are selling around $450,000 right now.',
        whoLabels: ['Seller'],
      }),
    ).toBe('Thanks for writing back. Happy to talk about the house.')
  })

  it('voids a classified reply that invents a number when fallback is also empty', () => {
    expect(
      draft({
        intent: 'other',
        inboundBody: 'ok',
        recommendedReply: 'I can do 3 percent off if you list this week.',
      }),
    ).toBe('')
  })

  it('never ships a worth-question CTA', () => {
    expect(
      draft({
        intent: 'question',
        inboundBody: 'curious about value',
        recommendedReply: "What's my home worth? I can send a packet.",
      }),
    ).toBe('Happy to answer that. When works for a quick call?')
    expect(
      draft({
        intent: 'other',
        inboundBody: 'hi',
        recommendedReply: 'What is your home worth right now?',
      }),
    ).toBe('')
  })

  it('strips exclamation marks and does not emit banned punctuation', () => {
    const out = draft({
      intent: 'interested',
      inboundBody: 'Yes',
      recommendedReply: 'Thanks for writing back! When is a good time to talk?',
    })
    expect(out).toBe('Thanks for writing back. When is a good time to talk?')
    expect(out).not.toMatch(/[—–;!]/)
  })

  it('does not invent a later timeline', () => {
    expect(
      draft({
        intent: 'later',
        inboundBody: 'maybe down the road',
        nextStep: 'Follow up later.',
      }),
    ).toBe('No rush. I will check back later.')
    expect(draft({ intent: 'later', inboundBody: 'maybe down the road' })).not.toMatch(
      /month|week|spring|2026/i,
    )
  })

  it('infers not_interested from the inbound body when intent is missing', () => {
    expect(
      composeTodayInboundDraft({
        inboundBody: 'do not text me again',
        inboundChannel: 'sms',
        intent: null,
        whoLabels: [],
        nextStep: 'Reply to their text.',
      }),
    ).toBe('Understood, I will not text you again.')
  })
})

describe('todayInboundYesEnabled', () => {
  it('is SMS-only on reply rows with a draft', () => {
    expect(
      todayInboundYesEnabled({ kind: 'reply', inboundChannel: 'sms', draftSms: 'Thanks for writing back.' }),
    ).toBe(true)
    expect(
      todayInboundYesEnabled({ kind: 'reply', inboundChannel: 'email', draftSms: 'Thanks for writing back.' }),
    ).toBe(false)
    expect(todayInboundYesEnabled({ kind: 'reply', inboundChannel: 'sms', draftSms: '' })).toBe(false)
    expect(todayInboundYesEnabled({ kind: 'reply', inboundChannel: 'sms', draftSms: '   ' })).toBe(false)
    expect(
      todayInboundYesEnabled({ kind: 'task', inboundChannel: 'sms', draftSms: 'Thanks for writing back.' }),
    ).toBe(false)
  })
})
