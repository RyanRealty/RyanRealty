import { describe, expect, it } from 'vitest'
import {
  SARAH_INTENT_CHIPS,
  SARAH_STAGE_BY_INTENT,
  WEB_BRINGS_YOU_HERE_EN,
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
  it('has the four Matt chips in order', () => {
    expect(SARAH_INTENT_CHIPS.map((c) => c.label)).toEqual([
      "I'm looking for a home",
      "I'm thinking of selling",
      "What's my home worth?",
      'I have a question',
    ])
  })

  it('matches chip labels and close paraphrases', () => {
    expect(matchIntentChip("I'm looking for a home")).toBe('buyer')
    expect(matchIntentChip("I'm thinking of selling")).toBe('seller')
    expect(matchIntentChip("What's my home worth?")).toBe('home-worth')
    expect(matchIntentChip('I have a question')).toBe('question')
    expect(matchIntentChip('looking for a home in Bend')).toBe('buyer')
    expect(matchIntentChip('Hi I would like to look at homes here')).toBe('buyer')
  })
})

describe('Sarah buyer phrase from live test', () => {
  it('starts the buyer flow for Hi I would like to look at homes here', () => {
    const turn = applyIntentTurn(initialFlow(), 'Hi I would like to look at homes here', 'Matt')
    expect(turn.next.intent).toBe('buyer')
    expect(turn.next.step).toBe('area')
    expect(turn.reply).toMatch(/Which area/)
    expect(turn.reply).not.toMatch(/listing shows/)
    expect(turn.reply).not.toMatch(/I can share what the listing shows/)
  })
})

describe('Sarah qualifying flows', () => {
  it('opens by asking what brings them here', () => {
    expect(WEB_BRINGS_YOU_HERE_EN).toBe('What brings you here today?')
    expect(WEB_BRINGS_YOU_HERE_EN).not.toMatch(/\u2014/)
  })

  it('runs the buyer flow then captures name and contact', () => {
    let state = initialFlow()
    const buyer = applyIntentTurn(state, "I'm looking for a home", 'Paul')
    expect(buyer.reply).toMatch(/Which area/)
    state = buyer.next
    state = applyIntentTurn(state, 'Bend', 'Paul').next
    state = applyIntentTurn(state, 'around 700k', 'Paul').next
    state = applyIntentTurn(state, 'this year', 'Paul').next
    const name = applyIntentTurn(state, 'Alex Rivera', 'Paul')
    expect(name.reply).toMatch(/email or phone/)
    const contact = applyIntentTurn(name.next, 'alex@example.com', 'Paul')
    expect(contact.capture).toBe(true)
    expect(contact.startCma).toBe(false)
    expect(contact.next.answers).toMatchObject({
      area: 'Bend',
      budget: 'around 700k',
      timeline: 'this year',
      name: 'Alex Rivera',
      email: 'alex@example.com',
    })
    expect(contact.chips?.map((c) => c.label)).toEqual(['Call', 'Text', 'Email', 'No thanks'])
  })

  it('offers a draft CMA on seller and home-worth, never a value', () => {
    let seller = applyIntentTurn(initialFlow(), "I'm thinking of selling", 'Matt')
    seller = applyIntentTurn(seller.next, '123 Main St Bend', 'Matt')
    seller = applyIntentTurn(seller.next, 'next spring', 'Matt')
    expect(seller.reply).toMatch(/draft home value review/)
    expect(seller.reply).not.toMatch(/\$[\d,]+/)
    const yes = applyIntentTurn(seller.next, 'Yes, start a review', 'Matt')
    const named = applyIntentTurn(yes.next, 'Sam', 'Matt')
    const saved = applyIntentTurn(named.next, '5415550100', 'Matt')
    expect(saved.capture).toBe(true)
    expect(saved.startCma).toBe(true)
    expect(saved.reply).toMatch(/started a draft review/)
    expect(saved.reply).not.toMatch(/worth \$/)

    let worth = applyIntentTurn(initialFlow(), "What's my home worth?", 'Rebecca')
    expect(worth.reply).toMatch(/don't give values myself/)
    worth = applyIntentTurn(worth.next, '8 NW Awbrey Rd', 'Rebecca')
    expect(worth.reply).toMatch(/Won't quote a number myself|won't quote a number myself/)
  })

  it('does not use pressure language', () => {
    const replies: string[] = []
    let state = initialFlow()
    for (const text of ["I'm looking for a home", 'Sisters', 'not sure', 'just looking', 'Jo', 'jo@x.com']) {
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
    expect(decideSarahStage(null, 'Lead')).toBe('Lead')
    expect(decideSarahStage('Lead', 'Seller Prospect')).toBe('Seller Prospect')
    expect(decideSarahStage('Active Client', 'Lead')).toBeNull()
    expect(decideSarahStage('Seller Prospect', 'Lead')).toBeNull()
    expect(decideSarahStage('Nurture', 'Lead')).toBeNull()
    expect(decideSarahStage('Lead', 'Not A Stage')).toBeNull()
  })

  it('tags and event types stay on existing CRM vocab', () => {
    expect(sarahEventType('buyer')).toBe('Property Search')
    expect(sarahEventType('seller')).toBe('Seller Inquiry')
    expect(sarahEventType('home-worth')).toBe('Seller Inquiry')
    expect(sarahEventType('question')).toBe('General Inquiry')
    expect(sarahCaptureTags('buyer')).toEqual([
      'source:sarah-chat',
      'captured:by-sarah',
      'sarah:intent-buyer',
      'audience:buyer',
    ])
    const note = sarahOriginNote({
      intent: 'seller',
      answers: { address: '1 Pine', timeline: 'soon', cmaWanted: true },
      brokerFirstName: 'Paul',
    })
    expect(note.title).toBe('Captured by Sarah')
    expect(note.body).toMatch(/Captured by Sarah/)
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
