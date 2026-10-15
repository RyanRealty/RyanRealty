import { describe, expect, it } from 'vitest'
import {
  assertSafeSarahReply,
  classifyVisitorMessage,
  detectSpanish,
  evaluateSarahTurn,
  findGuardrailViolations,
} from './guardrails'
import { buildSarahSystemPrompt, sarahGreeting } from './persona'
import {
  ARE_YOU_REAL_EN,
  COMMISSION_EN,
  CONTRACT_ADVICE_EN,
  HAS_AGENT_WRAP_EN,
  PRICE_VALUE_EN,
  RECORDING_OBJECTION_EN,
  RESPA_VENDOR_EN,
  SCHOOLS_SAFETY_EN,
  WEB_GREETING_EN,
} from './scripts'

describe('Sarah greeting', () => {
  it('web intro names Sarah as AI on the broker team and does not lead with unlicensed', () => {
    expect(WEB_GREETING_EN).toBe(
      "Hi, I'm Sarah, an AI assistant with Matt's team at Ryan Realty. I can help with pretty much anything here.",
    )
    expect(WEB_GREETING_EN).not.toMatch(/not a licensed broker/i)
    expect(sarahGreeting('web', 'Paul')).toMatch(/Paul's team at Ryan Realty/)
    expect(sarahGreeting('voice')).toMatch(/Thanks for calling Ryan Realty in Bend/)
    expect(sarahGreeting('voice')).toMatch(/not a licensed broker/)
  })
})

describe('evaluateSarahTurn refusals', () => {
  it.each([
    ['What do you think it is worth?', 'price-opinion', PRICE_VALUE_EN],
    ['Is it priced right?', 'price-opinion', PRICE_VALUE_EN],
    ['Would they take less?', 'good-deal', null],
    ['Are the schools good?', 'fair-housing-schools-safety', SCHOOLS_SAFETY_EN],
    ['Is it a safe neighborhood?', 'fair-housing-schools-safety', SCHOOLS_SAFETY_EN],
    ['What kind of people live there?', 'fair-housing-demographics', null],
    ['Are you a real person?', 'human-check', ARE_YOU_REAL_EN],
    ['What is your commission?', 'commission', COMMISSION_EN],
    ["Who's a good lender?", 'vendor', RESPA_VENDOR_EN],
    ['I want to make an offer.', 'make-offer', null],
    ['Can you explain the contract?', 'contract-advice', CONTRACT_ADVICE_EN],
  ] as const)('refuses %s', (text, topic, reply) => {
    const turn = evaluateSarahTurn({ visitorText: text, greeted: true })
    expect(turn.mode).toBe('refuse')
    expect(turn.topic).toBe(topic)
    expect(turn.reply).toBeTruthy()
    if (reply) expect(turn.reply).toBe(reply)
    expect(assertSafeSarahReply(turn.reply ?? '')).toBe(true)
  })

  it('wraps up when they already have an agent and tags the CRM', () => {
    const turn = evaluateSarahTurn({ visitorText: 'I already have an agent', greeted: true })
    expect(turn.mode).toBe('wrap-has-agent')
    expect(turn.reply).toBe(HAS_AGENT_WRAP_EN)
    expect(turn.crmTags).toContain('has agent')
  })

  it('stops on a recording objection', () => {
    const turn = evaluateSarahTurn({ visitorText: "I don't want this recorded", greeted: false })
    expect(turn.mode).toBe('stop-recording')
    expect(turn.reply).toBe(RECORDING_OBJECTION_EN)
  })

  it('escalates lockout and legal-threat language', () => {
    expect(evaluateSarahTurn({ visitorText: 'We are closing today and the deal is falling apart', greeted: true }).mode).toBe(
      'escalate',
    )
    expect(evaluateSarahTurn({ visitorText: 'I am locked out of the house', greeted: true }).mode).toBe('escalate')
  })
})

describe('Spanish bridge', () => {
  it('detects Spanish and asks the bridge once', () => {
    expect(detectSpanish('Hola, ¿cuánto cuesta la casa?')).toBe(true)
    const turn = evaluateSarahTurn({ visitorText: 'Hola, quiero vender', greeted: true })
    expect(turn.lang).toBe('es')
    expect(turn.spanishBridge).toBe(true)
  })

  it('does not treat an English listing question as Spanish', () => {
    expect(detectSpanish('How many bedrooms does the listing show?')).toBe(false)
  })
})

describe('Sarah output filter', () => {
  it('flags steering and licensure claims', () => {
    expect(findGuardrailViolations('This is a safe neighborhood with good schools.')).toEqual(
      expect.arrayContaining(['safe', 'good-schools']),
    )
    expect(findGuardrailViolations("I'm an agent and I represent you.")).toContain('claim-agent')
    expect(findGuardrailViolations(RESPA_VENDOR_EN)).toEqual([])
    expect(findGuardrailViolations(SCHOOLS_SAFETY_EN)).toEqual([])
  })
})

describe('system prompt', () => {
  it('does not run a qualification interview', () => {
    const prompt = buildSarahSystemPrompt({ channel: 'web' })
    expect(prompt).not.toMatch(/pre-approved/i)
    expect(prompt).not.toMatch(/proof of funds/i)
    expect(prompt).toMatch(/do not interview budget, financing, or timeline/)
    expect(prompt).toMatch(/short intent flow may ask area, budget, and timeline/)
    expect(prompt).toMatch(/not a licensed broker|unlicensed/i)
    expect(prompt).toMatch(/Are there a couple of times/)
    expect(prompt).toMatch(/YOU MAY NOT[\s\S]*Auto-book Matt's calendar/)
  })

  it('uses the short web intro and holds unlicensed status for price, contract, or advice', () => {
    const prompt = buildSarahSystemPrompt({ channel: 'web', brokerFirstName: 'Rebecca' })
    expect(prompt).toMatch(/Hi, I'm Sarah, an AI assistant with Rebecca's team at Ryan Realty/)
    expect(prompt).toMatch(/Chats are saved so our team can follow up/)
    expect(prompt).toMatch(/Do not say "not a licensed broker" in the web intro/)
    expect(prompt).toMatch(/only when they ask about price, value, a contract, or advice/)
    const voice = buildSarahSystemPrompt({ channel: 'voice' })
    expect(voice).toMatch(/Thanks for calling Ryan Realty in Bend/)
    expect(voice).toMatch(/not a person and not a licensed broker/)
    expect(prompt).toMatch(/Let me try and find out/)
    expect(prompt).toMatch(/lookup_public_records/)
    expect(prompt).toMatch(/Never give a legal or zoning determination/)
  })
})

describe('classifyVisitorMessage', () => {
  it('returns other for a normal listing question', () => {
    expect(classifyVisitorMessage('How many square feet does the listing show?')).toContain('other')
  })

  it('lets a home-worth chip continue into the qualifying flow instead of the price-opinion refuse', () => {
    const turn = evaluateSarahTurn({ visitorText: "What's my home worth?", greeted: true })
    expect(turn.mode).toBe('continue')
    expect(turn.topic).toBe('cma-value')
    expect(turn.reply).toBeNull()
  })
})
