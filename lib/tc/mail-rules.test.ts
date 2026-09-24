import { describe, expect, it } from 'vitest'
import {
  categorizeMail,
  dealOpenAt,
  decideMailFiling,
  isHouseAddress,
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
    const d = decide(mail({ from: ['admin@ryan-realty.com'], subject: 'When is the walkthrough?' }))
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
