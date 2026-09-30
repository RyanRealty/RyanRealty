/**
 * A word in the owner's name that prints as a street is the street, not the
 * owner. The live case (verified 2026-09-30): an owner whose surname is Russell,
 * a subject at 20705 Snow Peaks, and a neighbourhood with comps on Russell. The
 * letter has to print those comps, and the owner-name check refused it for the
 * street. The first name below is made up; the surname keeps the shape of the row.
 *
 * The other half matters as much: the owner's name still fails wherever it is a
 * name, including on the same page as a street of the same spelling.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateLetterConsistencyContract } from '@/lib/cma/letter-consistency'
import { letterContainsOwnerContactNames, letterOwnerNameCheck, ownerNameTokenHits } from '@/lib/cma/letter-privacy'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import {
  everyOccurrenceIsStreet,
  printedAddressesOf,
  printedAddressMatchers,
  printedAddressSpans,
  printedStreetWords,
  streetSignalAt,
} from '@/lib/cma/street-context'
import {
  AMBIGUOUS_STREET_SUFFIXES,
  PRINTED_STREET_SUFFIXES,
  STREET_DIRECTIONALS,
  STREET_SUFFIXES,
} from '@/lib/cma/street-words'
import type { CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const OWNER = { clientName: 'Ada Russell' }
const PRINTED = ['20705 Snow Peaks', '20726 Russell Rd', '1420 NE Fir St']

const passes = (text: string, owner = OWNER, printedAddresses?: string[]) =>
  letterOwnerNameCheck(`<p>${text}</p>`, owner, { printedAddresses }).pass

describe('a street named like the owner is not the owner', () => {
  it.each([
    '20726 Russell Rd',
    '20726 NE Russell Road',
    'on Russell Road',
    '20726 Russell',
    '20726 NW Russell Rd, Bend, OR 97701',
    '20726 N. Russell St.',
    '20726 RUSSELL RD',
    '20726 Northwest Russell Avenue',
    '20726 Russell Ln #5',
    '20726B Russell',
    'Russell Rd,',
    'Comps on Russell Loop and Russell Ct sold quickly.',
    'Prepared Sep 29, 2026 20726 Russell · What happened',
    'Built 1998, 3 bed, 2 bath, 1,800 sqft, 20726 Russell',
    'The sale at 20726 Russell Rd closed at $640,000 and the one at 20730 Russell Rd at $655,000.',
    'Sales on Russell Road ran $640,000 to $655,000.',
  ])('passes: %s', (text) => {
    const check = letterOwnerNameCheck(`<p>${text}</p>`, OWNER)
    expect(check.pass).toBe(true)
    expect(check.detail).toBe('Owner/contact name tokens are absent from the letter and email draft.')
    expect(ownerNameTokenHits(text, OWNER)).toEqual([])
  })

  it('passes a whole comp table that prints the street in each cell the way the template does', () => {
    const table =
      '<table><tr><td class="addr"><a href="/x">20726 Russell Rd</a></td><td>Bend</td><td>3</td></tr>' +
      '<tr><td class="addr"><a href="/y">20730 NE Russell Road</a></td><td>Bend</td><td>4</td></tr></table>' +
      '<p>Two closed sales on Russell Road support the range.</p>'
    expect(letterOwnerNameCheck(table, OWNER).pass).toBe(true)
  })

  it('names only the tokens that hit when the street clears one and the first name does not', () => {
    const text = '<p>20726 Russell Rd sold. Hi Ada, the range is ready.</p>'
    expect(ownerNameTokenHits(text, OWNER)).toEqual(['Ada'])
    expect(letterOwnerNameCheck(text, OWNER).detail).toBe(
      'Letter or email draft printed owner/contact name token(s): Ada.',
    )
  })
})

describe('the owner is still the owner', () => {
  it.each([
    'Dear Mr. Russell,',
    'Mrs Russell asked for a call.',
    'MR. RUSSELL will consider offers.',
    'Ms.Russell is the seller.',
    'the Russell family',
    "Russell's home sat for 143 days.",
    'Russell’s home sat for 143 days.',
    'Hi Russell, the range is ready.',
    'Russell, thanks for your time.',
    'Russell called us about the price.',
    'Sincerely, Russell',
    'Prepared for Russell by Matt Ryan.',
    'To: Russell',
    'Ada Russell asked about the roof.',
    'Russell Ada asked about the roof.',
    'Prepared for Ada Russell.',
  ])('fails: %s', (text) => {
    const check = letterOwnerNameCheck(`<p>${text}</p>`, OWNER)
    expect(check.pass).toBe(false)
    expect(letterContainsOwnerContactNames(text, OWNER)).toBe(true)
  })

  it('still reads a greeting or an honorific across markup, as it always did', () => {
    expect(letterOwnerNameCheck('<p><b>Hi</b> <i>Russell</i>, the range is ready.</p>', OWNER).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Dear <b>Mr.</b> <i>Russell</i>,</p>', OWNER).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Prepared for <em>Ada</em> <em>Russell</em>.</p>', OWNER).pass).toBe(false)
  })

  it('fails on the surname alone when the owner has only that one name', () => {
    const only = { clientName: 'Russell' }
    expect(letterOwnerNameCheck('<p>the Russell family</p>', only).pass).toBe(false)
    expect(ownerNameTokenHits('the Russell family', only)).toEqual(['Russell'])
    expect(letterOwnerNameCheck('<p>20726 Russell Rd</p>', only).pass).toBe(true)
  })
})

describe('a street mention does not excuse the owner elsewhere in the same text', () => {
  it.each([
    '20726 Russell Rd sold last spring. Mr. Russell asked about it.',
    'Sales on Russell Road ran high. The Russell family listed in January.',
    '20726 Russell Rd closed at $640,000. Russell called us.',
    "20726 NE Russell Road and 20730 Russell Rd sold. Russell's offer stands.",
    'Russell Rd is close by. Hi Russell, the range is ready.',
    'on Russell Road. Ada Russell asked about the roof.',
  ])('fails: %s', (text) => {
    expect(passes(text)).toBe(false)
    expect(passes(text, OWNER, PRINTED)).toBe(false)
    expect(ownerNameTokenHits(text, OWNER, { printedAddresses: PRINTED })).toContain('Russell')
  })

  it('a hyphenated name is a name, whatever the street does next to it', () => {
    for (const text of [
      '20726 Russell Rd. Russell-Smith called about the offer.',
      '20726 Russell Rd. Smith-Russell called about the offer.',
      '20726 Russell Rd. The Russell-Smith family listed.',
    ]) {
      expect(passes(text)).toBe(false)
      expect(passes(text, OWNER, PRINTED)).toBe(false)
    }
    expect(passes('20726 Russell Rd and 20730 Russell-Rd.', OWNER, PRINTED)).toBe(false)
  })

  it('fails when the street and the name sit in different cells of the same table', () => {
    const html = '<table><tr><td>20726 Russell Rd</td></tr><tr><td>Russell</td></tr></table>'
    expect(letterOwnerNameCheck(html, OWNER).pass).toBe(false)
  })

  it('an honorific or greeting in front of a word that is also followed by a suffix is still a name', () => {
    expect(passes('Dear Mr. Russell Road,')).toBe(false)
    expect(passes('Hi Russell Way, the range is ready.')).toBe(false)
    expect(passes('Mrs Russell Lane asked for a call.')).toBe(false)
  })
})

describe('a bare street name with no address around it is a name', () => {
  it('fails a sentence that only says the name, with or without the addresses the letter prints', () => {
    expect(passes('Russell called us')).toBe(false)
    expect(passes('Russell called us', OWNER, PRINTED)).toBe(false)
    expect(letterOwnerNameCheck('<td>Russell</td>', OWNER).pass).toBe(false)
    expect(passes('on Russell', OWNER, PRINTED)).toBe(false)
    expect(passes('The Russell sale closed at $640,000.', OWNER, PRINTED)).toBe(false)
  })
})

describe('what is not a house number and what is not a suffix', () => {
  it.each([
    'In 2024 Russell wrote to us.',
    'Built in 1998 Russell called.',
    'It sold for $640,000 Russell called.',
    'A 3.5 Russell called.',
    '3/4 Russell called.',
    '1234567 Russell called.',
    '#5 Russell called.',
    'Contact 541-555-1212 Russell.',
    'Contact 541 555 1212 Russell.',
    'Contact (541) 555 1212 Russell.',
    // The sentence carries on about the word: an address ends.
    'Bed 3 Russell said so.',
    'Seller 2 Russell called us.',
    'Since 12 Russell has replaced the roof.',
    // A label or a count is not a house number, and a zip code is not either.
    'Comp 3 Russell',
    'We closed 12 Russell',
    'Bend, OR 97702 Russell',
    'Bend, Oregon 97702 Russell',
    // A zip code and a six digit figure are not house numbers.
    'Bend 97702 Russell',
    'Sold 640000 Russell',
    // "St." and "Dr." start a name as often as they end a street.
    'Meet Russell St. Clair',
    'Russell Dr. Smith asked for a call.',
    // A heading, an entity, or an ordinary word carrying on is not a street.
    'Russell Market Report',
    'The Russell Place Analysis',
    'Offer from Russell Place LLC',
    'Russell Run is the plan',
    'Russell Point of view',
    'Ada Way ahead',
    // A possessive, however the apostrophe was written, names a person.
    "Offer 3 Russell's home.",
    'Offer 3 Russell&#39;s home.',
    'Offer 3 Russell’s home.',
    'Offer 300 Russell&#8217;s home.',
    'Offer 300 Russell&#x2019;s home.',
  ])('fails: %s', (text) => {
    expect(passes(text)).toBe(false)
  })

  it('a short house number needs a suffix or the printed address, and "or" is not the state', () => {
    expect(passes('12 Russell')).toBe(false)
    expect(passes('12 Russell Rd')).toBe(true)
    expect(passes('12 Russell', OWNER, ['12 Russell'])).toBe(true)
    expect(passes('Try Bend or 20726 Russell.')).toBe(true)
    // The zip belongs to the address before it; the number right before the name is a house number.
    expect(passes('Bend, OR 97702 20726 Russell.')).toBe(true)
  })

  it('a year with a directional or a suffix, or a year the letter printed as an address, is an address', () => {
    expect(passes('2024 NE Russell')).toBe(true)
    expect(passes('2024 Russell Rd')).toBe(true)
    expect(passes('2024 Russell', OWNER, ['2024 Russell'])).toBe(true)
    expect(passes('2024 Russell')).toBe(false)
  })

  it('a suffix counts only when it is printed capitalized and does not follow a possessive', () => {
    expect(passes('Ask Russell drive the offer over.')).toBe(false)
    expect(passes('Russell way of doing it')).toBe(false)
    expect(passes("Russell's Place")).toBe(false)
    expect(passes('Russell’s Road')).toBe(false)
  })

  it('a number or a suffix in the next table cell is not an address', () => {
    expect(letterOwnerNameCheck('<td>3</td><td>Russell</td>', OWNER).pass).toBe(false)
    expect(letterOwnerNameCheck('<td>Russell</td><td>Rd</td>', OWNER).pass).toBe(false)
    expect(letterOwnerNameCheck('<span>20726</span><span>Russell</span>', OWNER).pass).toBe(false)
    expect(letterOwnerNameCheck('<td>20726 Russell</td>', OWNER).pass).toBe(true)
    expect(letterOwnerNameCheck('<td>20726&nbsp;Russell&nbsp;Rd</td>', OWNER).pass).toBe(true)
  })
})

describe('the addresses the letter prints clear a street the regex cannot read', () => {
  const PEAKS = { clientName: 'Ada Peaks' }

  it('a two-word street with no suffix fails closed alone and passes with the subject address', () => {
    const text = 'The subject is 20705 Snow Peaks.'
    expect(passes(text, PEAKS)).toBe(false)
    expect(passes(text, PEAKS, PRINTED)).toBe(true)
    expect(passes(text, PEAKS, ['20705 Snow Peaks, Bend, OR 97701'])).toBe(true)
    expect(passes(text, PEAKS, ['20705 NW Snow Peaks Dr'])).toBe(true)
  })

  it('the record and the letter may spell the directional and the suffix differently', () => {
    expect(passes('At 20726 Russell Road.', OWNER, ['20726 NE Russell Rd'])).toBe(true)
    expect(passes('At 20726 NW Snow Peaks Drive.', PEAKS, ['20726 Snow Peaks'])).toBe(true)
    expect(passes('At 1420 NE Fir St.', { clientName: 'Bea Fir' }, ['1420 Fir'])).toBe(true)
  })

  it('a printed address clears the word even when the sentence carries on after it', () => {
    const text = 'The sale at 20726 Russell sold for $640,000.'
    expect(passes(text)).toBe(false)
    expect(passes(text, OWNER, ['20726 Russell'])).toBe(true)
    expect(passes(text, OWNER, ['20726 Russell Rd'])).toBe(true)
  })

  it('a unit on the record is not part of the street', () => {
    expect(passes('At 20705 Snow Peaks.', PEAKS, ['20705 Snow Peaks Unit 5'])).toBe(true)
    expect(passes('At 20705 Snow Peaks.', PEAKS, ['20705 Snow Peaks #5'])).toBe(true)
    expect(passes('At 20705 Snow Peaks.', PEAKS, ['20705 Snow Peaks Apt B, Bend, OR'])).toBe(true)
  })

  it('a suffix that is also the owner name clears inside the printed address only', () => {
    const lane = { clientName: 'Ada Lane' }
    expect(passes('Subject: 10 Cedar Lane.', lane)).toBe(false)
    expect(passes('Subject: 10 Cedar Lane.', lane, ['10 Cedar Lane'])).toBe(true)
    expect(passes('Subject: 10 Cedar Lane. Lane called us.', lane, ['10 Cedar Lane'])).toBe(false)
  })

  it('never clears the name outside the address, and never clears an address the letter did not print', () => {
    expect(passes('At 20705 Snow Peaks. Peaks called us.', PEAKS, PRINTED)).toBe(false)
    expect(passes('At 20705 Snow Peaks. Mr. Peaks asked.', PEAKS, PRINTED)).toBe(false)
    expect(passes('At 20999 Snow Peaks.', PEAKS, PRINTED)).toBe(false)
    expect(passes('At 20705 Snow Peaks.', PEAKS, ['20705 Cedar'])).toBe(false)
  })

  it('an address with no house number, or none at all, anchors nothing', () => {
    expect(printedAddressMatchers([null, undefined, '', 'Snow Peaks', 'Bend, OR', '  '])).toEqual([])
    expect(passes('At 20705 Snow Peaks.', PEAKS, ['Snow Peaks'])).toBe(false)
    expect(passes('At 20705 Snow Peaks.', PEAKS, null as unknown as string[])).toBe(false)
  })

  it('duplicate addresses compile once', () => {
    expect(printedAddressMatchers(['20726 Russell Rd', '20726 Russell Road', '20726 NE Russell Rd']).length).toBe(1)
  })

  it('says which of the three signals cleared an occurrence, and null when none did', () => {
    const at = (text: string, word: string, printed: string[] = []) => {
      const start = text.indexOf(word)
      return streetSignalAt(text, start, start + word.length, printedAddressSpans(text, printedAddressMatchers(printed)))
    }
    expect(at('at 20726 Russell Rd', 'Russell')).toBe('house-number')
    expect(at('on Russell Road', 'Russell')).toBe('suffix')
    expect(at('at 20705 Snow Peaks', 'Peaks', ['20705 Snow Peaks'])).toBe('printed-address')
    expect(at('at 20705 Snow Peaks Rd', 'Peaks', ['20705 Snow Peaks'])).toBe('printed-address')
    expect(at('at 20705 Snow Peaks', 'Peaks')).toBeNull()
    expect(at('Russell called us', 'Russell', PRINTED)).toBeNull()
  })

  it('reads spans in the text and answers on the occurrences of one word', () => {
    const text = '20705 Snow Peaks and Peaks and 20726 Russell Rd'
    const spans = printedAddressSpans(text, printedAddressMatchers(PRINTED))
    expect(spans.length).toBe(2)
    expect(everyOccurrenceIsStreet(text, 'Russell', spans)).toBe(true)
    expect(everyOccurrenceIsStreet(text, 'Peaks', spans)).toBe(false)
    expect(everyOccurrenceIsStreet(text, 'Absent', spans)).toBe(false)
  })
})

describe('with the document’s own addresses in hand, the number and suffix signals clear only its street names', () => {
  const printed = ['20726 Russell Rd', '1420 NE Fir St']

  it('another house on a printed street, and a suffix mention of it, still clear', () => {
    expect(passes('At 20730 Russell.', OWNER, printed)).toBe(true)
    expect(passes('At 20730 NE Russell.', OWNER, printed)).toBe(true)
    expect(passes('Sales on Russell Road ran high.', OWNER, printed)).toBe(true)
  })

  it('a word that is not one of those streets is left to the name rules', () => {
    // Without addresses the number and the suffix are all there is, and they clear any word.
    expect(passes('At 20730 Ada.')).toBe(true)
    expect(passes('Sales on Ada Road.')).toBe(true)
    // With them, "Ada" is not a street of this document, so the same text is a name.
    expect(passes('At 20730 Ada.', OWNER, printed)).toBe(false)
    expect(passes('Sales on Ada Road.', OWNER, printed)).toBe(false)
    expect(passes('Ada Way.', OWNER, printed)).toBe(false)
  })

  it('a record that came back empty is strict, not loose; no record at all is unknown', () => {
    // Unknown: the number is all there is, and it clears the word.
    expect(passes('At 20730 Russell.')).toBe(true)
    expect(passes('At 20730 Russell.', OWNER, null as unknown as string[])).toBe(true)
    // Known but empty (a template that stopped printing the keys): nothing is cleared.
    expect(passes('At 20730 Russell.', OWNER, [])).toBe(false)
    expect(passes('Sales on Russell Road.', OWNER, [])).toBe(false)
    // Known, but nothing in it has a house number to read: still known, still strict.
    expect(passes('At 20730 Russell.', OWNER, ['Bend, OR'])).toBe(false)
  })

  it('reads the street-name words of what the document prints', () => {
    expect(
      [...printedStreetWords(['20705 Snow Peaks, Bend, OR', '20726 NE Russell Rd', '123 South St', 'Bend, OR', null, ''])].sort(),
    ).toEqual(['peaks', 'russell', 'snow', 'south'])
    expect(printedStreetWords(null).size).toBe(0)
  })

  it('a street named for a direction keeps its name: "123 South St" is the street South', () => {
    const [matcher] = printedAddressMatchers(['123 South St'])
    expect(matcher).toBeDefined()
    expect('at 123 South St.'.match(matcher!)?.[0]).toBe('123 South St')
    expect('at 123 South.'.match(matcher!)?.[0]).toBe('123 South')
    expect(passes('At 123 South St.', { clientName: 'Ada South' }, ['123 South St'])).toBe(true)
    expect(passes('At 123 South St. South called us.', { clientName: 'Ada South' }, ['123 South St'])).toBe(false)
  })
})

describe('the words the street signals read come from one place', () => {
  it('reads the suffix and directional sets the address parser reads', () => {
    for (const word of ['rd', 'road', 'loop', 'blvd', 'way']) expect(STREET_SUFFIXES.has(word)).toBe(true)
    for (const word of ['ne', 'nw', 'se', 'sw', 'n', 's', 'e', 'w']) expect(STREET_DIRECTIONALS.has(word)).toBe(true)
  })

  it('the printed suffixes are the parser suffixes plus the ones the parser must leave on', () => {
    for (const word of STREET_SUFFIXES) expect(PRINTED_STREET_SUFFIXES.has(word)).toBe(true)
    for (const word of ['mkt', 'market', 'pass', 'butte', 'ridge', 'rim']) {
      expect(PRINTED_STREET_SUFFIXES.has(word)).toBe(true)
      expect(STREET_SUFFIXES.has(word)).toBe(false)
    }
    for (const word of AMBIGUOUS_STREET_SUFFIXES) expect(PRINTED_STREET_SUFFIXES.has(word)).toBe(true)
  })

  // Real street types: a sentence may carry on after them.
  const STRONG = ['Rd', 'Road', 'St', 'Street', 'Ave', 'Avenue', 'Dr', 'Drive', 'Ln', 'Lane', 'Ct', 'Court', 'Pl',
    'Loop', 'Cir', 'Circle', 'Blvd', 'Boulevard', 'Pkwy', 'Parkway', 'Ter', 'Terrace', 'Trl', 'Trail', 'Hwy', 'Highway', 'Mkt']
  // Ordinary words too: they clear only where the phrase ends like an address.
  const AMBIGUOUS = ['Way', 'Place', 'Pass', 'Butte', 'Ridge', 'Rim', 'Market']

  it.each([...STRONG, ...AMBIGUOUS])('%s after the word clears it at the end of a phrase', (suffix) => {
    expect(passes(`Sales on Russell ${suffix}.`)).toBe(true)
    expect(passes(`Sales on Russell ${suffix.toUpperCase()}.`)).toBe(true)
    expect(passes(`Sales on Russell ${suffix}, Bend.`)).toBe(true)
    expect(passes(`Sales on Russell ${suffix} NE.`)).toBe(true)
  })

  it.each(STRONG)('%s after the word clears it even when the sentence carries on', (suffix) => {
    expect(passes(`Sales on Russell ${suffix} ran high.`)).toBe(true)
  })

  it.each(AMBIGUOUS)('%s after the word does not clear it when the sentence carries on', (suffix) => {
    expect(passes(`Sales on Russell ${suffix} ran high.`)).toBe(false)
    expect(passes(`Sales on Russell ${suffix} ran high.`, OWNER, ['20726 Russell'])).toBe(false)
  })

  it.each([...STRONG, ...AMBIGUOUS])('%s followed by a capitalized word is a heading or a name, not a street', (suffix) => {
    expect(passes(`Russell ${suffix} Analysis`)).toBe(false)
  })
})

describe('the builder hands the check the addresses the letter prints', () => {
  it('collects what every address-named key holds, in any section, and drops the empty ones', () => {
    const addresses = printedAddressesOf({
      subject: { streetAddress: '20705 Snow Peaks', city: 'Bend' },
      comps: [{ address: '20726 Russell Rd' }, { address: '  ' }, { address: null }],
      expiredPeers: { peers: [{ address: '14 Cedar Lane' }] },
      extras: { band: { rivals: [{ address: '9 Fir St' }] }, marketArea: { expiredPeers: [{ address: '16 Cedar Lane' }] } },
      subdivisionStory: { notableSales: [{ address: '31 Benaiah' }], facts: { recordHigh: { address: '23 Benaiah' } } },
      pricing: { streetAnchor: { addresses: ['40 Anchor Way', '41 Anchor Way'] } },
      client: { name: 'Ada Russell', email: 'ada@example.com', notes: '5 Not Printed Ln' },
      someSectionAddedLater: { rows: [{ deep: { address: '7 Future Ct' } }] },
    })
    expect(addresses).toEqual([
      '20705 Snow Peaks',
      '20726 Russell Rd',
      '14 Cedar Lane',
      '9 Fir St',
      '16 Cedar Lane',
      '31 Benaiah',
      '23 Benaiah',
      '40 Anchor Way',
      '41 Anchor Way',
      '7 Future Ct',
    ])
  })

  it('never takes a party address: the client, an owner, a mailing or an email address', () => {
    expect(
      printedAddressesOf({
        subject: { streetAddress: '1 Real St' },
        client: { name: 'Ada Russell', address: '5 Russell Ln' },
        ownerMailingAddress: '6 Russell Ln',
        ownerInfo: { address: '7 Russell Ln' },
        emailAddress: '8 Russell Ln',
        clientAddress: '9 Russell Ln',
        comps: [{ address: '2 Comp Ct', sellerAddress: '3 Russell Ln' }],
        // A key that merely contains "address" is not trusted; only the three the template uses are.
        parcels: [{ mailAddress: '4 Russell Ln', taxpayerAddress: '10 Russell Ln', address: '77 Parcel Way' }],
      }),
    ).toEqual(['1 Real St', '2 Comp Ct', '77 Parcel Way'])
  })

  it('reads nothing from nothing, and survives a cycle', () => {
    for (const empty of [undefined, null, '', 42, {}, [], { subject: null, comps: null }]) {
      expect(printedAddressesOf(empty)).toEqual([])
    }
    const loop: Record<string, unknown> = { address: '1 Loop Rd' }
    loop.self = loop
    expect(printedAddressesOf(loop)).toEqual(['1 Loop Rd'])
  })

  it('build.ts hands the contract the addresses of its own render args', () => {
    // Wiring guard, in the style of the sibling build-source tests: the contract call names the addresses.
    const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')
    const call = src.slice(src.indexOf('evaluateLetterConsistencyContract({'))
    expect(call.slice(0, 900)).toMatch(/printedAddresses:\s*printedAddressesOf\(/)
  })

  it('the contract clears a street of two words only when it is given the addresses', () => {
    const html = '<article><p>The subject is 20705 Snow Peaks. Comps sit on Russell Rd.</p></article>'
    const base = {
      html,
      names: { clientName: 'Ada Peaks' },
      identity: { personId: null },
      pricing: { recommended: 640000, highEnd: 670000, valueLow: 610000, valueHigh: 670000 },
    }
    const name = (out: ReturnType<typeof evaluateLetterConsistencyContract>) =>
      out.checks.find((c) => c.id === 'letter-no-owner-names')
    expect(name(evaluateLetterConsistencyContract(base))?.pass).toBe(false)
    expect(name(evaluateLetterConsistencyContract({ ...base, printedAddresses: ['20705 Snow Peaks'] }))?.pass).toBe(true)
    const dirty = { ...base, html: `${html}<p>Hi Peaks, the range is ready.</p>`, printedAddresses: ['20705 Snow Peaks'] }
    expect(name(evaluateLetterConsistencyContract(dirty))?.pass).toBe(false)
  })
})

describe('the real letter, with comps on the owner’s surname', () => {
  const subject = {
    listingKey: null,
    mlsNumber: '1',
    streetAddress: '20705 Snow Peaks',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: 'Snow Plat',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1998,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'A fine house.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 700000,
    lastListDate: '2026-01-07',
    listingHistoryLine: 'Listed January 7, 2026 at $700,000, came off expired.',
  } as CmaSubject
  const pricing = {
    method1Low: 600000,
    method1Mid: 640000,
    method1High: 680000,
    method2: 630000,
    method3: 640000,
    convergenceSpreadPct: 2,
    converged: true,
    conservative: 610000,
    recommended: 640000,
    highEnd: 670000,
    valueLow: 610000,
    valueHigh: 670000,
    confidence: 'Moderate',
    confidenceReason: 'Three sales.',
    needsReview: false,
    reviewReason: null,
    compPpsfCv: 0.04,
    priceOverride: null,
    improvementsValueAdd: null,
    notes: [],
  } as unknown as CmaPricing
  const broker = {
    id: null,
    slug: 'matthew-ryan',
    displayName: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    licenseNumber: '201212071',
    email: 'matt@ryan-realty.com',
    phone: '541.703.3095',
    photoUrl: null,
  } as CmaBroker
  const comp = (listingKey: string, address: string, close: number) => ({
    listingKey,
    mlsNumber: listingKey,
    address,
    city: 'Bend',
    subdivision: 'Snow Plat',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1760,
    lotAcres: 0.14,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1999,
    photoUrl: null,
    publicRemarks: 'Nice home.',
    viewDescription: null,
    taxAnnual: null,
    listPrice: close + 10000,
    closePrice: close,
    closeDate: '2026-06-01',
    daysToOffer: 10,
    domTotal: 20,
    selectionTier: 'subdivision-6mo',
    monthsSinceClose: 3,
    timeAdjustment: 0,
    timeAdjustedPrice: close,
    ppsfTimeAdjusted: 364,
    sizeAdjustment: 0,
    adjustedPrice: close,
    weight: 1,
    listingHistoryLine: 'Listed Jan 2, 2026 at $660,000.',
  })
  const args = (): RenderCmaArgs =>
    ({
      subject,
      // Five, because the sales grid that prints the addresses needs a full set.
      comps: [
        comp('C1', '20726 Russell Rd', 640000),
        comp('C2', '20730 NE Russell Road', 655000),
        comp('C3', '20734 Russell Ln', 648000),
        comp('C4', '20738 Russell', 651000),
        comp('C5', '20742 Russell Ct', 645000),
      ],
      market: null,
      pricing,
      broker,
      client: { name: 'Ada Russell', email: null, phone: null, notes: null },
      mapDataUri: null,
      generatedAtIso: '2026-09-30T12:00:00.000Z',
      subjectTrace: 't',
      compTrace: [],
      excludedOutliers: [],
    }) as unknown as RenderCmaArgs

  it('prints the comps and the street, and the check passes with and without the addresses', () => {
    const { html } = renderCmaHtml(args())
    const text = html.replace(/<[^>]+>/g, ' ')
    // The street prints as one text node per address: exactly what the check reads.
    for (const address of ['20726 Russell Rd', '20730 NE Russell Road', '20734 Russell Ln', '20738 Russell', '20742 Russell Ct']) {
      expect(text).toContain(address)
    }
    expect(html).not.toMatch(/\bAda\b/)
    // Both graders agree the owner is absent; the older rule would have refused this letter.
    expect(ownerNameTokenHits(html, OWNER)).toEqual([])
    expect(letterOwnerNameCheck(html, OWNER).pass).toBe(true)
    expect(letterOwnerNameCheck(html, OWNER, { printedAddresses: printedAddressesOf(args()) }).pass).toBe(true)
    expect(printedAddressesOf(args())).toContain('20705 Snow Peaks')
    expect(printedAddressesOf(args())).toContain('20726 Russell Rd')
  })

  it('still fails once the same letter prints the owner', () => {
    const { html } = renderCmaHtml(args())
    const printed = printedAddressesOf(args())
    expect(letterOwnerNameCheck(`${html}<p>Hi Russell, the range is ready.</p>`, OWNER, { printedAddresses: printed }).pass).toBe(false)
    expect(letterOwnerNameCheck(`${html}<p>The Russell family listed in January.</p>`, OWNER, { printedAddresses: printed }).pass).toBe(false)
    expect(letterOwnerNameCheck(`${html}<p>Ada Russell asked about the roof.</p>`, OWNER, { printedAddresses: printed }).pass).toBe(false)
  })
})
