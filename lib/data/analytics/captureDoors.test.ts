import { describe, it, expect } from 'vitest'
import {
  classifyCaptureDoor,
  doorForPerson,
  personAppearsInAudience,
  sessionAppearsInAudience,
  isDoorOnFunnelBoard,
  doorIsImmediateWorking,
  isAttributableDoorSource,
} from './captureDoors'
import { isAttributableLead } from '@/lib/data/crm/leadSourceTaxonomy'

describe('classifyCaptureDoor', () => {
  const cases: Array<[string, string]> = [
    ['home-valuation', 'home-valuation'],
    ['home_valuation_cta', 'home-valuation'],
    ['cma-request', 'home-valuation'],
    ['seller-lp', 'seller-lp'],
    ['seller_lp', 'seller-lp'],
    ['tetherow_heath_cma', 'seller-lp'],
    ['buyer-lp', 'buyer-lp'],
    ['expired-lp', 'expired-lp'],
    ['fsbo-lp', 'fsbo-lp'],
    ['contact-form', 'contact-form'],
    ['idx-registration', 'listing-alert'],
    ['Open House', 'open-house'],
    ['meta-lead-form', 'meta-lead'],
    ['Facebook Lead Ad', 'meta-lead'],
    ['Inbound Call', 'inbound-call'],
    ['inbound-call', 'inbound-call'],
    ['Sign Call', 'inbound-call'],
    ['Inbound Text', 'inbound-sms'],
    ['Zillow', 'portal-zillow'],
    ['Realtor.com', 'portal-realtor'],
    ['agent-referral', 'agent-referral'],
    ['Word of Mouth', 'agent-referral'],
    ['newsletter', 'newsletter'],
    ['exit_intent_popup', 'exit-intent'],
    ['rental-calculator', 'rental-calculator'],
    ['homepage-cta', 'page-cta'],
    ['Manual Entry', 'manual'],
    ['Website', 'website-other'],
    ['Google', 'website-other'],
    ['Farm', 'outreach'],
    ['Expired Listing', 'outreach'],
    ['expired-listing-cron', 'outreach'],
    ['FSBO', 'outreach'],
    ['Import', 'outreach'],
    ['Sphere', 'outreach'],
    ['join-the-team', 'join-team'],
  ]

  it.each(cases)('%s → %s', (source, doorId) => {
    expect(classifyCaptureDoor(source).id).toBe(doorId)
  })

  it('empty source is unspecified', () => {
    expect(classifyCaptureDoor(null).id).toBe('unspecified')
    expect(classifyCaptureDoor('').id).toBe('unspecified')
  })

  it('outreach doors stay off the funnel board', () => {
    expect(isDoorOnFunnelBoard(classifyCaptureDoor('Farm'))).toBe(false)
    expect(isDoorOnFunnelBoard(classifyCaptureDoor('contact-form'))).toBe(true)
  })

  it('phone doors are immediate working', () => {
    expect(doorIsImmediateWorking(classifyCaptureDoor('inbound-call'))).toBe(true)
    expect(doorIsImmediateWorking(classifyCaptureDoor('Inbound Text'))).toBe(true)
    expect(doorIsImmediateWorking(classifyCaptureDoor('seller-lp'))).toBe(false)
  })

  it('maps a tagged join inquiry onto the recruit door', () => {
    expect(doorForPerson('contact-form', ['recruit:join']).id).toBe('join-team')
    expect(doorForPerson('home-valuation', []).id).toBe('home-valuation')
  })
})

describe('personAppearsInAudience', () => {
  it('seller tag wins over a buyer door', () => {
    expect(personAppearsInAudience(['audience:seller'], 'buyer-lp', 'seller')).toBe(true)
    expect(personAppearsInAudience(['audience:seller'], 'buyer-lp', 'buyer')).toBe(false)
  })

  it('buyer tag wins over a seller door', () => {
    expect(personAppearsInAudience(['audience:buyer'], 'home-valuation', 'buyer')).toBe(true)
    expect(personAppearsInAudience(['audience:buyer'], 'home-valuation', 'seller')).toBe(false)
  })

  it('untagged valuation is seller', () => {
    expect(personAppearsInAudience([], 'home-valuation', 'seller')).toBe(true)
    expect(personAppearsInAudience([], 'home-valuation', 'buyer')).toBe(false)
  })

  it('untagged contact form appears on both seller and buyer', () => {
    expect(personAppearsInAudience([], 'contact-form', 'seller')).toBe(true)
    expect(personAppearsInAudience([], 'contact-form', 'buyer')).toBe(true)
    expect(personAppearsInAudience([], 'contact-form', 'recruit')).toBe(false)
  })

  it('recruit door is recruit only', () => {
    expect(personAppearsInAudience([], 'join-the-team', 'recruit')).toBe(true)
    expect(personAppearsInAudience([], 'join-the-team', 'seller')).toBe(false)
  })

  it('recruit:join on a contact form is a recruit, not a consumer', () => {
    expect(personAppearsInAudience(['recruit:join'], 'contact-form', 'recruit')).toBe(true)
    expect(personAppearsInAudience(['recruit:join'], 'contact-form', 'seller')).toBe(false)
    expect(personAppearsInAudience(['recruit:join'], 'contact-form', 'buyer')).toBe(false)
  })

  it('both audience tags appear on both toggles', () => {
    const tags = ['audience:seller', 'audience:buyer']
    expect(personAppearsInAudience(tags, 'contact-form', 'seller')).toBe(true)
    expect(personAppearsInAudience(tags, 'contact-form', 'buyer')).toBe(true)
  })
})

describe('sessionAppearsInAudience', () => {
  it('requires the matching intent tag', () => {
    expect(sessionAppearsInAudience(['seller_intent'], 'seller')).toBe(true)
    expect(sessionAppearsInAudience(['buyer_intent'], 'seller')).toBe(false)
    expect(sessionAppearsInAudience(['seller_intent', 'buyer_intent'], 'seller')).toBe(true)
    expect(sessionAppearsInAudience(['seller_intent', 'buyer_intent'], 'buyer')).toBe(true)
    expect(sessionAppearsInAudience([], 'seller')).toBe(false)
  })

  it('recruit uses the landing path', () => {
    expect(sessionAppearsInAudience([], 'recruit', '/join')).toBe(true)
    expect(sessionAppearsInAudience(['seller_intent'], 'recruit', '/sell')).toBe(false)
  })
})

describe('attributable alignment with leadSourceTaxonomy', () => {
  it('keeps Farm/Import off the lead spine', () => {
    expect(isAttributableLead('Farm')).toBe(false)
    expect(isAttributableDoorSource('Farm')).toBe(false)
    expect(isAttributableLead('contact-form')).toBe(true)
    expect(isAttributableDoorSource('contact-form')).toBe(true)
  })
})
