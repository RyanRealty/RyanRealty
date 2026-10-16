import { describe, expect, it } from 'vitest'
import { sarahConsentAsk } from './lead-consent'
import {
  SARAH_INTENT_CHIPS,
  SARAH_STAGE_BY_INTENT,
  WEB_BRINGS_YOU_HERE_EN,
  afterHelpfulAnswer,
  applyIntentTurn,
  decideSarahStage,
  initialFlow,
  matchIntentChip,
  parseContactBits,
  sarahCaptureTags,
  sarahEventType,
  sarahOriginNote,
} from './intent-flow'

describe('Sarah intent chips', () => {
  it('has Matt chips in order', () => {
    expect(SARAH_INTENT_CHIPS.map((c) => c.label)).toEqual([
      'Find a home',
      'Selling',
      "What's my home worth?",
      'How you buy or sell',
      'The market',
    ])
  })

  it('matches chip labels and close paraphrases', () => {
    expect(matchIntentChip('Find a home')).toBe('buyer')
    expect(matchIntentChip('Selling')).toBe('seller')
    expect(matchIntentChip("What's my home worth?")).toBe('home-worth')
    expect(matchIntentChip('How you buy or sell')).toBe('how')
    expect(matchIntentChip('The market')).toBe('market')
    expect(matchIntentChip('looking for a home in Bend')).toBe('buyer')
  })
})

describe('Sarah discovery then funnel', () => {
  it('opens with the exact Matt line', () => {
    expect(WEB_BRINGS_YOU_HERE_EN).toBe(
      "Hi, I'm Sarah. I work with Matt and his team at Ryan Realty. How can I help you today?",
    )
    expect(WEB_BRINGS_YOU_HERE_EN).not.toMatch(/AI assistant/i)
    expect(WEB_BRINGS_YOU_HERE_EN).not.toMatch(/\u2014/)
  })

  it('runs find-a-home discovery, then name, favor offer, and consent', () => {
    let state = initialFlow()
    const intent = applyIntentTurn(state, 'Find a home', 'Paul')
    expect(intent.funnel).toBe('intent')
    expect(intent.reply).toMatch(/hoping to find/)
    state = intent.next
    state = applyIntentTurn(state, 'Bend', 'Paul').next
    const help = applyIntentTurn(state, 'yes, help looking', 'Paul')
    expect(help.reply).toMatch(/good name/)
    const named = applyIntentTurn(help.next, 'Alex Rivera', 'Paul')
    expect(named.funnel).toBe('name')
    expect(named.reply).toMatch(/send a few that fit/)
    const contact = applyIntentTurn(named.next, '5415550100', 'Paul')
    expect(contact.capture).toBe(true)
    expect(contact.funnel).toBe('contact')
    expect(contact.askConsent).toBe(true)
    expect(contact.reply).toBe(sarahConsentAsk('5415550100'))
    const yes = applyIntentTurn(contact.next, 'Yes', 'Paul', 'typed')
    expect(yes.funnel).toBe('consent')
    expect(yes.next.answers.marketingConsent).toBe(true)
    expect(yes.next.answers).toMatchObject({
      area: 'Bend',
      helpFinding: 'yes, help looking',
      name: 'Alex Rivera',
      phone: '5415550100',
    })
  })

  it('does not treat a spoken yes as marketing consent', () => {
    let state = initialFlow()
    state = applyIntentTurn(state, 'Selling', 'Matt').next
    state = applyIntentTurn(state, '123 Main St Bend', 'Matt').next
    state = applyIntentTurn(state, 'Sam', 'Matt').next
    const contact = applyIntentTurn(state, '5415550100', 'Matt')
    const spoken = applyIntentTurn(contact.next, 'Yes', 'Matt', 'spoken')
    expect(spoken.next.answers.consentGranted).toBe(true)
    expect(spoken.next.answers.marketingConsent).toBe(false)
  })

  it('never re-asks a known name or contact, and retries a skip once', () => {
    let state = initialFlow()
    state = applyIntentTurn(state, 'The market', 'Matt').next
    state = applyIntentTurn(state, 'Bend', 'Matt').next
    const skip1 = applyIntentTurn(state, 'skip', 'Matt')
    expect(skip1.reply).toMatch(/first name/)
    const skip2 = applyIntentTurn(skip1.next, 'no thanks', 'Matt')
    expect(skip2.reply).toMatch(/email or phone/)
    const skip3 = applyIntentTurn(skip2.next, 'not now', 'Matt')
    expect(skip3.reply).toMatch(/email is enough/)
    const drop = applyIntentTurn(skip3.next, 'no', 'Matt')
    expect(drop.reply).toMatch(/I'm here if you want/)
    expect(drop.capture).toBe(false)
  })

  it('auto-captures a typed phone on the name turn', () => {
    let state = initialFlow()
    state = applyIntentTurn(state, 'Find a home', 'Matt').next
    state = applyIntentTurn(state, 'Sisters', 'Matt').next
    state = applyIntentTurn(state, 'just browsing', 'Matt').next
    const mixed = applyIntentTurn(state, 'Jo 541-555-0100', 'Matt')
    expect(mixed.capture).toBe(true)
    expect(mixed.next.answers.phone).toBe('5415550100')
    expect(mixed.next.answers.name).toBe('Jo')
    expect(mixed.askConsent).toBe(true)
  })

  it('asks name after a helpful page answer', () => {
    const turn = afterHelpfulAnswer(initialFlow(), 'Rebecca')
    expect(turn?.reply).toMatch(/good name/)
    expect(turn?.next.step).toBe('name')
  })

  it('does not use pressure language', () => {
    const replies: string[] = []
    let state = initialFlow()
    for (const text of ['Find a home', 'Sisters', 'just looking', 'Jo', 'jo@x.com']) {
      const turn = applyIntentTurn(state, text, 'Matt')
      replies.push(turn.reply)
      state = turn.next
    }
    expect(replies.join(' ')).not.toMatch(/act now|don't miss|hurry|limited time|won't last/i)
  })
})

describe('Sarah CRM capture contract', () => {
  it('uses existing stages only and never downgrades', () => {
    expect(SARAH_STAGE_BY_INTENT.buyer).toBe('Lead')
    expect(SARAH_STAGE_BY_INTENT.seller).toBe('Seller Prospect')
    expect(SARAH_STAGE_BY_INTENT['home-worth']).toBe('Seller Prospect')
    expect(SARAH_STAGE_BY_INTENT.how).toBe('Lead')
    expect(SARAH_STAGE_BY_INTENT.market).toBe('Lead')
    expect(decideSarahStage(null, 'Lead')).toBe('Lead')
    expect(decideSarahStage('Lead', 'Seller Prospect')).toBe('Seller Prospect')
    expect(decideSarahStage('Active Client', 'Lead')).toBeNull()
  })

  it('tags and event types stay on existing CRM vocab', () => {
    expect(sarahEventType('buyer')).toBe('Property Search')
    expect(sarahEventType('how')).toBe('General Inquiry')
    expect(sarahCaptureTags('buyer')).toEqual([
      'source:sarah-chat',
      'captured:by-sarah',
      'sarah:intent-buyer',
      'audience:buyer',
    ])
    const note = sarahOriginNote({
      intent: 'seller',
      answers: { address: '1 Pine', question: 'timing', cmaWanted: true },
      brokerFirstName: 'Paul',
    })
    expect(note.body).toMatch(/Paul/)
    expect(note.body).toMatch(/Draft CMA requested/)
  })

  it('parses email or phone from a contact turn', () => {
    expect(parseContactBits('you can email me at Pat.Lee@Ryan-Realty.com')).toEqual({
      email: 'pat.lee@ryan-realty.com',
      phone: null,
    })
    expect(parseContactBits('541-703-3095')).toEqual({ email: null, phone: '5417033095' })
  })
})
