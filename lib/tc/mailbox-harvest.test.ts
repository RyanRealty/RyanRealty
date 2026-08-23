import { describe, expect, it } from 'vitest'
import { harvestPartyEmail, parseMailboxHeader, gmailQueryForParty } from './mailbox-harvest'

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

describe('gmailQueryForParty', () => {
  it('quotes the person and ORs address tokens', () => {
    expect(gmailQueryForParty('Hunter Allen', ['5663', 'Impala'])).toContain('"Hunter Allen"')
    expect(gmailQueryForParty('Hunter Allen', ['5663', 'Impala'])).toContain('"Impala"')
  })
})
