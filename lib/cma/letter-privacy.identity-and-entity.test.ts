/**
 * The owner-name check refuses a letter that prints the owner's name. Three
 * live false positives (verified 2026-09-29) made it refuse letters that did
 * not. The names below are made up and keep the shape of the real rows:
 *   - a client named Ryan ("Ryan Marshmallow"): the token Ryan matched OUR OWN
 *     name. Every letter prints "Matt Ryan" and "Ryan Realty".
 *   - a company ("Quillfeather Homes Llc"): the token Homes matched the
 *     ordinary sentence "sales of homes like yours".
 *   - a builder ("Example Homes NW"): the token NW matched the street
 *     directionals every letter prints, our own office address included.
 * A real printed name must still fail.
 */
import { describe, expect, it } from 'vitest'
import { BRAND, BROKERS } from '@/lib/brand/contact'
import { evaluateLetterConsistencyContract } from '@/lib/cma/letter-consistency'
import {
  isCommonNameWord,
  letterContainsOwnerContactNames,
  letterOwnerNameCheck,
  ourIdentityPhrases,
  ownerNameTokenHits,
  preparedClosingLine,
  preparedCoverLine,
  scrubMlsOwnerTokens,
} from '@/lib/cma/letter-privacy'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const ROSTER = Object.values(BROKERS)
const firstWord = (name: string) => name.trim().split(/\s+/)[0] as string
const lastWord = (name: string) => name.trim().split(/\s+/).slice(-1)[0] as string

const RYAN = { clientName: 'Ryan Marshmallow' }
const HOMES = { clientName: 'Quillfeather Homes Llc' }
const NW = { clientName: 'Example Homes NW' }

/**
 * The shapes the real template prints, read off a render on 2026-09-29: the
 * cover line, the running foot, the licensee-interest sentence, the signature
 * block. Plus the intro sentence and the legal name the email draft carries.
 */
const OUR_IDENTITY = [
  '<p>My name is Matt Ryan, owner and principal broker of Ryan Realty in Bend.</p>',
  '<p class="cover-presented">Prepared for the owners of 10 Cedar Lane by Matt Ryan, Ryan Realty · Sep 29, 2026</p>',
  '<p>10 Cedar Lane · Basis and limits · Matt Ryan</p>',
  '<p>Neither Matt Ryan nor Ryan Realty holds any existing or contemplated interest in this property.</p>',
  '<div class="sig-name">Matt Ryan</div><div class="sig-title">Owner &amp; Principal Broker · Ryan Realty</div>',
  '<p>Ryan Realty LLC. Matthew Ryan, principal broker.</p>',
].join('')

describe('our own identity is not the owner name', () => {
  it('a client named Ryan passes when the only Ryan in the letter is us', () => {
    const check = letterOwnerNameCheck(`<article>${OUR_IDENTITY}</article>`, RYAN)
    expect(check.pass).toBe(true)
    expect(check.id).toBe('letter-no-owner-names')
    expect(check.detail).toBe('Owner/contact name tokens are absent from the letter and email draft.')
  })

  it('every public grader reads the same graded text, so none can disagree with the check', () => {
    const clean = `<article>${OUR_IDENTITY}</article>`
    expect(ownerNameTokenHits(clean, RYAN)).toEqual([])
    expect(letterContainsOwnerContactNames(clean, RYAN)).toBe(false)
    const dirty = `<article>${OUR_IDENTITY}<p>Hi Ryan, welcome.</p></article>`
    expect(ownerNameTokenHits(dirty, RYAN)).toEqual(['Ryan'])
    expect(letterContainsOwnerContactNames(dirty, RYAN)).toBe(true)
  })

  it('a real printed Ryan still fails: greeting, sign-off, and the full name', () => {
    const graded = (extra: string) => letterOwnerNameCheck(`<article>${OUR_IDENTITY}${extra}</article>`, RYAN)
    const greeting = graded('<p>Hi Ryan, the range is ready.</p>')
    expect(greeting.pass).toBe(false)
    expect(greeting.detail).toBe('Letter or email draft printed owner/contact name token(s): Ryan.')
    const full = graded('<p>Ryan Marshmallow asked about the roof.</p>')
    expect(full.pass).toBe(false)
    expect(full.detail).toBe('Letter or email draft printed owner/contact name token(s): Ryan, Marshmallow.')
    expect(graded('<p>Sincerely, Ryan</p>').pass).toBe(false)
    expect(graded('<p>Dear Ryan Marshmallow,</p>').pass).toBe(false)
    // Only OUR words are removed. The owner's surname run onto ours still shows.
    const run = graded('<p>Matt Ryan Marshmallow</p>')
    expect(run.pass).toBe(false)
    expect(run.detail).toBe('Letter or email draft printed owner/contact name token(s): Marshmallow.')
  })

  it.each(ROSTER)('$nameShort: a client who shares the surname passes when the letter prints that broker', (b) => {
    const surname = lastWord(b.nameShort)
    const owner = { clientName: `Zed ${surname}` }
    const signed = `<p>${b.name}</p><p>${b.nameShort}</p><p>${b.nameShort}, ${BRAND.name}</p>`
    expect(letterOwnerNameCheck(signed, owner).pass).toBe(true)
    expect(letterOwnerNameCheck(`${signed}<p>Hi Zed, the range is ready.</p>`, owner).pass).toBe(false)
    expect(letterOwnerNameCheck(`${signed}<p>Zed ${surname} asked about the roof.</p>`, owner).pass).toBe(false)
  })

  it.each(ROSTER)('$nameShort: a bare first name is not identity, so it stays strict', (b) => {
    const first = firstWord(b.nameShort)
    const owner = { clientName: `${first} Zzyzx` }
    const signed = `<p>${b.name}</p><p>${b.nameShort}</p>`
    expect(letterOwnerNameCheck(signed, owner).pass).toBe(true)
    const bare = letterOwnerNameCheck(`${signed}<p>Hi ${first}, the range is ready.</p>`, owner)
    expect(bare.pass).toBe(false)
    expect(bare.detail).toBe(`Letter or email draft printed owner/contact name token(s): ${first}.`)
  })

  it.each(ROSTER)('$nameShort: a client who IS that name is still refused, since only a person can tell them apart', (b) => {
    const owner = { clientName: b.nameShort }
    const check = letterOwnerNameCheck(`<p>${b.nameShort}</p>`, owner)
    expect(check.pass).toBe(false)
    expect(check.detail).toContain(firstWord(b.nameShort))
  })

  it('a client named Matt Ryan is not refused for a letter another broker signs, and is caught if printed', () => {
    const matt = { clientName: 'Matt Ryan' }
    const signedByPaul = '<p>Paul Stevenson, Broker · Ryan Realty</p><p>Neither Paul Stevenson nor Ryan Realty holds an interest.</p>'
    expect(letterOwnerNameCheck(signedByPaul, matt).pass).toBe(true)
    expect(letterOwnerNameCheck(`${signedByPaul}<p>Prepared for Matt Ryan.</p>`, matt).pass).toBe(false)
  })

  it('an owner named after the brokerage is still refused when the letter prints the brokerage', () => {
    const owner = { clientName: 'Ryan Realty Holdings' }
    expect(letterOwnerNameCheck('<p>Ryan Realty</p>', owner).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Sales of homes like yours.</p>', owner).pass).toBe(true)
  })

  it('reads the brokerage and every broker from lib/brand/contact, not a second list', () => {
    const phrases = ourIdentityPhrases()
    for (const phrase of [BRAND.name, BRAND.legalName, 'Ryan Realty', 'Matt Ryan', 'Matthew Ryan']) {
      expect(phrases).toContain(phrase)
    }
    for (const b of ROSTER) {
      expect(phrases).toContain(b.name)
      expect(phrases).toContain(b.nameShort)
    }
  })

  it('the prepared-for line is set aside before our name is, so the cover flag still works', () => {
    const cover = preparedCoverLine({
      brokerName: 'Matt Ryan',
      generatedAt: 'September 29, 2026',
      ownerName: 'Ryan Marshmallow',
      streetAddress: '10 Cedar Lane',
      showOwnerName: true,
    })
    const close = preparedClosingLine({
      generatedAt: 'September 29, 2026',
      ownerName: 'Ryan Marshmallow',
      streetAddress: '10 Cedar Lane',
      showOwnerName: true,
    })
    expect(cover).toBe('Prepared for Ryan Marshmallow by Matt Ryan, Ryan Realty · September 29, 2026')
    const allowed = `<p>${cover}</p><p>${close}</p>${OUR_IDENTITY}`
    expect(letterOwnerNameCheck(allowed, RYAN, { showOwnerName: true }).pass).toBe(true)
    expect(letterOwnerNameCheck(`${allowed}<p>Hi Ryan, the range is ready.</p>`, RYAN, { showOwnerName: true }).pass).toBe(
      false,
    )
    expect(letterOwnerNameCheck(allowed, RYAN).pass).toBe(false)
  })

  it('the MLS scrub is not told our identity: a remark that says Ryan loses it, whoever Ryan is', () => {
    const out = scrubMlsOwnerTokens('Ryan will consider offers. Contact Matt Ryan at Ryan Realty.', RYAN)
    expect(out).not.toMatch(/\bRyan\b/)
    expect(out).toContain('will consider offers.')
  })
})

describe('the real letter, signed by each broker on the roster', () => {
  const subject = {
    listingKey: null,
    mlsNumber: '1',
    streetAddress: '10 Cedar Lane',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: 'Cedar Plat',
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

  function letterHtml(b: (typeof ROSTER)[number], clientName: string): string {
    const broker = {
      id: null,
      slug: b.slug,
      displayName: b.nameShort,
      title: b.title,
      licenseNumber: b.license,
      email: b.email,
      phone: b.phone,
      photoUrl: null,
    } as CmaBroker
    const { html } = renderCmaHtml({
      subject,
      comps: [],
      market: null,
      pricing,
      broker,
      client: { name: clientName, email: null, phone: null, notes: null },
      mapDataUri: null,
      generatedAtIso: '2026-09-29T12:00:00.000Z',
      subjectTrace: 't',
      compTrace: [],
      excludedOutliers: [],
    } as RenderCmaArgs)
    return html
  }

  it('Ryan Marshmallow passes the consistency contract name check on a letter Matt Ryan signs', () => {
    const html = letterHtml(BROKERS.matt, 'Ryan Marshmallow')
    expect(html).toContain('Matt Ryan')
    expect(html).toContain('Ryan Realty')
    const out = evaluateLetterConsistencyContract({
      html,
      names: RYAN,
      identity: { personId: null },
      pricing: { recommended: 640000, highEnd: 670000, valueLow: 610000, valueHigh: 670000 },
    })
    const nameCheck = out.checks.find((c) => c.id === 'letter-no-owner-names')
    expect(nameCheck?.pass).toBe(true)
    expect(nameCheck?.detail).toBe('Owner/contact name tokens are absent from the letter and email draft.')
  })

  it.each(ROSTER)('a client who shares the surname of $nameShort passes on the letter that broker signs', (b) => {
    const owner = { clientName: `Zed ${lastWord(b.nameShort)}` }
    const html = letterHtml(b, owner.clientName)
    expect(html).toContain(b.nameShort)
    expect(letterOwnerNameCheck(html, owner).pass).toBe(true)
  })

  it('a builder whose name ends in NW passes on every broker letter, which prints our office address', () => {
    for (const b of ROSTER) {
      const html = letterHtml(b, NW.clientName)
      expect(html).toContain('NW Oregon')
      expect(letterOwnerNameCheck(html, NW).pass).toBe(true)
      expect(letterOwnerNameCheck(`${html}<p>Hi Example, the range is ready.</p>`, NW).pass).toBe(false)
    }
  })

  it('the same letter still fails once it prints the client', () => {
    const html = letterHtml(BROKERS.matt, 'Ryan Marshmallow')
    expect(letterOwnerNameCheck(html, RYAN).pass).toBe(true)
    const dirty = letterOwnerNameCheck(`${html}<p>Hi Ryan, the range is ready.</p>`, RYAN)
    expect(dirty.pass).toBe(false)
    expect(dirty.detail).toBe('Letter or email draft printed owner/contact name token(s): Ryan.')
  })
})

/** Named in the brief: company and estate owner words that are also ordinary vocabulary. */
const REQUIRED_ENTITY_WORDS = [
  'home',
  'homes',
  'house',
  'houses',
  'llc',
  'inc',
  'co',
  'corp',
  'company',
  'properties',
  'property',
  'estate',
  'estates',
  'holdings',
  'investments',
  'group',
  'builders',
  'construction',
  'development',
]

/** Same class: legal forms and trade words a company owner name carries and a letter or remark also prints. */
const SIBLING_ENTITY_WORDS = [
  'ltd',
  'lp',
  'llp',
  'pllc',
  'limited',
  'holding',
  'investment',
  'investors',
  'developments',
  'developers',
  'builder',
  'land',
  'realty',
  'rental',
  'rentals',
  'management',
  'capital',
  'partners',
]

/** Trust words are deliberately scrubbed everywhere (letter-privacy.ts docstring). They stay out. */
const TRUST_WORDS = ['trust', 'rev', 'revocable', 'liv', 'living', 'family']

describe('company and estate owner words count only in a name-shaped position', () => {
  it('a company owner passes when the letter says homes as ordinary vocabulary', () => {
    const letter =
      '<p>Across Central Oregon, 3,394 homes came off unsold and then sold. Sales of homes like yours ran $640,000. See homes for sale near you.</p>'
    const check = letterOwnerNameCheck(letter, HOMES)
    expect(check.pass).toBe(true)
    expect(ownerNameTokenHits(letter, HOMES)).toEqual([])
  })

  it('the distinctive word in the owner name still fails', () => {
    const greeting = letterOwnerNameCheck('<p>Hi Quillfeather, the range is ready.</p>', HOMES)
    expect(greeting.pass).toBe(false)
    expect(greeting.detail).toBe('Letter or email draft printed owner/contact name token(s): Quillfeather.')
    expect(letterOwnerNameCheck('<p>Built by Quillfeather in 1998.</p>', HOMES).pass).toBe(false)
  })

  it('the capitalized pair fails, and so does the entity word alone in a name position', () => {
    const pair = letterOwnerNameCheck('<p>Quillfeather Homes built the house.</p>', HOMES)
    expect(pair.pass).toBe(false)
    expect(ownerNameTokenHits('<p>Quillfeather Homes built the house.</p>', HOMES)).toEqual(['Quillfeather', 'Homes'])
    expect(letterOwnerNameCheck('<p>Hi Homes, the range is ready.</p>', HOMES).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Prepared for Homes by Matt Ryan.</p>', HOMES).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>To: Homes</p>', HOMES).pass).toBe(false)
  })

  it('an estate owner passes on "real estate" and fails on the name', () => {
    const estate = { clientName: 'Estate of Ada Zzyzx' }
    expect(letterOwnerNameCheck('<p>Real estate investors and estate sales are in the data.</p>', estate).pass).toBe(true)
    expect(letterOwnerNameCheck('<p>Hi Ada, the range is ready.</p>', estate).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Prepared for the Estate of Ada Zzyzx.</p>', estate).pass).toBe(false)
  })

  it.each(REQUIRED_ENTITY_WORDS)('%s is an ordinary word, not a bare name hit', (word) => {
    expect(isCommonNameWord(word)).toBe(true)
    expect(isCommonNameWord(word.toUpperCase())).toBe(true)
  })

  it.each(SIBLING_ENTITY_WORDS)('%s (sibling entity word) is an ordinary word too', (word) => {
    expect(isCommonNameWord(word)).toBe(true)
  })

  it.each(TRUST_WORDS)('%s is NOT an ordinary word: trust tokens stay scrubbed everywhere', (word) => {
    expect(isCommonNameWord(word)).toBe(false)
  })

  it('a given name or surname is never an ordinary word', () => {
    for (const name of ['quillfeather', 'marshmallow', 'ryan', 'matt', 'zzyzx', 'quincy']) {
      expect(isCommonNameWord(name)).toBe(false)
    }
  })

  it('a land and capital partnership owner passes on prose that says land, capital, partners', () => {
    const owner = { clientName: 'Zzyzx Land Capital Partners Lp' }
    const prose =
      '<p>Land value sits inside limited inventory. Capital improvements matter. Our partners in title ran the numbers.</p>'
    expect(letterOwnerNameCheck(prose, owner).pass).toBe(true)
    expect(letterOwnerNameCheck(`${prose}<p>Hi Zzyzx, the range is ready.</p>`, owner).pass).toBe(false)
  })
})

/** Named in the request: the street directionals every address prints. One-letter ones never become tokens. */
const DIRECTIONALS = ['ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west']

/** Same class, spelled out ("Northwest Crossing" is a Bend neighborhood that prints in letters). */
const LONG_DIRECTIONALS = ['northeast', 'northwest', 'southeast', 'southwest']

describe('street directionals count only in a name-shaped position', () => {
  it('a builder whose name ends in NW passes on the addresses a letter prints', () => {
    const letter =
      '<p>Bend office: 115 NW Oregon Ave #2. The subject sits at 20594 SW Slate Ct, with comps at 1420 NE Fir St and 880 SE Pine Rd. Sales of homes like yours ran $640,000.</p>'
    const check = letterOwnerNameCheck(letter, NW)
    expect(check.pass).toBe(true)
    expect(ownerNameTokenHits(letter, NW)).toEqual([])
  })

  it('the distinctive word still fails, and so does a directional in a name position', () => {
    const address = '<p>115 NW Oregon Ave. Sales of homes like yours ran $640,000.</p>'
    const greeting = letterOwnerNameCheck(`${address}<p>Hi Example, the range is ready.</p>`, NW)
    expect(greeting.pass).toBe(false)
    expect(greeting.detail).toBe('Letter or email draft printed owner/contact name token(s): Example.')
    const full = letterOwnerNameCheck(`${address}<p>Example Homes NW built it.</p>`, NW)
    expect(full.pass).toBe(false)
    expect(ownerNameTokenHits(`${address}<p>Example Homes NW built it.</p>`, NW)).toEqual(['Example', 'Homes', 'NW'])
    expect(letterOwnerNameCheck(`${address}<p>Hi NW, the range is ready.</p>`, NW).pass).toBe(false)
    expect(letterOwnerNameCheck(`${address}<p>Prepared for Homes NW.</p>`, NW).pass).toBe(false)
  })

  it.each([...DIRECTIONALS, ...LONG_DIRECTIONALS])('%s is an ordinary word, not a bare name hit', (word) => {
    expect(isCommonNameWord(word)).toBe(true)
    expect(isCommonNameWord(word.toUpperCase())).toBe(true)
  })

  it('the MLS scrub keeps an address in a remark and still removes the builder', () => {
    expect(scrubMlsOwnerTokens('Located at 115 NW Oregon Ave, beautiful homes nearby.', NW)).toBe(
      'Located at 115 NW Oregon Ave, beautiful homes nearby.',
    )
    expect(scrubMlsOwnerTokens('Built by Example Homes NW in 1998.', NW)).toBe('Built by in 1998.')
  })
})

describe('MLS remarks are kept as written unless the word is a name-shaped hit', () => {
  it('keeps "homes" in a remark for a company owner and still removes the name', () => {
    expect(scrubMlsOwnerTokens('Beautiful homes nearby.', HOMES)).toBe('Beautiful homes nearby.')
    expect(scrubMlsOwnerTokens('Built by Quillfeather Homes.', HOMES)).toBe('Built by.')
    expect(scrubMlsOwnerTokens('Quillfeather built these homes.', HOMES)).toBe('built these homes.')
    expect(scrubMlsOwnerTokens('Contact Quillfeather Homes Llc for details.', HOMES)).toBe('Contact for details.')
  })

  it('keeps "real estate" for an estate owner and removes the person', () => {
    const estate = { clientName: 'Estate of Ada Zzyzx' }
    const out = scrubMlsOwnerTokens('Real estate investors welcome. Contact the Estate of Ada Zzyzx.', estate)
    expect(out).toContain('Real estate investors welcome.')
    expect(out).not.toMatch(/\b(Ada|Zzyzx)\b/)
  })

  it('a trust owner still loses family, living and trust from a remark, everywhere', () => {
    const trust = { clientName: 'Ada Zzyzx Family Living Trust' }
    const out = scrubMlsOwnerTokens('A family home with living space. Trust the view.', trust)
    expect(out).not.toMatch(/\b(family|living|trust)\b/i)
    expect(out).toContain('home')
  })
})

describe('an honorific makes an ordinary word a surname', () => {
  const NORTH = { clientName: 'Quillfeather North Trust' }

  it('the check refuses "Mr. North" even though north is an ordinary word', () => {
    expect(ownerNameTokenHits('Mr. North will consider offers.', NORTH)).toContain('North')
    expect(ownerNameTokenHits('Mrs North asked for a call.', NORTH)).toContain('North')
    expect(ownerNameTokenHits('Dr. North owns the lot next door.', NORTH)).toContain('North')
  })

  it('the check still passes the directional itself', () => {
    expect(ownerNameTokenHits('Head north on Highway 97 to reach the home.', NORTH)).not.toContain('North')
    expect(ownerNameTokenHits('The North Bend view from the deck.', { clientName: 'Ada West' })).toEqual([])
  })

  it('the MLS scrub drops the honorific and surname and keeps the rest of the remark', () => {
    const out = scrubMlsOwnerTokens('Mr. North will consider offers. Head north on 97.', NORTH)
    expect(out).not.toMatch(/\bMr\.?\s+North\b/)
    expect(out).toContain('will consider offers.')
    expect(out).toContain('Head north on 97.')
  })
})
