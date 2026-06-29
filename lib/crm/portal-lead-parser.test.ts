import { describe, it, expect } from 'vitest'
import { detectPortal, parsePortalLead } from './portal-lead-parser'

describe('detectPortal', () => {
  it('identifies Zillow lead senders', () => {
    expect(detectPortal('Zillow Premier Agent <premieragent@zillow.com>')).toBe('zillow')
    expect(detectPortal('no-reply@mail.zillowgroup.com')).toBe('zillow')
  })
  it('identifies Realtor.com lead senders', () => {
    expect(detectPortal('realtor.com <leads@leads.realtor.com>')).toBe('realtor.com')
    expect(detectPortal('ConnectionsPlus <noreply@move.com>')).toBe('realtor.com')
  })
  it('ignores consumer-marketing blasts', () => {
    expect(detectPortal('Zillow <zmail@zmail.zillow.com>')).toBeNull()
    expect(detectPortal('realtor.com <LearnMore@news.realtor.com>')).toBeNull()
  })
  it('returns null for non-portal senders', () => {
    expect(detectPortal('jane@gmail.com')).toBeNull()
    expect(detectPortal('')).toBeNull()
  })
})

describe('parsePortalLead', () => {
  it('parses a standard Zillow Premier Agent lead', () => {
    const r = parsePortalLead({
      from: 'Zillow Premier Agent <premieragent@zillow.com>',
      replyTo: 'Jane Buyer <jane.buyer@gmail.com>',
      subject: 'New contact: Jane Buyer',
      body: [
        'You have a new contact from Zillow.',
        'Name: Jane Buyer',
        'Phone: (541) 555-0182',
        'Email: jane.buyer@gmail.com',
        'Property: 63091 Desert Sage St, Bend, OR 97701',
        'Message: Is this still available? I would love a tour this weekend.',
      ].join('\n'),
    })
    expect(r).not.toBeNull()
    expect(r!.portal).toBe('zillow')
    expect(r!.name).toBe('Jane Buyer')
    expect(r!.email).toBe('jane.buyer@gmail.com')
    expect(r!.phone).toBe('5415550182')
    expect(r!.property).toContain('Desert Sage')
    expect(r!.message).toContain('still available')
  })

  it('parses a Realtor.com lead and ignores the portal-owned email', () => {
    const r = parsePortalLead({
      from: 'realtor.com <leads@leads.realtor.com>',
      subject: 'New lead: John Seller',
      body: [
        'A new lead is interested in selling.',
        'John Seller',
        'john.seller@yahoo.com',
        '541-555-0144',
        'Reply to this lead at leads@leads.realtor.com',
      ].join('\n'),
    })
    expect(r!.portal).toBe('realtor.com')
    expect(r!.email).toBe('john.seller@yahoo.com') // not the leads@realtor.com address
    expect(r!.phone).toBe('5415550144')
    expect(r!.name).toBe('John Seller')
  })

  it('safety net: a portal email with only a phone still yields the phone', () => {
    const r = parsePortalLead({
      from: 'premieragent@zillow.com',
      subject: 'New connection request',
      body: 'A buyer wants to connect. Call them at 5415550199.',
    })
    expect(r!.email).toBeNull()
    expect(r!.phone).toBe('5415550199')
  })

  it('returns null for a non-portal email', () => {
    expect(parsePortalLead({ from: 'friend@gmail.com', subject: 'hi', body: 'hello' })).toBeNull()
  })

  it('normalizes 11-digit (+1) phones to 10 digits', () => {
    const r = parsePortalLead({ from: 'leads@leads.realtor.com', subject: 'New lead: A B', body: 'Phone: +1 (541) 555-0123' })
    expect(r!.phone).toBe('5415550123')
  })
})
