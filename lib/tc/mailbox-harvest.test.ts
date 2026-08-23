import { describe, expect, it } from 'vitest'
import {
  harvestPartyEmail,
  parseMailboxHeader,
  gmailQueryForParty,
  harvestOtherSideAgent,
  harvestEscrowNumber,
  harvestOfferPrice,
  harvestOffersFromMail,
} from './mailbox-harvest'

describe('parseMailboxHeader', () => {
  it('reads Hunter Allen from Paul\'s To line and drops the house mailbox', () => {
    expect(parseMailboxHeader('Hunter Allen <tigtactical@yahoo.com>')).toEqual([
      { name: 'Hunter Allen', email: 'tigtactical@yahoo.com' },
    ])
    expect(parseMailboxHeader('Paul Stevenson <paul@ryan-realty.com>')).toEqual([])
  })
})

describe('harvestPartyEmail', () => {
  it('returns the unique address when Paul mailed Hunter by name', () => {
    expect(
      harvestPartyEmail('Hunter Allen', [
        { from: 'Paul Stevenson <paul@ryan-realty.com>', to: 'Hunter Allen <tigtactical@yahoo.com>' },
        { from: 'Skyslope Forms <noreply@skyslope.com>', to: 'tigtactical@yahoo.com', cc: 'paul@ryan-realty.com' },
      ]),
    ).toBe('tigtactical@yahoo.com')
  })
  it('refuses two different addresses for the same name', () => {
    expect(
      harvestPartyEmail('Hunter Allen', [
        { to: 'Hunter Allen <a@yahoo.com>' },
        { to: 'Hunter Allen <b@yahoo.com>' },
      ]),
    ).toBeNull()
  })
})

describe('harvestOtherSideAgent', () => {
  it('picks Tiffany on Beaumont offer threads over title vendors', () => {
    expect(
      harvestOtherSideAgent([
        { from: 'Tiffany Clark <realestatetiffany@gmail.com>', subject: 'Offer #3 on Beaumont' },
        { from: 'Tiffany Clark <realestatetiffany@gmail.com>', subject: 'Repair Addendum - Beaumont' },
        { from: '"Ward, Yvonne" <yvonne.ward@westerntitle.com>', subject: 'Order #WT0286975 - Tyler Nicoll' },
      ]),
    ).toEqual({ name: 'Tiffany Clark', email: 'realestatetiffany@gmail.com' })
  })
})

describe('harvestEscrowNumber', () => {
  it('reads WT from a title subject', () => {
    expect(
      harvestEscrowNumber([{ subject: 'Order #WT0286975 - 20702 Beaumont Drive - Tyler Nicoll' }]),
    ).toBe('WT0286975')
  })
})

describe('harvestOfferPrice', () => {
  it('reads $519K', () => {
    expect(harvestOfferPrice('Sale Price - $519K EM - $5250')).toBe(519000)
  })
})

describe('harvestOffersFromMail', () => {
  it('keeps Tiffany offer #3', () => {
    const rows = harvestOffersFromMail([
      {
        from: 'Tiffany Clark <realestatetiffany@gmail.com>',
        subject: 'Offer #3 on Beaumont',
        snippet: 'Sale Price - $519K EM - $5250 Seller concession - $10K',
      },
    ])
    expect(rows[0]).toMatchObject({
      buyerAgent: 'Tiffany Clark',
      agentEmail: 'realestatetiffany@gmail.com',
      price: 519000,
    })
  })
})

describe('gmailQueryForParty', () => {
  it('quotes the person and ORs address tokens', () => {
    expect(gmailQueryForParty('Hunter Allen', ['5663', 'Impala'])).toContain('"Hunter Allen"')
    expect(gmailQueryForParty('Hunter Allen', ['5663', 'Impala'])).toContain('"Impala"')
  })
})
