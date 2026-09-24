import { describe, expect, it } from 'vitest'
import { queuedRowAfterRedecide, worthFullRead } from './mail-index'
import {
  bareStreetName,
  categorizeMail,
  dealOpenAt,
  decideMailFiling,
  isHouseAddress,
  mentionsBareStreet,
  mentionsDealAddress,
  mentionsDealStreet,
  mentionsEscrowNumber,
  mentionsMlsNumber,
  normalizeEmail,
  offerFromMail,
  parseDealAddress,
  parseOfferTerms,
  pickCycleForMail,
  propertyInSubject,
  streetAddressesIn,
  filesToOpenFromQueue,
  isComparablesReport,
  listedAddresses,
  personNameMatches,
  platformAliasNamesDeal,
  stripQuotedHistory,
  type DealCycleFacts,
  type DealFacts,
  type MailFacts,
} from './mail-rules'

// ── fixtures: real files, real mail that misfiled under the 2026-08-23 filer ──

function cycle(p: Partial<DealCycleFacts> & { id: string }): DealCycleFacts {
  return {
    kind: 'sale',
    status: null,
    mlsNumber: null,
    escrowNumber: null,
    listingDate: null,
    acceptanceDate: null,
    closeDate: null,
    deadDate: null,
    createdAt: null,
    ...p,
  }
}

const schoolHouse: DealFacts = {
  dealId: 'school-house',
  address: '56111 School House Rd, Bend, OR, 97707',
  city: 'Bend',
  stage: 'closed',
  cycles: [cycle({ id: 'sh-sale', status: 'Closed', escrowNumber: 'WT0285141', acceptanceDate: '2026-03-26', closeDate: '2026-05-15' })],
  partyEmails: [],
  // The SkySlope import put Matt on this file as "other agent". That row is what
  // filed 3,088 unrelated emails here.
  contactEmails: ['matt@ryan-realty.com'],
}

const tumalo: DealFacts = {
  dealId: 'tumalo',
  address: '19496 Tumalo Reservoir Rd, Bend, OR, 97703',
  city: 'Bend',
  stage: 'active_listing',
  cycles: [cycle({ id: 'tu-listing', kind: 'listing', status: 'Active', mlsNumber: '220215931', escrowNumber: 'WT0291454' })],
  partyEmails: [],
  contactEmails: ['shana@shanasellers.com', 'transactions@bridgetownfiles.com'],
}

const beaumont: DealFacts = {
  dealId: 'beaumont',
  address: '20702 Beaumont Drive, Bend, OR, 97701',
  city: 'Bend',
  stage: 'pending',
  cycles: [
    cycle({ id: 'be-live', status: 'Pending', mlsNumber: '220199105', escrowNumber: 'WT0286975', acceptanceDate: '2026-05-14', closeDate: '2026-06-23' }),
    cycle({ id: 'be-cancel-1', status: 'Canceled/App', mlsNumber: '220215040', escrowNumber: 'WT0286975', acceptanceDate: '2026-05-13', closeDate: '2026-06-23' }),
    cycle({ id: 'be-cancel-2', status: 'Canceled/Pend', mlsNumber: '220199105', escrowNumber: 'WT0285200', acceptanceDate: '2026-03-28', closeDate: '2026-04-29' }),
    cycle({ id: 'be-listing', kind: 'listing', status: 'Transaction', mlsNumber: '220199105', escrowNumber: 'WT0286975' }),
  ],
  partyEmails: [],
  contactEmails: [
    'yvonne.ward@westerntitle.com',
    'transactions@bridgetownfiles.com',
    'tonya.moore@westerntitle.com',
    'realestatetiffany@gmail.com',
  ],
}

const impala: DealFacts = {
  dealId: 'impala',
  address: '5663 Impala Avenue, Redmond, OR, 97756',
  city: 'Redmond',
  stage: 'active_listing',
  cycles: [cycle({ id: 'im-listing', kind: 'listing', status: 'Active', mlsNumber: '220221088' })],
  partyEmails: [],
  contactEmails: ['joel@stellarnw.com', 'transactions@bridgetownfiles.com'],
}

const fortyFifth: DealFacts = {
  dealId: 'forty-fifth',
  address: '3480 SW 45th Street, Redmond, OR, 97756',
  city: 'Redmond',
  stage: 'closed',
  cycles: [cycle({ id: '45-sale', status: 'Closed', mlsNumber: '220200502', escrowNumber: 'DE24656', acceptanceDate: '2025-07-06', closeDate: '2025-08-14' })],
  partyEmails: [],
  contactEmails: [],
}

const simpson: DealFacts = {
  dealId: 'simpson',
  address: '19571 SW Simpson Ave, Bend, OR, 97702',
  city: 'Bend',
  stage: 'closed',
  cycles: [cycle({ id: 'si-sale', status: 'Closed', mlsNumber: '220202576', escrowNumber: '7061-4348368', acceptanceDate: '2026-02-04', closeDate: '2026-03-16' })],
  partyEmails: [],
  contactEmails: ['sjnorton@firstam.com', 'lisacole@bhhsnw.com'],
}

// The test file: Vault Test Buyer (admin@) and Marketing Test Lead (marketing@).
const sedalia: DealFacts = {
  dealId: 'sedalia',
  address: '2840 NE Sedalia Loop, Bend, OR 97701',
  city: 'Bend',
  stage: 'pending',
  cycles: [
    cycle({ id: 'se-listing', kind: 'listing', status: 'Active', mlsNumber: '220227583' }),
    cycle({ id: 'se-sale', status: 'Pending', mlsNumber: '220227583', acceptanceDate: '2026-08-25' }),
  ],
  partyEmails: ['admin@ryan-realty.com', 'marketing@ryan-realty.com'],
  contactEmails: [],
}

const DEALS = [schoolHouse, tumalo, beaumont, impala, fortyFifth, simpson, sedalia]

function mail(p: Partial<MailFacts>): MailFacts {
  return {
    messageKey: 'rfc:test',
    sentAt: '2026-09-15T17:00:00Z',
    from: ['someone@example.com'],
    to: ['matt@ryan-realty.com'],
    cc: [],
    subject: '',
    body: '',
    attachments: [],
    bulkHeaders: false,
    autoReply: false,
    ...p,
  }
}

const decide = (m: MailFacts, thread: { dealId: string; method: string } | null = null) =>
  decideMailFiling({ facts: m, deals: DEALS, thread })

// ── house addresses ──────────────────────────────────────────────────────────

describe('house addresses', () => {
  it('treats brokerage mailboxes as the house and test aliases as outside parties', () => {
    expect(isHouseAddress('matt@ryan-realty.com')).toBe(true)
    expect(isHouseAddress('notifications@mail.ryan-realty.com')).toBe(true)
    expect(isHouseAddress('admin@ryan-realty.com')).toBe(false)
    expect(isHouseAddress('Marketing@Ryan-Realty.com')).toBe(false)
    expect(isHouseAddress('admin+otheragent@ryan-realty.com')).toBe(false)
    expect(isHouseAddress('buyer@gmail.com')).toBe(false)
  })

  it('folds plus-addressing onto the base mailbox', () => {
    expect(normalizeEmail('Admin+Offer1@ryan-realty.com')).toBe('admin@ryan-realty.com')
  })
})

// ── the 2026-08-23 misfiles, now correct ─────────────────────────────────────

describe('decideMailFiling: regressions from the live misfile audit (2026-09-23)', () => {
  it('a house address on a deal contact never files the broker inbox to that deal', () => {
    const d = decide(mail({ from: ['news@brandcoach.com'], subject: 'This is your sign to build a stronger online brand, Matthew.' }))
    expect(d.status).toBe('not_deal')
    expect(d.dealId).toBeNull()
  })

  it('a vendor receipt with PDFs is not deal mail', () => {
    const d = decide(
      mail({
        from: ['billing@x.ai'],
        subject: 'Your receipt from Grok xAI #2272-2005',
        attachments: [{ name: 'Invoice-0DTJJTIM-0003.pdf' }, { name: 'Receipt-2272-2005.pdf' }],
      }),
    )
    expect(d.status).toBe('not_deal')
  })

  it('our own deploy alerts are not deal mail', () => {
    const d = decide(mail({ from: ['alerts@mail.ryan-realty.com'], subject: '[Deploy] Production behind main by 352m (d194fb88 not live)' }))
    expect(d.status).toBe('bulk')
    expect(d.dealId).toBeNull()
  })

  it('files a shared TC firm email to the property it names, even a closed file (3480 SW 45th, not Tumalo)', () => {
    const d = decide(
      mail({
        from: ['transactions@bridgetownfiles.com'],
        subject: 'Re: Contingency Removal & HW Addendum | 3480 SW 45th St',
        sentAt: '2025-07-20T17:00:00Z',
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('forty-fifth')
    expect(d.method).toBe('address')
  })

  it('files title mail that names only the street ("SW 45th Close") to that deal, not the officer\'s other file', () => {
    const d = decide(
      mail({ from: ['yvonne.ward@westerntitle.com'], subject: 'SW 45th Close', sentAt: '2025-08-12T17:00:00Z' }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('forty-fifth')
  })

  it('never files a property with no deal onto the sender\'s other file (909 NW Delaware from First American)', () => {
    const d = decide(
      mail({
        from: ['sjnorton@firstam.com'],
        subject: '909 NW Delaware – Extended Title Insurance Coverage',
        sentAt: '2026-04-01T17:00:00Z', // inside Simpson's post-close window
      }),
    )
    expect(d.dealId).toBeNull()
    expect(d.status).toBe('unfiled_transaction')
    expect(d.propertyHint).toBe('909 nw delaware')
  })

  it('keeps a preliminary title report for a property with no file, grouped by that property', () => {
    const d = decide(mail({ from: ['escrow@firstam.com'], subject: 'Preliminary Title Report | 909 NW Delaware Avenue' }))
    expect(d.status).toBe('unfiled_transaction')
    expect(d.propertyHint).toBe('909 nw delaware')
  })

  it('saved-search copies and alerts do not file onto the client\'s deal', () => {
    expect(decide(mail({ from: ['matt@ryan-realty.com'], to: ['admin@ryan-realty.com'], subject: 'Copy: Subscription al and jan home search' })).status).toBe('bulk')
    expect(decide(mail({ to: ['admin@ryan-realty.com'], subject: '16 new listings for Bend homes' })).status).toBe('bulk')
  })

  it('our own pipeline alerts that name a property are not deal mail', () => {
    const bluff: DealFacts = { ...fortyFifth, dealId: 'bluff', address: '363 SW Bluff Dr, Bend, OR, 97702', stage: 'dead', cycles: [] }
    const d = decideMailFiling({
      facts: mail({ from: ['matt@ryan-realty.com'], subject: '[Expired] 363 Bluff, Bend (Expired, ? DOM, $1,195,000)' }),
      deals: [bluff],
      thread: null,
    })
    expect(d.status).toBe('bulk')
  })

  it('a forwarded historical email about a closed deal files there with its own category', () => {
    const d = decide(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['matt@ryan-realty.com'],
        subject: '[Deal: 3480 SW 45th St] Fwd: Inspection report',
        sentAt: '2026-09-01T12:00:00Z',
      }),
    )
    expect(d.dealId).toBe('forty-fifth')
    expect(d.category).toBe('inspection')
  })

  it('a stranger quoting street names in the body files nowhere', () => {
    const d = decide(
      mail({
        from: ['ashley@weare.trymeetdiverseit.com'],
        subject: 'Re: quick question',
        body: 'We helped sellers on Beaumont Drive and Tumalo Reservoir Road last month.',
      }),
    )
    expect(d.status).toBe('not_deal')
  })

  it('the property in the subject wins over a forwarded chain that quotes another file', () => {
    const d = decide(
      mail({
        from: ['matt.lists.homes@gmail.com'],
        subject: '[Deal: 3480 SW 45th St] Fwd: Seller Counter Offer 1 - $445K',
        body: 'Forwarded. Earlier note mentioned 20702 Beaumont Drive as a comp.',
        attachments: [{ name: 'SCO1.pdf' }],
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('forty-fifth')
    // Matt forwarding history into his own inbox is the house, never a buyer's agent.
    expect(offerFromMail({ decision: d, facts: mail({ subject: '[Deal: 3480 SW 45th St] Fwd: Offer 3', from: ['matt.lists.homes@gmail.com'] }), fromName: 'Matt Ryan', listingSide: true })).toBeNull()
  })

  it('a vendor on several files sending general mail is not deal mail', () => {
    expect(decide(mail({ from: ['transactions@bridgetownfiles.com'], subject: 'Vacation Coverage' })).status).toBe('not_deal')
  })

  it('a client on several open files asking about none of them is queued for a person, not dropped', () => {
    const apollo: DealFacts = {
      ...sedalia,
      dealId: 'apollo',
      address: '60935 Apollo Place, Bend, OR 97702',
      cycles: [cycle({ id: 'ap-sale', status: 'Pending', mlsNumber: '220216758', acceptanceDate: '2026-08-24' })],
    }
    const d = decideMailFiling({
      facts: mail({ from: ['admin@ryan-realty.com'], subject: '[TC TEST ab12] Question about the walkthrough', body: 'What time works for the final walkthrough?' }),
      deals: [...DEALS, apollo],
      thread: null,
    })
    expect(d.status).toBe('ambiguous')
    expect(d.dealId).toBeNull()
  })

  it('a test-party mailbox is a client only on harness mail: Workspace notices to admin@ file nowhere (2026-09-24 queue)', () => {
    const d = decide(
      mail({ from: ['workspace-noreply@google.com'], to: ['admin@ryan-realty.com'], subject: '[Notice] Possible unresolved security risks in your Admin Console' }),
    )
    // v4: "[Notice]" is a system notice, so it stops at rule 0 (bulk) instead of reaching "no deal evidence".
    expect(d.status).toBe('bulk')
    expect(d.candidates).toEqual([])
    const code = decide(mail({ from: ['workspace-noreply@google.com'], to: ['admin@ryan-realty.com'], subject: 'Your sign-in code' }))
    expect(code.status).toBe('not_deal')
    expect(code.candidates).toEqual([])
    const crm = decide(mail({ from: ['marketing@ryan-realty.com'], to: ['matt@ryan-realty.com'], subject: 'Re: Test: CRM email delivery + tracking check' }))
    expect(crm.status).toBe('not_deal')
  })

  it('an address with its directional spelled out files to the deal (3480 Southwest 45th inspection mail)', () => {
    const d = decide(
      mail({
        from: ['noreply@wininspections.com'],
        sentAt: '2025-07-22T17:00:00Z',
        subject: 'Inspection Scheduled on Your Listing at 3480 Southwest 45th Street, Redmond',
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('forty-fifth')
    expect(d.propertyHint).toBe('3480 sw 45th')
  })

  it('an e-sign completion that names the street files there, even with a mistyped house number (School House)', () => {
    const d = decide(
      mail({ from: ['noreply@skyslope.com'], sentAt: '2026-04-14T17:00:00Z', subject: 'Envelope completed: Repair Addendum | 5611 School House Rd' }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('school-house')
  })

  it('step two: of the deals the sender is on, the one the subject calls by its street alone ("Work on Beaumont")', () => {
    const d = decide(
      mail({ from: ['transactions@bridgetownfiles.com'], sentAt: '2026-06-16T17:00:00Z', subject: 'Documentation for Completion of Work on Beaumont' }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
    expect(d.method).toBe('address')
  })

  it('our own transaction mail naming one file by its street alone files there ("[Simpson forward] … Repair Addendum")', () => {
    const d = decide(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['matt@ryan-realty.com'],
        sentAt: '2026-05-21T17:00:00Z',
        subject: '[Simpson forward] OREF 022A Buyers Repair Addendum 2 - all 4 sigs',
        attachments: [{ name: 'P2_Buyers_Repair_Addendum_-_2.pdf' }],
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('simpson')
  })

  it('an e-sign completion for a property with no file is kept as a transaction record (1450 Revere counter rejection)', () => {
    const d = decide(
      mail({ from: ['noreply@skyslope.com'], to: ['rebeccapeterson@ryan-realty.com'], subject: 'Envelope completed: Sellers Counteroffer Rejection - 1450 Revere Ave' }),
    )
    expect(d.status).toBe('unfiled_transaction')
    expect(d.propertyHint).toBe('1450 revere')
  })

  it('auto-replies never file', () => {
    expect(decide(mail({ from: ['sjnorton@firstam.com'], subject: 'Automatic reply: 909 Delaware', autoReply: true })).status).toBe('bulk')
  })
})

// ── the rules, in order ──────────────────────────────────────────────────────

describe('decideMailFiling: rule order', () => {
  it('rule 1: the escrow number decides, on any stage (post-close title mail files to the closed deal)', () => {
    const d = decide(
      mail({ from: ['recording@westerntitle.com'], subject: 'Recorded documents WT0285141', sentAt: '2026-06-01T17:00:00Z' }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('school-house')
    expect(d.method).toBe('escrow')
    expect(d.category).toBe('post_close')
    expect(d.cycleId).toBe('sh-sale')
  })

  it('rule 1: the MLS number decides', () => {
    const d = decide(mail({ from: ['agent@othersbrokerage.com'], subject: 'Question on MLS# 220221088' }))
    expect(d.dealId).toBe('impala')
    expect(d.method).toBe('mls')
  })

  it('rule 1: identifiers never match inside longer numbers', () => {
    expect(mentionsMlsNumber('ref 12202210881', '220221088')).toBe(false)
    expect(mentionsMlsNumber('MLS 220221088.', '220221088')).toBe(true)
    expect(mentionsEscrowNumber('Escrow # WT0291454', 'WT0291454')).toBe(true)
    expect(mentionsEscrowNumber('anything', 'WT0')).toBe(false)
  })

  it('rule 1: title bulk notices still file when they carry one escrow number', () => {
    const d = decide(mail({ from: ['noreply@westerntitle.com'], subject: 'Open Escrow # WT0291454 Property: 19496 Tumalo Reservoir Road', bulkHeaders: true }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('tumalo')
  })

  it('rule 2: a reply in a filed thread stays with that deal', () => {
    const d = decide(mail({ from: ['realestatetiffany@gmail.com'], subject: 'Re: Thanks!' }), { dealId: 'beaumont', method: 'address' })
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
    expect(d.method).toBe('thread')
  })

  it('rule 2: a thread that turns to another property follows the property', () => {
    const d = decide(
      mail({ from: ['yvonne.ward@westerntitle.com'], subject: 'Re: closing docs', body: 'Also attaching the final for 3480 SW 45th Street.' }),
      { dealId: 'beaumont', method: 'address' },
    )
    expect(d.dealId).toBe('forty-fifth')
  })

  it('rule 3: the street address decides and the city breaks a tie', () => {
    const bendMain: DealFacts = { ...fortyFifth, dealId: 'bend-main', address: '123 Main St, Bend, OR', city: 'Bend', cycles: [] }
    const redmondMain: DealFacts = { ...fortyFifth, dealId: 'redmond-main', address: '123 Main St, Redmond, OR', city: 'Redmond', cycles: [] }
    const both = [bendMain, redmondMain]
    expect(decideMailFiling({ facts: mail({ subject: 'Inspection for 123 Main St' }), deals: both, thread: null }).status).toBe('ambiguous')
    const d = decideMailFiling({ facts: mail({ subject: 'Inspection for 123 Main St, Redmond' }), deals: both, thread: null })
    expect(d.dealId).toBe('redmond-main')
  })

  it('rule 4: our client on exactly one open deal files with no address', () => {
    const d = decide(mail({ from: ['admin@ryan-realty.com'], subject: '[TC TEST ab12] When is the walkthrough?' }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('sedalia')
    expect(d.method).toBe('party')
  })

  it('rule 4: a contact on several open deals with silent content is ambiguous, never a guess', () => {
    const d = decide(mail({ from: ['transactions@bridgetownfiles.com'], subject: 'Documents for signature', attachments: [{ name: 'Addendum.pdf' }] }))
    expect(d.status).toBe('ambiguous')
    expect(d.dealId).toBeNull()
    expect(d.candidates.map((c) => c.dealId).sort()).toEqual(['beaumont', 'impala', 'tumalo'])
  })

  it('rule 4: a contact on one open deal files there (the other agent\'s counter on our listing)', () => {
    const d = decide(mail({ from: ['shana@shanasellers.com'], subject: 'Buyer Counter Offer 1', attachments: [{ name: 'BCO1.pdf' }] }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('tumalo')
    expect(d.category).toBe('counter')
    expect(d.cycleId).toBe('tu-listing')
  })

  it('rule 4: a contact whose file closed long ago does not collect new mail', () => {
    const d = decide(mail({ from: ['lisacole@bhhsnw.com'], subject: 'Happy holidays', sentAt: '2026-12-20T17:00:00Z' }))
    expect(d.status).toBe('not_deal')
  })

  it('rule 5: transaction mail without a subject property or transaction form is not queued', () => {
    const d = decide(mail({ from: ['stranger@example.com'], subject: 'An offer you can\'t refuse on SEO services' }))
    expect(d.status).toBe('not_deal')
  })

  it('digests that list three or more addresses are bulk, even when one is ours', () => {
    const d = decide(
      mail({
        subject: 'Market watch',
        body: '19496 Tumalo Reservoir Road, Bend. 123 Pine Street. 456 Oak Avenue. 789 Elm Drive.',
      }),
    )
    expect(d.status).toBe('bulk')
  })
})

// ── pieces ───────────────────────────────────────────────────────────────────

describe('address evidence', () => {
  it('parses the house number, directional, street and next word', () => {
    expect(parseDealAddress('3480 SW 45th Street, Redmond, OR, 97756')).toMatchObject({
      number: '3480',
      directional: 'sw',
      street: '45th',
      next: 'street',
      city: 'redmond',
    })
    expect(parseDealAddress('(blank)')).toBeNull()
  })

  it('matches the address with or without the directional', () => {
    const p = parseDealAddress('909 NW Delaware Avenue, Bend')!
    expect(mentionsDealAddress('Re: 909 Delaware', p)).toBe(true)
    expect(mentionsDealAddress('909 NW Delaware Ave', p)).toBe(true)
    expect(mentionsDealAddress('9090 Delaware', p)).toBe(false)
    expect(mentionsDealAddress('909 Delawarean', p)).toBe(false)
  })

  it('matches the street alone only when it names the property', () => {
    expect(mentionsDealStreet('SW 45th Close', parseDealAddress('3480 SW 45th Street, Redmond')!)).toBe(true)
    expect(mentionsDealStreet('45th anniversary', parseDealAddress('3480 SW 45th Street, Redmond')!)).toBe(false)
    expect(mentionsDealStreet('walkthrough at Beaumont Dr', parseDealAddress('20702 Beaumont Drive, Bend')!)).toBe(true)
    expect(mentionsDealStreet('the Beaumont', parseDealAddress('20702 Beaumont Drive, Bend')!)).toBe(false)
  })

  it('finds the property a subject names, and skips numbers that are not houses', () => {
    expect(propertyInSubject('Re: 909 Delaware')).toBe('909 delaware')
    expect(propertyInSubject('Preliminary Title Report | 909 NW Delaware Avenue')).toBe('909 nw delaware')
    expect(propertyInSubject('Ryan Realty analytics — Mon, Sep 21: 455 visitors, 2 hot')).toBeNull()
    expect(propertyInSubject('Buyer Counter Offer 1')).toBeNull()
    expect(propertyInSubject('2026 Market Outlook')).toBeNull()
    expect(propertyInSubject('Your receipt from Grok xAI #2272-2005')).toBeNull()
  })

  it('reads spelled-out and doubled directionals, and West as a street name', () => {
    expect(parseDealAddress('3480 Southwest 45th Street, Redmond')).toMatchObject({ number: '3480', directional: 'sw', street: '45th' })
    expect(parseDealAddress('2354 NW NW Drouillard Ave, Bend')).toMatchObject({ directional: 'nw', street: 'drouillard', next: 'ave' })
    expect(parseDealAddress('123 West Ave, Bend')).toMatchObject({ directional: null, street: 'west', next: 'ave' })
    const p = parseDealAddress('3480 SW 45th Street, Redmond')!
    expect(mentionsDealAddress('at 3480 Southwest 45th Street', p)).toBe(true)
    expect(mentionsDealStreet('Southwest 45th close', p)).toBe(true)
    expect(propertyInSubject('Thank You – Inspection Completed at 3480 Southwest 45th Street, Redmond')).toBe('3480 sw 45th')
  })

  it('names a property by its bare street only when the name means one street', () => {
    expect(bareStreetName(parseDealAddress('2680 NW Nordic Avenue, Bend')!)).toBe('nordic')
    expect(bareStreetName(parseDealAddress('56111 School House Rd, Bend')!)).toBe('school house')
    expect(bareStreetName(parseDealAddress('3480 SW 45th Street, Redmond')!)).toBeNull()
    expect(bareStreetName(parseDealAddress('100 Main St, Bend')!)).toBeNull()
    expect(mentionsBareStreet('Re: Home Warranty - Nordic', parseDealAddress('2680 NW Nordic Avenue, Bend')!)).toBe(true)
    expect(mentionsBareStreet('Nordic skiing this weekend?', parseDealAddress('2680 NW Nordic Avenue, Bend')!)).toBe(true)
    expect(mentionsBareStreet('Nordicware sale', parseDealAddress('2680 NW Nordic Avenue, Bend')!)).toBe(false)
  })

  it('counts distinct suffixed street addresses', () => {
    expect(streetAddressesIn('20702 Beaumont Drive and 20702 Beaumont Drive and 5663 SW Impala Ave')).toHaveLength(2)
  })
})

describe('categorizeMail', () => {
  const cat = (subject: string, attachments: { name: string; executionState?: string }[] = []) =>
    categorizeMail({ subject, body: '', attachments, autoReply: false, fromHouseSystem: false })
  it('reads the transaction step from the subject and the forms attached', () => {
    expect(cat('Offer on 19496 Tumalo Reservoir')).toBe('offer')
    expect(cat('see attached', [{ name: '2.1_Counteroffer_to_Real_Estate_Purchase_and_Sale_Agreement.pdf' }])).toBe('counter')
    expect(cat('fully signed', [{ name: 'PSA.pdf', executionState: 'fully_executed' }])).toBe('executed_agreement')
    // The file name says so: "… Fully Executed.pdf", SkySlope's "_X_" executed marker.
    expect(cat('Re: Full price offer', [{ name: 'Sale_Agreement_Fully_Executed.pdf' }])).toBe('executed_agreement')
    expect(cat('see attached', [{ name: 'RP08242025_X_001_Residential_Real_Estate_Sale_Agreement.pdf' }])).toBe('executed_agreement')
    expect(cat('Re: Full price offer', [{ name: 'Sale_Agreement.pdf' }])).toBe('offer')
    expect(cat('Property Disclosures | 19496 Tumalo Reservoir Rd')).toBe('disclosure')
    expect(cat('Open Escrow # WT0291454')).toBe('escrow_title')
    expect(cat('Pre-approval for Todd Lorenz')).toBe('lender')
    expect(cat('Please Review and Approve: Estimated Settlement Statement')).toBe('closing')
    expect(cat('You have documents to sign for 60935 Apollo Place')).toBe('signing_notice')
    expect(cat('1 update for My search')).toBe('listing_alert')
  })
})

describe('deal windows and cycles', () => {
  it('a closed deal takes mail through 120 days after close; a live deal always', () => {
    expect(dealOpenAt(simpson, '2026-05-01T12:00:00Z')).toBe(true)
    expect(dealOpenAt(simpson, '2026-09-10T12:00:00Z')).toBe(false)
    expect(dealOpenAt(tumalo, '2030-01-01T12:00:00Z')).toBe(true)
  })

  it('picks the live sale cycle over cancelled ones, and the listing cycle for offers', () => {
    expect(pickCycleForMail(beaumont.cycles, '2026-05-20T12:00:00Z', 'escrow_title')).toBe('be-live')
    expect(pickCycleForMail(beaumont.cycles, '2026-05-20T12:00:00Z', 'offer')).toBe('be-listing')
    expect(pickCycleForMail(sedalia.cycles, '2026-09-01T12:00:00Z', 'closing')).toBe('se-sale')
  })
})

// ── offers ───────────────────────────────────────────────────────────────────

const OFFER_TEXT =
  'RESIDENTIAL REAL ESTATE SALE AGREEMENT ... PRICE: Buyer offers to buy the Property for the Purchase Price of $ 615,000.00 ... ' +
  'EARNEST MONEY: Buyer will deposit earnest money in the amount of $ 10,000 ... Buyer will obtain a Conventional loan'

describe('offers', () => {
  it('reads price, earnest money and financing from the offer text', () => {
    expect(parseOfferTerms(OFFER_TEXT)).toEqual({ price: 615000, earnestMoney: 10000, financing: 'conventional' })
    expect(parseOfferTerms('no numbers here')).toEqual({ price: null, earnestMoney: null, financing: null })
  })

  it('records an inbound offer on our listing whether or not we reply', () => {
    const facts = mail({
      from: ['agent@otherbrokerage.com'],
      subject: 'Offer - 19496 Tumalo Reservoir Rd',
      attachments: [{ name: 'Sale Agreement.pdf', text: OFFER_TEXT, executionState: 'needs_our_signatures' }],
    })
    const decision = decide(facts)
    expect(decision.dealId).toBe('tumalo')
    expect(decision.category).toBe('offer')
    expect(decision.cycleId).toBe('tu-listing')
    expect(offerFromMail({ decision, facts, fromName: 'Pat Agent', listingSide: true })).toEqual({
      kind: 'offer',
      agentName: 'Pat Agent',
      agentEmail: 'agent@otherbrokerage.com',
      price: 615000,
      earnestMoney: 10000,
      financing: 'conventional',
    })
  })

  it('records our counter back, and nothing on a buyer-side file', () => {
    const facts = mail({
      from: ['matt@ryan-realty.com'],
      to: ['agent@otherbrokerage.com'],
      subject: 'Seller counter - 19496 Tumalo Reservoir Rd',
      attachments: [{ name: 'SCO1.pdf' }],
    })
    const decision = decide(facts)
    expect(offerFromMail({ decision, facts, fromName: null, listingSide: true })?.kind).toBe('counter_out')
    expect(offerFromMail({ decision, facts, fromName: null, listingSide: false })).toBeNull()
  })
})

describe('opening files from queued mail', () => {
  const q = (id: string, subject: string, category = 'escrow_title') => ({
    id,
    propertyHint: '909 nw delaware',
    subject,
    category,
    broker: 'matt',
    sentAt: '2026-09-10T12:00:00Z',
  })

  it('opens a file when escrow opened for a property with none, with the fullest address the mail writes', () => {
    const open = filesToOpenFromQueue([
      q('1', 'Offer to purchase 909 Delaware', 'offer'),
      q('2', 'Escrow/Title Opened: 909 NW Delaware Ave | Carlton to Langevin'),
      q('3', 'Inspection Report Now Available for (909 NW Delaware Ave, Bend, OR 97703)', 'inspection'),
      q('4', 'Preliminary Title Report | 909 NW Delaware Avenue'),
    ])
    expect(open).toHaveLength(1)
    expect(open[0].address).toBe('909 NW Delaware Avenue, Bend, OR 97703')
    expect(open[0].rowIds).toEqual(['1', '2', '3', '4'])
    expect(open[0].broker).toBe('matt')
  })

  it('an offer alone never opens a file', () => {
    expect(filesToOpenFromQueue([q('1', 'Offer to purchase 909 Delaware', 'offer'), q('2', 'Re: Offer to purchase 909 Delaware', 'offer')])).toEqual([])
  })
})

// ── v4: the 2026-09-24 read-only audit of ~1,500 real messages ───────────────
// Every case below is shaped like a real message the v3 rules mishandled. People
// are placeholders; addresses, MLS and escrow numbers are the files' own.

const oldBend: DealFacts = {
  dealId: 'old-bend',
  address: '64350 Old Bend Redmond Hwy, Bend, OR, 97703',
  city: 'Bend',
  stage: 'closed',
  cycles: [
    cycle({ id: 'ob-listing', kind: 'listing', status: 'Transaction', mlsNumber: '220205567' }),
    cycle({
      id: 'ob-closed',
      status: 'Closed',
      mlsNumber: '220205567',
      escrowNumber: 'WT0278291',
      acceptanceDate: '2025-08-27',
      closeDate: '2025-09-25',
      buyers: ['Jordan Secondcycle'],
    }),
    cycle({
      id: 'ob-canceled',
      status: 'Canceled/App',
      mlsNumber: '220205567',
      acceptanceDate: '2025-08-06',
      deadDate: '2025-08-24',
      buyers: ['Avery Firstcycle', 'Casey Firstcycle'],
    }),
  ],
  partyEmails: [],
  contactEmails: ['tonya.moore@westerntitle.com'],
}

const ordway: DealFacts = {
  dealId: 'ordway',
  address: '2732 Ordway Avenue, Bend, OR, 97703',
  city: 'Bend',
  stage: 'closed',
  cycles: [cycle({ id: 'or-sale', status: 'Closed', mlsNumber: '220201089', escrowNumber: 'WT0274211', acceptanceDate: '2025-05-08', closeDate: '2025-06-09' })],
  partyEmails: [],
  contactEmails: ['otheragent@garnerlike.com', 'titleofficer@westerntitle.com'],
}

const nordic: DealFacts = {
  dealId: 'nordic',
  address: '2680 NW Nordic Avenue, Bend, OR, 97703',
  city: 'Bend',
  stage: 'pending',
  cycles: [cycle({ id: 'no-sale', status: 'Pending', mlsNumber: '220184043', acceptanceDate: '2026-08-20' })],
  partyEmails: [],
  contactEmails: ['transactions@bridgetownfiles.com'],
  subdivisions: ['Valhalla Heights'],
}

const jacklight: DealFacts = {
  dealId: 'jacklight',
  address: '20473 Jacklight Lane, Bend, OR, 97702',
  city: 'Bend',
  stage: 'pending',
  cycles: [cycle({ id: 'ja-sale', status: 'Pending', mlsNumber: '220198987', acceptanceDate: '2026-08-15' })],
  partyEmails: [],
  contactEmails: ['otherofficer@westerntitle.com'],
  // The other agent is on the file by name only: SkySlope carried no email for her.
  contactNames: ['Lee Listside'],
}

const V4_DEALS = [...DEALS, oldBend, ordway, nordic, jacklight]

const decide4 = (m: MailFacts, thread: { dealId: string; method: string } | null = null, deals: readonly DealFacts[] = V4_DEALS) =>
  decideMailFiling({ facts: m, deals, thread })

// A title officer's signature: two office addresses, phones, emails. It repeats in
// every quoted layer of every reply. The addresses are placeholders; the shape is real.
const TITLE_SIGNATURE = [
  'Pat Officer',
  'Senior Escrow Officer',
  'pat.officer@westerntitle.com<mailto:pat.officer@westerntitle.com>',
  'T: 541-555-0100<tel:541-555-0100>',
  '',
  'Western Title & Escrow Company',
  '100 SW Example Ave, Suite 100',
  'Bend, OR 97702',
  '',
  '200 SW 9th St',
  'Redmond, OR 97756',
].join('\n')

describe('v4 defect 1: a title signature or an "also viewed" list is not a digest', () => {
  it('a title reply naming one deal in its subject files there, whatever its signature lists (Western Title: 122 dropped as bulk)', () => {
    const d = decide4(
      mail({
        from: ['tonya.moore@westerntitle.com'],
        to: ['transactions@bridgetownfiles.com'],
        cc: ['matt@ryan-realty.com'],
        sentAt: '2026-05-15T17:00:00Z',
        subject: "Re: Congratulations! You're Under Contract! | 20702 Beaumont Drive",
        body: [
          'Great thank you! We will add you to the file.',
          '',
          TITLE_SIGNATURE,
          '',
          'On May 14, 2026, at 2:34 PM, TC <transactions@bridgetownfiles.com> wrote:',
          'Important Contacts:',
          'Escrow: Pat Officer, Western Title & Escrow',
          '100 SW Example Ave, Ste. 100, Bend, OR 97702',
          'Email: pat.officer@westerntitle.com, Phone: (541) 555-0100',
          '',
          TITLE_SIGNATURE,
        ].join('\n'),
        attachments: [{ name: 'Sale Agreement.pdf' }, { name: "Counter- Seller's.pdf" }],
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })

  it('letterhead addresses never count toward the three, even when the subject names no deal', () => {
    expect(listedAddresses('RE: closing docs', `Received for 20702 Beaumont Drive, thank you.\n\n${TITLE_SIGNATURE}`)).toEqual(['20702 beaumont'])
    const d = decide4(
      mail({
        from: ['tonya.moore@westerntitle.com'],
        sentAt: '2026-05-20T17:00:00Z',
        subject: 'RE: closing docs',
        body: `Received the signed docs for 20702 Beaumont Drive, thank you.\n\n${TITLE_SIGNATURE}`,
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })

  it('a Flexmls activity report for one of our MLS numbers files there, not dropped for its "also viewed" homes', () => {
    const facts = mail({
      from: ['listingupdates@flexmail.flexmls.com'],
      subject: 'Activity Report for MLS# 220215931 - 19496 Tumalo Reservoir Road, Bend, OR',
      body:
        'Activity for 19496 Tumalo Reservoir Road, Bend, OR 97703. ListingId: 220215931. List Price: $1,095,000. ' +
        'Also viewed: 123 Pine Street $899,000 3 bd; 456 Oak Avenue $1,150,000 4 bd; 789 Elm Drive $975,000 3 bd.',
    })
    const d = decide4(facts)
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('tumalo')
    expect(d.method).toBe('mls')
    // Bulk headers do not change it: exactly one deal's MLS number in the subject lifts the noise.
    const bulk = decide4({ ...facts, bulkHeaders: true })
    expect(bulk.status).toBe('filed')
    expect(bulk.dealId).toBe('tumalo')
  })

  it('real digests stay noise: a hot sheet naming one of ours in its body, and one with a phone on every line', () => {
    expect(
      decide4(
        mail({
          subject: 'Your daily hot sheet',
          body: '19496 Tumalo Reservoir Road $1,095,000 3 bd. 123 Pine Street $899,000 3 bd. 456 Oak Avenue $1,150,000 4 bd.',
        }),
      ).status,
    ).toBe('bulk')
    expect(
      decide4(
        mail({
          subject: 'Weekend showings',
          body: '123 Pine Street $525,000 host 541-555-0101\n456 Oak Avenue $615,000 host 541-555-0102\n789 Elm Drive $700,000 host 541-555-0103',
        }),
      ).status,
    ).toBe('bulk')
  })

  it('bulk mail naming our full address in its subject is read by the rules, not filed on that alone (a vendor pitch)', () => {
    const d = decide4(
      mail({ from: ['listings@vendorpitch.example'], subject: 'Get more buyers for 5663 Impala Avenue', body: 'Boost your listing today.', bulkHeaders: true }),
    )
    expect(d.status).toBe('not_deal')
    expect(d.dealId).toBeNull()
  })
})

describe('v4 defect 2: e-sign envelopes are not listing alerts', () => {
  const addenda = [{ name: 'Addendum_to_Sale_Agreement_2_-_002_OREF__1_.pdf' }, { name: 'Addendum_to_Sale_Agreement_2A_-_002_OREF.pdf' }]

  it('"Envelope completed: Appraisal Price Change" and "Price Change Form" are e-sign notices', () => {
    const cat = (subject: string, attachments: { name: string; executionState?: string }[] = []) =>
      categorizeMail({ subject, body: 'Your document has been completed.', attachments, autoReply: false, fromHouseSystem: false })
    expect(cat('Envelope completed: Appraisal Price Change', addenda)).toBe('signing_notice')
    expect(cat('Envelope completed: Price Change Form', [{ name: 'Change_Form_for_Status__Date__Price_and_Other_Miscellaneous_Changes_-_ODS.pdf' }])).toBe(
      'signing_notice',
    )
    // An executed transaction form attached is never a listing alert.
    expect(cat('Price change', [{ name: 'Addendum_to_Sale_Agreement_2_-_002_OREF.pdf', executionState: 'fully_executed' }])).toBe('addendum')
    // Real listing alerts still are.
    expect(cat('Price drop on 123 Pine Street')).toBe('listing_alert')
  })

  it('an addendum to the sale agreement is an addendum, not an offer', () => {
    expect(categorizeMail({ subject: 'see attached', body: '', attachments: addenda, autoReply: false, fromHouseSystem: false })).toBe('addendum')
  })

  it('the completed envelope files to the deal its documents name', () => {
    const d = decide4(
      mail({
        from: ['noreply@skyslope.com'],
        sentAt: '2026-05-25T04:58:00Z',
        subject: 'Envelope completed: Appraisal Price Change',
        body: 'Your document has been completed.',
        attachments: addenda.map((a) => ({ ...a, text: 'ADDENDUM TO SALE AGREEMENT. Property: 20702 Beaumont Drive, Bend, OR 97701. Price change.' })),
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
    expect(d.category).toBe('signing_notice')
  })
})

describe('v4 defect 3: a full address from a stranger, in ordinary mail, is not a filing', () => {
  it('vendor pitches naming our listing file nowhere (virtual staging, magazine ad sales)', () => {
    expect(
      decide4(
        mail({
          from: ['hello@stagingvendor.example'],
          subject: 'Quick idea for 5663 Impala Avenue',
          body: 'Hi, I saw your listing at 5663 Impala Avenue. Virtual staging helps buyers picture the home.',
        }),
      ).status,
    ).toBe('not_deal')
    expect(decide4(mail({ from: ['ads@homemagazine.example'], subject: 'Feature 20702 Beaumont Drive in our fall issue', body: 'Premium placement for your listing.' })).status).toBe(
      'not_deal',
    )
  })

  it("another agent arranging a showing on our listing files there, though they are on no file yet (198c8daf351e24f1)", () => {
    const d = decide4(
      mail({
        from: ['buyersagent@gmail.com'],
        sentAt: '2026-05-20T17:00:00Z',
        subject: 'Showing on 20702 Beaumont Drive',
        body: 'Hi Matt, my clients would like to switch from 12:00 noon to 1:00 today. Would that work for the sellers?',
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })

  it('the property\'s own records and documents still file from people not yet on the file (HOA documents, service invoices, a termination question)', () => {
    const hoa = decide4(
      mail({ from: ['matt@ryan-realty.com'], to: ['tom@buyerstrust.example'], sentAt: '2026-05-20T17:00:00Z', subject: '20702 Beaumont Drive HOA Documents', body: 'Let me know if you can open these.' }),
    )
    expect(hoa.dealId).toBe('beaumont')
    const service = decide4(
      mail({
        from: ['office@heatingco.example'],
        to: ['rebeccapeterson@ryan-realty.com'],
        sentAt: '2026-05-20T17:00:00Z',
        subject: '20702 Beaumont Drive Service Records',
        body: 'Here are all of the service invoices I have for this address.',
        attachments: [{ name: 'Service Invoice.pdf' }],
      }),
    )
    expect(service.dealId).toBe('beaumont')
    const legal = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['legal@realtorsassociation.example'],
        sentAt: '2026-05-20T17:00:00Z',
        subject: 'Re: Question Regarding Contract Termination',
        body: 'Thanks for your insight on the contract for 20702 Beaumont Drive.',
      }),
    )
    expect(legal.dealId).toBe('beaumont')
  })

  it('inspections by their kind are inspection mail: a septic evaluation report, a radon test (from people on no file)', () => {
    const septic = decide4(
      mail({
        from: ['office@septicservice.example'],
        sentAt: '2026-05-20T17:00:00Z',
        subject: 'Report for 20702 Beaumont Drive',
        body: 'Payment received, here is the report.',
        attachments: [{ name: 'ESER for 20702 Beaumont Drive.pdf' }],
      }),
    )
    expect(septic.category).toBe('inspection')
    expect(septic.dealId).toBe('beaumont')
    const radon = decide4(
      mail({ from: ['inspector@inspections.example'], sentAt: '2026-05-18T17:00:00Z', subject: 'Invitation: Radon equipment pick up', body: 'Location: 20702 Beaumont Drive, Bend, OR 97701' }),
    )
    expect(radon.category).toBe('inspection')
    expect(radon.dealId).toBe('beaumont')
  })

  it("our own prospecting blast to people on no file is not deal mail (Rebecca's NEW LISTING letters)", () => {
    const d = decide4(
      mail({
        from: ['rebeccapeterson@ryan-realty.com'],
        to: ['neighbor@gmail.com'],
        subject: 'New NWX Listing - Rare Backyard',
        body: "I'm excited to announce a new listing at 20702 Beaumont Drive in our community. Call today!",
      }),
    )
    expect(d.status).toBe('not_deal')
  })

  it('the same outbound mail to someone on that file does file (the other agent)', () => {
    const d = decide4(
      mail({ from: ['matt@ryan-realty.com'], to: ['realestatetiffany@gmail.com'], sentAt: '2026-05-20T17:00:00Z', subject: '20702 Beaumont Drive photos', body: 'Here they are.' }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })

  it('a new counterparty writing transaction mail about the property still files (appraiser, escrow officer, lender)', () => {
    const appraiser = decide4(
      mail({ from: ['office@newappraiser.example'], sentAt: '2026-05-20T17:00:00Z', subject: '20702 Beaumont Drive', body: 'We have scheduled the appraisal inspection for Tuesday.' }),
    )
    expect(appraiser.status).toBe('filed')
    expect(appraiser.dealId).toBe('beaumont')
    const escrow = decide4(mail({ from: ['new.officer@westerntitle.com'], sentAt: '2026-05-20T17:00:00Z', subject: 'Question on 20702 Beaumont Drive', body: 'Quick question.' }))
    expect(escrow.status).toBe('filed')
    expect(escrow.dealId).toBe('beaumont')
    const lender = decide4(
      mail({ from: ['loans@newlender.example'], sentAt: '2026-05-20T17:00:00Z', subject: 'Update: 20702 Beaumont Drive', body: 'Good news, we are clear to close.' }),
    )
    expect(lender.status).toBe('filed')
    expect(lender.dealId).toBe('beaumont')
  })
})

describe('v4 defect 4: the body says what the email is about', () => {
  const cat = (body: string, bulkHeaders = false) =>
    categorizeMail({ subject: 'Re: 61260 Sunflower Lane', body, attachments: [], autoReply: false, fromHouseSystem: false, bulkHeaders })

  it('reads the step from the body when the subject and file names are silent', () => {
    expect(cat('We wanted to allow extra time for your clients to decide on our counter offfer.')).toBe('counter')
    expect(cat('The repair addendum is attached for signatures.')).toBe('addendum')
    expect(cat('The earnest money was received today.')).toBe('escrow_title')
  })

  it('quoted history never decides: it was about something else, earlier', () => {
    expect(cat('Sounds good, talk soon.\n\nOn Thu, Feb 5, 2026 at 9:01 PM Agent <\nagent@example.com> wrote:\n\n> our counter offer is attached')).toBe('general')
    expect(cat('Sounds good.\n> the counter offer is attached')).toBe('general')
    expect(cat('Thanks!\n\nFrom: Agent <agent@example.com>\nSent: Thursday, October 16, 2025 3:03 PM\nSubject: counter offer')).toBe('general')
  })

  it('a forwarded message is kept: the broker forwarded it on purpose', () => {
    expect(stripQuotedHistory('Made a few tweaks.\n\n---------- Forwarded message ---------\nFrom: A <a@x.com>\nDate: Fri\n\nthe counter offer')).toContain(
      'counter offer',
    )
  })

  it('a title company signature is not escrow mail: "Western Title & Escrow Company" never decides', () => {
    expect(cat(`You are invited to our holiday event!\n\n${TITLE_SIGNATURE}`)).toBe('general')
    expect(cat('Escrow number WT0291454 is open.')).toBe('escrow_title')
    // An invitation to many, from a title officer on many files, with one client on it, files nowhere.
    const d = decide4(
      mail({
        from: ['tonya.moore@westerntitle.com'],
        to: ['transactions@bridgetownfiles.com', 'otherofficer@westerntitle.com', 'guest.one@example.com'],
        sentAt: '2026-09-01T17:00:00Z',
        subject: 'Western Title Redmond Holiday Event',
        body: `Join us for our holiday event!\n\n${TITLE_SIGNATURE}`,
        attachments: [{ name: 'Holiday Flyer.pdf' }],
      }),
    )
    expect(d.dealId).toBeNull()
  })

  it('pricing talk to a prospective seller is not a transaction ("your purchase price", "for appraisal purposes")', () => {
    expect(cat('Applying this decline to your purchase price gives an estimate. It is important to nail the pricing for appraisal purposes.')).toBe('general')
    const d = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['prospect@example.com'],
        subject: '22993 Ghost Tree Ln',
        body: 'Attached is the seller report. Applying this decline to your purchase price gives an estimate. It is important to nail the pricing for appraisal purposes.',
        attachments: [{ name: '22993_Ghost_Tree_Ln_Seller_Report.pdf' }],
      }),
    )
    expect(d.status).toBe('not_deal')
  })

  it('marketing mail never reads as a transaction from its body', () => {
    expect(cat('Lock in your closing date and lower your earnest money! Unsubscribe here.')).toBe('general')
    expect(cat('Lock in your closing date and lower your earnest money!', true)).toBe('general')
    const d = decide4(
      mail({
        from: ['promo@lenderads.example'],
        subject: 'Rates for buyers of 20702 Beaumont Drive',
        body: 'Lock in your closing date and lower your earnest money! Unsubscribe here.',
      }),
    )
    expect(d.status).toBe('not_deal')
  })

  it('transaction mail for a property with no file is kept when only the body says so (61260 Sunflower counter)', () => {
    const d = decide4(
      mail({
        from: ['otheragent@gmail.com'],
        to: ['rebeccapeterson@ryan-realty.com'],
        subject: 'Re: 61260 Sunflower Lane',
        body: 'We will be leaving this afternoon and I wanted to allow extra time for your clients to decide on our counter offfer.',
      }),
    )
    expect(d.status).toBe('unfiled_transaction')
    expect(d.category).toBe('counter')
    expect(d.propertyHint).toBe('61260 sunflower')
  })
})

describe('v4 defect 5: a comps report is not about its comps', () => {
  const cmaText =
    'Comparable Market Analysis 19496 Tumalo Reservoir Road, Bend, OR, 97703 Prepared for the sellers. ' +
    'CMA 19496 Tumalo Reservoir Road , Bend OR 97703 Subject 19496 Tumalo Reservoir Road , Bend OR 97703 ' +
    '1 65130 Highland Road , Bend OR 97703 220198308 Closed 5 64350 Old Bend Redmond Hwy , Bend OR 97703 220205567 Closed ' +
    'Subject 19496 Tumalo Reservoir Road Bend OR 97703 64350 Old Bend Redmond Hwy Bend OR'

  it('an email to our sellers with a comps PDF files to their deal, never to the sold comp that is also our file', () => {
    const tumaloSellers: DealFacts = { ...tumalo, partyEmails: ['seller.one@example.com'] }
    const d = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['seller.one@example.com'],
        sentAt: '2026-01-20T22:47:00Z',
        subject: "Today's Call at 530",
        body: 'Looking forward to the call.',
        attachments: [{ name: '19496 TRR Comps.pdf', text: cmaText }],
      }),
      null,
      [...V4_DEALS.filter((x) => x.dealId !== 'tumalo'), tumaloSellers],
    )
    expect(d.dealId).toBe('tumalo')
    expect(d.candidates.map((c) => c.dealId)).not.toContain('old-bend')
  })

  it('knows a comps report by its name or its first page', () => {
    expect(isComparablesReport({ name: '820 comps.pdf' })).toBe(true)
    expect(isComparablesReport({ name: 'report.pdf', text: cmaText })).toBe(true)
    expect(isComparablesReport({ name: 'Sale_Agreement.pdf', text: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT' })).toBe(false)
  })

  it('a CMA for a property with no file, listing our closed deal as a comp, files nowhere', () => {
    const d = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['prospect@example.com'],
        sentAt: '2025-10-01T17:00:00Z',
        subject: 'Your home value',
        attachments: [
          {
            name: 'CMA.pdf',
            text: 'Comparative Market Analysis 123 Pine Street, Bend. Subject 123 Pine Street. Subject 123 Pine Street. Comp 64350 Old Bend Redmond Hwy 220205567 Closed',
          },
        ],
      }),
    )
    expect(d.dealId).toBeNull()
  })
})

describe('v4 defect 6: the cycle the message itself names', () => {
  it("title mail with the first contract's escrow number goes to the canceled cycle it belongs to", () => {
    const d = decide4(
      mail({ from: ['tonya.moore@westerntitle.com'], sentAt: '2025-08-06T18:52:00Z', subject: 'Open Escrow # WT0277448 Property: 64350 Old Bend Redmond Hwy Bend, OR 97703' }),
    )
    expect(d.dealId).toBe('old-bend')
    expect(d.cycleId).toBe('ob-canceled')
  })

  it("the second contract's escrow number goes to the closed cycle", () => {
    const d = decide4(
      mail({ from: ['tonya.moore@westerntitle.com'], sentAt: '2025-08-28T23:32:00Z', subject: 'Open Escrow # WT0278291 Property: 64350 Old Bend Redmond Highway Bend, OR 97703' }),
    )
    expect(d.cycleId).toBe('ob-closed')
  })

  it('an agreement naming the first buyers goes to their cycle, the second buyers to theirs', () => {
    expect(pickCycleForMail(oldBend.cycles, '2025-08-26T16:00:00Z', 'signing_notice', { text: 'Buyer: Avery Firstcycle and Casey Firstcycle. Seller: Sample Family Trust.' })).toBe(
      'ob-canceled',
    )
    expect(pickCycleForMail(oldBend.cycles, '2025-08-12T16:00:00Z', 'signing_notice', { text: 'Buyer: Jordan Secondcycle.' })).toBe('ob-closed')
  })

  it('a termination goes to the cycle it terminates, never the closed one or the listing', () => {
    const env = decide4(
      mail({
        from: ['noreply@skyslope.com'],
        sentAt: '2025-08-16T18:07:00Z',
        subject: 'Envelope completed: Termination Agreement | 64350 Old Bend Redmond Hwy',
        attachments: [{ name: 'Termination_Agreement.pdf' }, { name: 'Addendum-_Termination.pdf' }],
      }),
    )
    expect(env.cycleId).toBe('ob-canceled')
    const ours = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['tonya.moore@westerntitle.com'],
        sentAt: '2025-08-16T17:00:00Z',
        subject: 'Termination agreement - Old Bend Redmond Hwy',
        attachments: [{ name: 'Termination_Agreement_-_057_OREF.pdf' }, { name: 'Addendum_to_Sale_Agreement_2_-_002_OREF.pdf' }],
      }),
    )
    expect(ours.dealId).toBe('old-bend')
    expect(ours.cycleId).toBe('ob-canceled')
  })

  it('mail while the first contract was live goes to it; mail after the second closed goes to the closed one', () => {
    expect(pickCycleForMail(oldBend.cycles, '2025-08-10T16:00:00Z', 'escrow_title')).toBe('ob-canceled')
    expect(pickCycleForMail(oldBend.cycles, '2025-09-10T16:00:00Z', 'escrow_title')).toBe('ob-closed')
    expect(pickCycleForMail(oldBend.cycles, '2025-11-01T16:00:00Z', 'post_close')).toBe('ob-closed')
  })
})

describe('v4 defect 7: compound street names with or without the space', () => {
  it('"Schoolhouse Rd." is School House Rd, and the other way round', () => {
    const sh = parseDealAddress('56111 School House Rd, Bend, OR, 97707')!
    expect(mentionsDealAddress('Septic inspection - 56111 Schoolhouse Rd.', sh)).toBe(true)
    expect(mentionsDealStreet('Schoolhouse Rd.', sh)).toBe(true)
    expect(mentionsBareStreet('Re: Schoolhouse walkthrough', sh)).toBe(true)
    const joined = parseDealAddress('56111 Schoolhouse Rd, Bend, OR, 97707')!
    expect(mentionsDealAddress('56111 School House Rd', joined)).toBe(true)
    expect(mentionsDealStreet('School House Road', joined)).toBe(true)
    expect(mentionsDealAddress('56111 Schools', sh)).toBe(false)
  })

  it('files the spelled-together address', () => {
    const d = decide4(mail({ from: ['noreply@skyslope.com'], sentAt: '2026-04-14T17:00:00Z', subject: 'Envelope completed: Septic Addendum | 56111 Schoolhouse Rd.' }))
    expect(d.dealId).toBe('school-house')
  })
})

describe('v4 defect 8: a house number and a noun are not another property', () => {
  it('"19496 Septic Invoice" from the other agent on 19496 Tumalo files there', () => {
    const d = decide4(mail({ from: ['shana@shanasellers.com'], subject: '19496 Septic Invoice', attachments: [{ name: 'Invoice 4471.pdf' }] }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('tumalo')
  })

  it('a real other property from the same sender still does not file by sender', () => {
    expect(decide4(mail({ from: ['shana@shanasellers.com'], subject: 'Offer on 19496 Pine Street', attachments: [{ name: 'Offer.pdf' }] })).dealId).toBeNull()
    expect(decide4(mail({ from: ['shana@shanasellers.com'], subject: 'Offer on 1450 Revere Ave', attachments: [{ name: 'Offer.pdf' }] })).dealId).toBeNull()
  })
})

describe('v4 defect 9: SkySlope per-file addresses name the property', () => {
  it('reads the street and house number from the local part', () => {
    const be = parseDealAddress('20702 Beaumont Drive, Bend, OR, 97701')!
    expect(platformAliasNamesDeal(['BeaumontDrive2070260b4@skyslope.com'], be)).toBe(true)
    expect(platformAliasNamesDeal(['BeaumontDrive20702@skyslope.com'], be)).toBe(true)
    expect(platformAliasNamesDeal(['BeaumontDrive1234@skyslope.com'], be)).toBe(false)
    expect(platformAliasNamesDeal(['BeaumontDrive2070260b4@example.com'], be)).toBe(false)
    expect(platformAliasNamesDeal(['SchoolHouseRd561112@skyslope.com'], parseDealAddress('56111 School House Rd, Bend')!)).toBe(true)
    expect(platformAliasNamesDeal(['SW45thStreet3480@skyslope.com'], parseDealAddress('3480 SW 45th Street, Redmond')!)).toBe(true)
    expect(platformAliasNamesDeal(['NEButlerMarketRd105017@skyslope.com'], parseDealAddress('1050 NE Butler Market Rd, Bend')!)).toBe(true)
  })

  it('"Fwd: Deck Receipt" to the Beaumont file address files to Beaumont', () => {
    const d = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['BeaumontDrive2070260b4@skyslope.com'],
        sentAt: '2026-05-27T20:20:00Z',
        subject: 'Fwd: Deck Receipt',
        attachments: [{ name: 'Truss Receipt - 2026-05-19.pdf' }],
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })
})

describe('v4 defect 10: our own machines are not deal mail', () => {
  it("Studio drafts from the Resend sandbox and the site's lead notices never file, whatever they name", () => {
    expect(decide4(mail({ from: ['onboarding@resend.dev'], subject: 'listing reel draft v2 - 20702 Beaumont Drive' })).status).toBe('bulk')
    expect(decide4(mail({ from: ['onboarding@resend.dev'], subject: '5 approved photos', body: 'MLS 220199105' })).status).toBe('bulk')
    expect(
      decide4(mail({ from: ['notifications@mail.ryan-realty.com'], subject: 'New lead: home value request', body: 'Address: 19496 Tumalo Reservoir Rd. MLS 220215931' })).status,
    ).toBe('bulk')
    expect(categorizeMail({ subject: '[Notice] Something', body: '', attachments: [], autoReply: false, fromHouseSystem: false })).toBe('system_alert')
  })
})

describe('v4 defect 11: a person on the file by name only', () => {
  const beaumontNamed: DealFacts = { ...beaumont, contactNames: ['Pat Otheragent'] }
  const deals = [...V4_DEALS.filter((d) => d.dealId !== 'beaumont'), beaumontNamed]

  it("the other agent's name on the To line picks the file among the shared TC's several (FHA Addendum thread)", () => {
    const d = decide4(
      mail({
        from: ['lender.one@newlender.example'],
        to: ['someagent@gmail.com'],
        cc: ['transactions@bridgetownfiles.com', 'matt@ryan-realty.com'],
        people: [
          { email: 'lender.one@newlender.example', name: 'Lee Lender', role: 'from' },
          { email: 'someagent@gmail.com', name: 'pat Otheragent', role: 'to' },
          { email: 'transactions@bridgetownfiles.com', name: 'TC Desk', role: 'cc' },
        ],
        sentAt: '2026-05-20T14:47:00Z',
        subject: 'RE: FHA Addendum',
      }),
      null,
      deals,
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('beaumont')
  })

  it("the sender named on exactly one file, with a document, files there (\"Fwd: Brandon's Loan\")", () => {
    const d = decide4(
      mail({
        from: ['lee.listside@gmail.com'],
        to: ['matt@ryan-realty.com', 'transactions@bridgetownfiles.com'],
        people: [{ email: 'lee.listside@gmail.com', name: 'Lee Listside', role: 'from' }],
        sentAt: '2026-09-01T17:25:00Z',
        subject: "Fwd: Brandon's Loan",
        attachments: [{ name: 'Amendatory clause to be signed by Seller.pdf' }],
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('jacklight')
  })

  it('one person is one person: on several files by email and one by name, they are on none uniquely ("Client Appreciation" BCC)', () => {
    // The title officer is a contact by email on Beaumont, and on Nordic by name only (a row with no email).
    const nordicNamed: DealFacts = { ...nordic, contactEmails: [], contactNames: ['Tonya Moore'] }
    const tumaloWithOfficer: DealFacts = { ...tumalo, contactEmails: [...tumalo.contactEmails, 'tonya.moore@westerntitle.com'] }
    const d = decide4(
      mail({
        from: ['tonya.moore@westerntitle.com'],
        to: ['tonya.moore@westerntitle.com'],
        people: [
          { email: 'tonya.moore@westerntitle.com', name: 'Moore, Tonya', role: 'from' },
          { email: 'tonya.moore@westerntitle.com', name: 'Moore, Tonya', role: 'to' },
        ],
        sentAt: '2026-09-01T17:00:00Z',
        subject: 'Client Appreciation',
        attachments: [{ name: 'Redmond Summer Open House.pdf' }],
      }),
      null,
      [...V4_DEALS.filter((x) => x.dealId !== 'nordic' && x.dealId !== 'tumalo'), nordicNamed, tumaloWithOfficer],
    )
    expect(d.dealId).toBeNull()
  })

  it('a first name alone, and our own brokers on a platform sender, never count', () => {
    expect(personNameMatches('Lee', 'Lee Listside')).toBe(false)
    expect(personNameMatches('Listside, Lee', 'Lee Listside')).toBe(true)
    const d = decide4(
      mail({ from: ['noreply@skyslope.com'], people: [{ email: 'noreply@skyslope.com', name: 'Matt Ryan', role: 'from' }], subject: 'Your weekly summary' }),
      null,
      [...deals, { ...schoolHouse, dealId: 'school-house-named', contactNames: ['Matt Ryan'] }],
    )
    expect(d.status).toBe('not_deal')
  })
})

describe('v4 defect 12: a typo in the house number is not another property', () => {
  it('"SPD\'s for 2372 NW Ordway" from the other agent on 2732 Ordway files there', () => {
    const d = decide4(
      mail({ from: ['otheragent@garnerlike.com'], sentAt: '2025-05-08T01:26:00Z', subject: "SPD's for 2372 NW Ordway", attachments: [{ name: 'SKM_C450i25050717260.pdf' }] }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('ordway')
  })

  it('"2731 Ordway Title Report" from us to the title officer on 2732 Ordway files there', () => {
    const d = decide4(mail({ from: ['matt@ryan-realty.com'], to: ['titleofficer@westerntitle.com'], sentAt: '2025-05-15T23:05:00Z', subject: '2731 Ordway Title Report' }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('ordway')
  })
})

describe('v4 defect 12, the dry run on real mail: a mistyped house number on our street names the file', () => {
  it('"2731 Ordway Title Report" to a title officer on no file still files to 2732 Ordway (196d63218a29b738)', () => {
    const d = decide4(mail({ from: ['matt@ryan-realty.com'], to: ['another.officer@westerntitle.com'], sentAt: '2025-05-15T23:05:00Z', subject: '2731 Ordway Title Report' }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('ordway')
  })

  it("a stranger's ordinary mail about a neighbouring number files nowhere, and two-word names must match both words", () => {
    expect(decide4(mail({ from: ['someone@example.com'], sentAt: '2025-05-15T23:05:00Z', subject: '2733 Ordway garage sale' })).dealId).toBeNull()
    expect(decide4(mail({ from: ['matt@ryan-realty.com'], to: ['x@example.com'], sentAt: '2025-08-10T17:00:00Z', subject: '64351 Old Mill Title Report' })).dealId).toBeNull()
  })

  it('the property hint is the house number and street, not the next word of the subject', () => {
    expect(propertyInSubject('61260 Sunflower Email to Deb')).toBe('61260 sunflower')
    expect(propertyInSubject('19496 Septic Invoice')).toBe('19496 septic')
    expect(propertyInSubject('Re: 61260 Sunflower Lane')).toBe('61260 sunflower')
  })
})

describe('v4, the dry run on real mail: our own words about a file by its street', () => {
  it('broker-to-broker mail calling a file by its street files there, transaction words or not ("Re: More Clarification on Nordic PA")', () => {
    const d = decide4(mail({ from: ['matt@ryan-realty.com'], to: ['rebeccapeterson@ryan-realty.com'], sentAt: '2026-08-30T14:54:00Z', subject: 'Re: More Clarification on Nordic PA' }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('nordic')
  })

  it('an e-sign platform sending as our broker is our own transaction mail ("Nordic Counteroffer (Buyer #2)" from noreply@skyslope.com)', () => {
    const d = decide4(
      mail({
        from: ['noreply@skyslope.com'],
        to: ['rebeccapeterson@ryan-realty.com'],
        people: [{ email: 'noreply@skyslope.com', name: 'Rebecca Peterson', role: 'from' }],
        sentAt: '2026-08-23T20:35:00Z',
        subject: 'Nordic Counteroffer (Buyer #2)',
      }),
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('nordic')
  })

  it('a stranger calling a street by name is still not a filing', () => {
    expect(decide4(mail({ from: ['skis@example.com'], subject: 'Nordic skiing this weekend?' })).dealId).toBeNull()
  })

  it('between brokers, with no transaction words, a short common street word is not the file ("Test Email" is not 1234 Test Street)', () => {
    const testStreet: DealFacts = { ...nordic, dealId: 'test-street', address: '1234 Test Street, Bend, OR', subdivisions: [] }
    const bluff: DealFacts = { ...nordic, dealId: 'bluff', address: '363 SW Bluff Dr, Bend, OR', subdivisions: [] }
    const deals = [...V4_DEALS, testStreet, bluff]
    expect(decide4(mail({ from: ['paul@ryan-realty.com'], to: ['matt@ryan-realty.com'], subject: 'Test Email' }), null, deals).dealId).toBeNull()
    expect(decide4(mail({ from: ['paul@ryan-realty.com'], to: ['matt@ryan-realty.com'], subject: 'Called his bluff' }), null, deals).dealId).toBeNull()
  })
})

describe('v4, the dry run on real mail: a subject naming a property is worth reading in full', () => {
  it('pass 1 reads on when the subject names a property, even when the snippet reads as ordinary mail (61260 Sunflower counter)', () => {
    const snippetOnly = decide4(
      mail({ from: ['otheragent@gmail.com'], to: ['rebeccapeterson@ryan-realty.com'], subject: 'Re: 61260 Sunflower Lane', body: 'Hi Rebecca, I had a long couple days.' }),
    )
    expect(snippetOnly.status).toBe('not_deal')
    expect(worthFullRead(snippetOnly, false)).toBe(true)
    expect(worthFullRead(decide4(mail({ from: ['news@example.com'], subject: 'Weekly tips' })), false)).toBe(false)
  })
})

describe('v4 defect 13: machines writing to a client are not that client', () => {
  it('an automated sender scores no party or contact evidence from its recipients', () => {
    const d = decide4(mail({ from: ['no-reply@accounts.example.com'], to: ['realestatetiffany@gmail.com'], sentAt: '2026-05-20T17:00:00Z', subject: 'Security alert' }))
    expect(d.status).toBe('not_deal')
    expect(d.candidates).toEqual([])
  })

  it("a listing report a service sends our sellers as the broker still files (ListTrac, alert@listtrac.com)", () => {
    const tumaloSellers: DealFacts = { ...tumalo, partyEmails: ['seller.one@example.com'] }
    const d = decide4(
      mail({
        from: ['alert@listtrac.com'],
        to: ['seller.one@example.com'],
        cc: ['matt@ryan-realty.com'],
        people: [{ email: 'alert@listtrac.com', name: 'Matt Ryan', role: 'from' }],
        subject: 'Your Listing - Weekly Report of Online Activity',
        body: 'Here is a summary of online activity for your listing. Forward Report for 19496 Tumalo Reservoir Rd, Bend, OR 97703. 4004 property views.',
      }),
      null,
      [...V4_DEALS.filter((x) => x.dealId !== 'tumalo'), tumaloSellers],
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('tumalo')
  })

  it('a queued row the rules now drop leaves the queue', () => {
    expect(queuedRowAfterRedecide('not_deal')).toBe('dismissed')
    expect(queuedRowAfterRedecide('bulk')).toBe('dismissed')
    expect(queuedRowAfterRedecide('ambiguous')).toBeNull()
    expect(queuedRowAfterRedecide('error')).toBeNull()
  })
})

describe('v4 defect 14: the subdivision is a nickname for the file', () => {
  it('"Valhalla Heights" from the TC on several files picks 2680 NW Nordic', () => {
    const d = decide4(mail({ from: ['transactions@bridgetownfiles.com'], sentAt: '2026-09-01T17:00:00Z', subject: 'Valhalla Heights - HOA docs', attachments: [{ name: 'HOA.pdf' }] }))
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('nordic')
  })

  it('never a subdivision two open files share, and never a placeholder', () => {
    const a: DealFacts = { ...nordic, dealId: 'red-a', address: '122 SW 10th Street, Redmond, OR', subdivisions: ['Townsite Of Redmond'] }
    const b: DealFacts = { ...nordic, dealId: 'red-b', address: '218 SW 4th St, Redmond, OR', subdivisions: ['Townsite Of Redmond'] }
    const c: DealFacts = { ...nordic, dealId: 'na', address: '64350 Old Bend Redmond Hwy, Bend', subdivisions: ['N/A'] }
    const deals = [a, b, c]
    expect(decide4(mail({ from: ['transactions@bridgetownfiles.com'], subject: 'Townsite Of Redmond - docs', attachments: [{ name: 'x.pdf' }] }), null, deals).dealId).toBeNull()
    expect(decide4(mail({ from: ['transactions@bridgetownfiles.com'], subject: 'N/A docs', attachments: [{ name: 'x.pdf' }] }), null, deals).dealId).toBeNull()
  })
})

describe('v4 defect 15: a thread never outvotes the message that names another of our files', () => {
  // Supra reuses one Gmail thread per sender across every property it reports on.
  const sunstone: DealFacts = { ...fortyFifth, dealId: 'sunstone', address: '56628 Sunstone Loop, Bend, OR, 97707', stage: 'dead', cycles: [] }
  const drouillard: DealFacts = { ...nordic, dealId: 'drouillard', address: '2354 NW Drouillard Ave, Bend, OR, 97703', stage: 'closed', subdivisions: [] }
  const mayfield: DealFacts = { ...nordic, dealId: 'mayfield', address: '17130 Mayfield Drive, Bend, OR, 97707', stage: 'closed', subdivisions: [] }
  const deals = [...V4_DEALS, sunstone, drouillard, mayfield]
  const supra = (body: string) =>
    mail({ from: ['suprashowing@suprasystems.com'], sentAt: '2025-11-13T18:46:00Z', subject: 'Supra Showings - New Showing Notification', body })

  it('a Supra notice naming one of our listings files there, and the unrelated thread file is not even a candidate', () => {
    const d = decide4(
      supra('The showing by an agent at 2354 Drouillard Avenue, Bend, OR 97703 (KeyBox# 31714201) began 11/13/2025 10:45AM'),
      { dealId: 'sunstone', method: 'address' },
      deals,
    )
    expect(d.dealId).toBe('drouillard')
    expect(d.candidates.map((c) => c.dealId)).not.toContain('sunstone')
  })

  it('naming two of ours is a choice between those two, never the thread file (19a7e8a7fddeec36)', () => {
    const d = decide4(
      supra(
        'The showing by an agent at 2354 Drouillard Avenue, Bend, OR 97703 (KeyBox# 31714201) began 11/13/2025 10:45AM\n' +
          ' by an agent at 17130 Mayfield Drive, Bend, OR 97707 (KeyBox# 34345373) began 11/13/2025 10:44AM',
      ),
      { dealId: 'sunstone', method: 'address' },
      deals,
    )
    expect(d.status).toBe('ambiguous')
    expect(d.candidates.map((c) => c.dealId).sort()).toEqual(['drouillard', 'mayfield'])
  })

  it("when the message names its thread's file and another, the thread still breaks the tie (\"Re: Question Regarding Contract Termination\")", () => {
    const d = decide4(
      mail({
        from: ['matt@ryan-realty.com'],
        to: ['legal@realtorsassociation.example'],
        sentAt: '2025-11-13T18:46:00Z',
        subject: 'Re: Question Regarding Contract Termination',
        body: 'The buyers of 17130 Mayfield Drive may terminate; the sale of 2354 NW Drouillard Ave is their contingency.',
      }),
      { dealId: 'mayfield', method: 'address' },
      deals,
    )
    expect(d.status).toBe('filed')
    expect(d.dealId).toBe('mayfield')
  })

  it('a Supra notice naming none of ours still follows its thread (136 correct thread filings)', () => {
    const d = decide4(supra('For additional information on your showings please login to SupraWEB.'), { dealId: 'drouillard', method: 'address' }, deals)
    expect(d.dealId).toBe('drouillard')
    expect(d.method).toBe('thread')
  })
})
