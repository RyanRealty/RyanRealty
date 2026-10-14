/**
 * Reader reviews of the drafts rebuilt 2026-10-09: the letter-rendering
 * defects, held on the stored letters themselves (render_args as stored, the
 * owner and agent contact fields blanked: lib/cma/fixtures/letter-shapes
 * saginaw.json and jacksonville.json).
 *
 * The chart (item 1) is held in timeline-labels.reader-review.test.ts, the
 * place count (item 5) in place-count.reader-review.test.ts, and the words on
 * a home on the market (item 6) in on-market-subject.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { closedEntries, pinFactsFor } from '@/lib/cma/matrix-entry'
import { pinRevealLine } from '@/lib/cma/comp-pin-map'
import { CAME_BACK_SUFFIX, originalListCell } from '@/lib/cma/comp-matrix'
import { NOTHING_ADDED_HERE_EITHER, NO_DOLLAR_FOR_ROOM, plainTextOf, sayOnceAfter } from '@/lib/cma/say-once'
import { addedSentenceOnItsOwn } from '@/lib/cma/sales-method-note'
import { shortfallPeerSentence, storedPeerSentenceToday } from '@/lib/cma/market-status'
import type { CompArea } from '@/lib/pricing/comp-area'
import type { CmaAdjustedComp, CmaBroker } from '@/lib/cma/types'

const broker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
} as CmaBroker

function stored(name: string): RenderCmaArgs {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'lib/cma/fixtures/letter-shapes', `${name}.json`), 'utf8'))
  return {
    ...raw,
    broker,
    client: { name: null, email: null, phone: null, notes: null },
    mapDataUri: null,
    subjectMapDataUri: null,
    documentStatus: 'draft',
  } as RenderCmaArgs
}

function both(name: string): { letter: string; web: string } {
  const args = stored(name)
  return {
    letter: plainTextOf(renderCmaHtml(args).html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ')),
    web: plainTextOf(
      renderImmersiveCmaHtml(args as never, 'https://ryan-realty.com').replace(
        /<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g,
        ' ',
      ),
    ),
  }
}

const count = (text: string, needle: string) => text.split(needle).length - 1

const SAGINAW_AREA = 'Park Place, Miller Heights, Kenwood, West Hills and Bend View'

describe('915 Saginaw', () => {
  const docs = both('saginaw')

  it('2. says the room line and the short-count line once per letter', () => {
    for (const doc of [docs.letter, docs.web]) {
      expect(count(doc, NO_DOLLAR_FOR_ROOM)).toBe(1)
      expect(count(doc, `nothing from outside ${SAGINAW_AREA} was added`)).toBe(0)
      expect(count(doc, `Nothing from outside ${SAGINAW_AREA} was added`)).toBe(0)
      expect(count(doc, 'was added to make up the number')).toBe(1)
      expect(doc).toContain(
        `but two are under contract. ${NOTHING_ADDED_HERE_EITHER} 733 Saginaw is one bedroom different from yours. 1340 Trenton is one bedroom different from yours. This range is`,
      )
    }
  })

  it('8. names the searched area in the came-off count, and a canceled listing in the past tense', () => {
    for (const doc of [docs.letter, docs.web]) {
      expect(doc).toContain(
        `Only one home like yours in ${SAGINAW_AREA} came off the market without selling in the last six months, and nothing from further out was added to make up the number. 636 Portland is one bedroom different from yours. ${NO_DOLLAR_FOR_ROOM}`,
      )
      expect(doc).not.toContain('Only one home like yours in Kenwood came off')
      expect(doc).toContain('This one listing was listed at $612 a foot.')
      expect(doc).not.toContain('lists at $612')
      // The sales closed: they listed at a rate, past tense beside "sold at".
      expect(doc).toContain('These five sales listed at $375 to $619 a foot')
    }
  })

  it('3. says the original list of a home that came back is the ask it came back at', () => {
    // 628 Portland opened at $1,475,000 (MLS OriginalListPrice) and came back
    // at $1,395,000 on Jan 13 (its stamped stretch), the ask the cell prints.
    for (const doc of [docs.letter, docs.web]) {
      expect(doc).toContain(`Original list $1,395,000 ${CAME_BACK_SUFFIX}`)
      expect(doc).not.toMatch(/Original list \$1,395,000(?! when it came back)/)
      // A home that did not come back keeps its plain original list.
      expect(doc).toContain('Original list $1,099,000 Beds')
    }
  })
})

describe('1355 Jacksonville', () => {
  const docs = both('jacksonville')

  it('4. opens the Basis method sentence on its own, not on "Four more were added"', () => {
    for (const doc of [docs.letter, docs.web]) {
      expect(doc).toContain(
        'How the sales were chosen and adjusted. Four of the five sales are outside Northwest Townsite: 1345 Milwaukee in Grandview, 1340 Cumberland in Highland, 1613 Ithaca in Bonne Home and 1685 Fresno in Bonne Home.',
      )
      expect(doc).not.toContain('adjusted. Four more were added')
      // The chapter heading the old sentence followed is unchanged.
      expect(doc).toContain('One of the five sales is in Northwest Townsite.')
    }
  })

  it('5. says what the River West count holds, the home itself included', () => {
    for (const doc of [docs.letter, docs.web]) {
      expect(doc).toContain(
        '139 homes were listed, sold or taken off the market, yours among them. 21 of them came off the market without selling, yours included.',
      )
      expect(doc).toContain(
        'River West single-family homes listed, sold or taken off the market between October 8, 2025 and October 8, 2026: 139 homes, each address counted once.',
      )
      expect(doc).not.toContain('139 homes were listed.')
    }
  })
})

describe('the pieces', () => {
  it('sayOnceAfter drops a room line and restates a short-count line an earlier chapter said', () => {
    const earlier =
      'Only one home like yours in A and B came off the market without selling in the last six months, and nothing from further out was added to make up the number. 1 Oak is one bedroom different from yours. No dollar value is applied to the room.'
    const later =
      'No home like yours in A or B is for sale between $1 and $2, but two are under contract. Nothing from outside A and B was added to make up the number. 2 Elm is one bedroom different from yours. No dollar value is applied to the room. This range is 10% either side.'
    expect(sayOnceAfter(later, earlier)).toBe(
      'No home like yours in A or B is for sale between $1 and $2, but two are under contract. Nothing from further out was added here either. 2 Elm is one bedroom different from yours. This range is 10% either side.',
    )
    // Nothing said earlier: the sentence stands as written.
    expect(sayOnceAfter(later, 'Three homes like yours in A came off the market without selling.')).toBe(later)
  })

  it('a stored short count names the whole search area; any other stored sentence stands', () => {
    const area = {
      kind: 'subdivisions',
      names: ['Park Place', 'Miller Heights', 'Kenwood', 'West Hills', 'Bend View'],
      radiusMiles: null,
      centre: { lat: 44.06569, lng: -121.32545 },
      source: 'test',
      sentence: 'test',
    } as unknown as CompArea
    const peers = { area, count: 1, likeYours: true, windowMonths: 6, shortfall: true }
    const old =
      'Only one home like yours in Kenwood came off the market without selling in the last six months, and nothing from outside Park Place, Miller Heights, Kenwood, West Hills and Bend View was added to make up the number. 636 Portland is one bedroom different from yours. No dollar value is applied to the room.'
    expect(storedPeerSentenceToday(old, peers)).toBe(
      `${shortfallPeerSentence({ searchArea: area, count: 1, likeYours: true, windowMonths: 6 })} 636 Portland is one bedroom different from yours. No dollar value is applied to the room.`,
    )
    const three = 'Three homes like yours in Kenwood came off the market without selling in the last six months.'
    expect(storedPeerSentenceToday(three, { ...peers, count: 3, shortfall: false })).toBe(three)
  })

  it('the added sentence is made whole from the heading it followed', () => {
    expect(
      addedSentenceOnItsOwn('One of the five sales is in Northwest Townsite.', 'Four more were added: 1 A in X and 2 B in Y.'),
    ).toBe('Four of the five sales are outside Northwest Townsite: 1 A in X and 2 B in Y.')
    expect(addedSentenceOnItsOwn('Four of the five sales are in Silver Sage.', 'One more was added from your own street.')).toBe(
      'One of the five sales comes from your own street.',
    )
    expect(addedSentenceOnItsOwn('No sale inside X matched your home.', 'Four more were added: 1 A.')).toBeNull()
  })

  it('a pin that saw no price change since it came back says since when', () => {
    // 61197 Cottonwood: opened at $849,900, came back at $774,900 and sold
    // after an offer on that ask (20676 Wild Rose's grid).
    const sale = {
      listingKey: 'cottonwood',
      mlsNumber: null,
      address: '61197 Cottonwood',
      closePrice: 715_000,
      closeDate: '2025-12-30',
      listPrice: 774_900,
      originalListPrice: 849_900,
      onMarketDate: '2025-04-11',
      offerFrom: '2025-11-13',
      daysToOffer: 47,
      stretch: { from: '2025-11-13', firstAsk: 774_900, restarted: true },
      sqft: 2000,
      adjustedPrice: 700_000,
    } as unknown as CmaAdjustedComp
    const [entry] = closedEntries([sale])
    expect(entry!.firstAsk).toBe(774_900)
    expect(originalListCell(entry!)).toBe('$774,900 when it came back')
    const [fact] = pinFactsFor([entry!])
    expect(pinRevealLine(fact!)).toContain('no price change since it last came on the market')
    // A sale that never came back keeps the plain words.
    const plain = { ...sale, onMarketDate: '2025-11-13', stretch: { from: '2025-11-13', firstAsk: 774_900, restarted: false } }
    const [p] = closedEntries([plain as unknown as CmaAdjustedComp])
    expect(originalListCell(p!)).toBe('$774,900')
    expect(pinRevealLine(pinFactsFor([p!])[0]!)).toContain('no price change')
    expect(pinRevealLine(pinFactsFor([p!])[0]!)).not.toContain('since it last came')
  })

  it('7. a column head breaks an address only between words, on paper and on screen', () => {
    const args = stored('saginaw')
    const letter = renderCmaHtml(args).html
    const web = renderImmersiveCmaHtml(args as never, 'https://ryan-realty.com')
    // The address is as narrow as its longest word, and takes the line under
    // the pin when that word does not fit beside it (measured at 900 to
    // 1440px on 20676 Wild Rose: "GOLDENROD" and "COTTONWOOD" whole).
    expect(letter).toMatch(/table\.comp-matrix thead \.addr-row \{ flex-wrap: wrap;/)
    expect(letter).toMatch(/table\.comp-matrix thead \.addr-row \.matrix-addr \{ flex: 1 1 auto; width: min-content; \}/)
    expect(web).toContain('table.comp-matrix thead .addr-row{flex-wrap:wrap')
    expect(web).toContain('table.comp-matrix thead .addr-row .matrix-addr{flex:1 1 auto;width:min-content}')
  })
})
