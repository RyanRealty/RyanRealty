import { describe, expect, it } from 'vitest'
import { parseSuggestedReply } from '@/components/admin/crm/composer-preload'
import {
  addressFromListingUrl,
  collapseLookingAtByPerson,
  formatLookingAtAddress,
  listingKeyFromPageUrl,
  lookingAtAlertBody,
  lookingAtAskBody,
  lookingAtAskHref,
  lookingAtAskHrefIfRecent,
  lookingAtCanQueue,
  lookingAtDedupeKind,
  lookingAtTodayTitle,
  type LookingAtRaw,
} from './looking-at'

const SESSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function ev(partial: Partial<LookingAtRaw> & Pick<LookingAtRaw, 'personId' | 'listingKey' | 'occurredAt'>): LookingAtRaw {
  return {
    listingStreet: null,
    pageUrl: null,
    ...partial,
  }
}

describe('lookingAtAlertBody', () => {
  it('is the locked two-line SMS', () => {
    expect(lookingAtAlertBody('Jane Doe', '123 Main St', 42)).toBe(
      // Line 2 carries the "View lead:" label as of 2026-08-25 (Matt: one line
      // on what happened, then the labelled link).
      'Jane Doe is looking at 123 Main St.\nView lead: https://ryan-realty.com/admin/people/42',
    )
  })

  it('does not carry the old return-visit novel', () => {
    const body = lookingAtAlertBody('Jane Doe', '123 Main St', 42)
    expect(body).not.toMatch(/is back on your site/i)
    expect(body).not.toMatch(/^Why:/m)
    expect(body).not.toMatch(/^From:/m)
    expect(body).not.toMatch(/Open the lead/i)
  })

  it('falls back to Someone when the name is blank', () => {
    expect(lookingAtAlertBody('  ', '9 Pine', 7)).toMatch(/^Someone is looking at 9 Pine\./)
  })
})

describe('lookingAtTodayTitle', () => {
  it('matches the SMS first line so a missed text is not a missed person', () => {
    const body = lookingAtAlertBody('Jane Doe', '123 Main St', 42)
    expect(lookingAtTodayTitle('Jane Doe', '123 Main St')).toBe(body.split('\n')[0])
  })
})

describe('lookingAtAskBody', () => {
  // Offer set re-locked by Matt 2026-09-01: the ask names what a broker can
  // actually deliver on the spot — a price opinion or a CMA. D1 (no watch
  // narration) and D11 (punctuation) hold unchanged below.
  it('is the locked ask: names the home, offers a price opinion or a CMA', () => {
    expect(lookingAtAskBody('123 Main St')).toBe(
      '123 Main St. Want my opinion on the price, or a full CMA?',
    )
  })

  it('does not narrate surveillance', () => {
    const body = lookingAtAskBody('123 Main St')
    expect(body).not.toMatch(/watch|noticed|brows|saw you|looking at|on (our|the) site|track|visit/i)
  })

  it('obeys D11 punctuation and does not name virtues', () => {
    const body = lookingAtAskBody('123 Main St')
    expect(body).not.toMatch(/[—–;!]/)
    expect(body).not.toMatch(/authentic|genuine|honest|simple|transparent|trusted|dedicated/i)
  })

  it('is empty when there is no home to name', () => {
    expect(lookingAtAskBody('  ')).toBe('')
  })
})

describe('lookingAtAskHref', () => {
  it('is a composer preload, not a send', () => {
    const href = lookingAtAskHref(42, '123 Main St')
    expect(href.startsWith('/admin/people/42?')).toBe(true)
    expect(href).toContain('reply=')
    expect(href.endsWith('#comms')).toBe(true)
    expect(href).not.toMatch(/twilio|sendGoverned|sms_out|\/api\//i)
  })

  it('is null when the view is stale or unnamed', () => {
    expect(lookingAtAskHrefIfRecent(42, '123 Main St', false)).toBeNull()
    expect(lookingAtAskHrefIfRecent(42, '  ', true)).toBeNull()
    expect(lookingAtAskHrefIfRecent(42, '123 Main St', true)).toBe(lookingAtAskHref(42, '123 Main St'))
  })

  it('round-trips through the composer preload parser', () => {
    const href = lookingAtAskHref(42, '123 Main St')
    const parsed = parseSuggestedReply(new URL(`https://ryan-realty.com${href}`).search)
    expect(parsed).toEqual({
      channel: 'sms',
      body: lookingAtAskBody('123 Main St'),
      subject: null,
    })
  })
})

describe('lookingAtDedupeKind', () => {
  it('keys person+listing+session via session and listing (person is the timeline suffix)', () => {
    expect(lookingAtDedupeKind(SESSION_A, '220224201')).toBe(
      `return-visit:${SESSION_A}:220224201`,
    )
  })

  it('is one ping per person+listing per session, not per day', () => {
    const kind = lookingAtDedupeKind(SESSION_A, '220224201')
    expect(kind).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(kind).not.toMatch(/fub/i)
  })

  it('changes when the session changes (same person, same home, new visit)', () => {
    expect(lookingAtDedupeKind(SESSION_A, '220224201')).not.toBe(
      lookingAtDedupeKind(SESSION_B, '220224201'),
    )
  })

  it('changes when the listing changes in the same session', () => {
    expect(lookingAtDedupeKind(SESSION_A, '220224201')).not.toBe(
      lookingAtDedupeKind(SESSION_A, '220199999'),
    )
  })

  it('is stable for the same session and listing', () => {
    expect(lookingAtDedupeKind(SESSION_A, '220224201')).toBe(
      lookingAtDedupeKind(` ${SESSION_A} `, ' 220224201 '),
    )
  })
})

describe('lookingAtCanQueue', () => {
  const ok = {
    crmPersonId: 42,
    sessionId: SESSION_A,
    listingKey: '220224201',
    address: '123 Main St',
  }

  it('queues only identified person + specific home + address', () => {
    expect(lookingAtCanQueue(ok)).toBe(true)
  })

  it('refuses unidentified (no crm_people.id)', () => {
    expect(lookingAtCanQueue({ ...ok, crmPersonId: null })).toBe(false)
    expect(lookingAtCanQueue({ ...ok, crmPersonId: 0 })).toBe(false)
    expect(lookingAtCanQueue({ ...ok, crmPersonId: -1 })).toBe(false)
  })

  it('refuses a missing session, listing, or address', () => {
    expect(lookingAtCanQueue({ ...ok, sessionId: '' })).toBe(false)
    expect(lookingAtCanQueue({ ...ok, listingKey: '  ' })).toBe(false)
    expect(lookingAtCanQueue({ ...ok, address: null })).toBe(false)
  })
})

describe('formatLookingAtAddress', () => {
  it('joins street number and name', () => {
    expect(formatLookingAtAddress({ streetNumber: '123', streetName: 'Main St' })).toBe('123 Main St')
  })

  it('uses a provided street string', () => {
    expect(formatLookingAtAddress({ street: '9 Pine Rd' })).toBe('9 Pine Rd')
  })

  it('returns null when there is no street', () => {
    expect(formatLookingAtAddress({})).toBeNull()
    expect(formatLookingAtAddress({ street: '  ' })).toBeNull()
  })

  it('withholds a placeholder house number 0', () => {
    expect(formatLookingAtAddress({ streetNumber: '0', streetName: 'Moonshadow Court' })).toBe(
      'Moonshadow Court',
    )
    expect(formatLookingAtAddress({ street: '0 Moonshadow Court' })).toBe('Moonshadow Court')
  })
})

describe('listingKeyFromPageUrl / addressFromListingUrl', () => {
  it('reads MLS from the canonical listing path', () => {
    expect(
      listingKeyFromPageUrl('https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220224201'),
    ).toBe('220224201')
  })

  it('turns the address slug into a street', () => {
    expect(
      addressFromListingUrl(
        'https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220224201',
        '220224201',
      ),
    ).toBe('123 Main St')
  })
})

describe('collapseLookingAtByPerson', () => {
  it('keeps the newest home per identified person', () => {
    const out = collapseLookingAtByPerson([
      ev({
        personId: 1,
        listingKey: '111',
        listingStreet: '1 Oak',
        occurredAt: '2026-08-13T10:00:00.000Z',
      }),
      ev({
        personId: 1,
        listingKey: '222',
        listingStreet: '2 Pine',
        occurredAt: '2026-08-13T12:00:00.000Z',
      }),
      ev({
        personId: 2,
        listingKey: '333',
        listingStreet: '3 Elm',
        occurredAt: '2026-08-13T11:00:00.000Z',
      }),
    ])
    expect(out).toEqual([
      { personId: 1, listingKey: '222', address: '2 Pine', occurredAt: '2026-08-13T12:00:00.000Z' },
      { personId: 2, listingKey: '333', address: '3 Elm', occurredAt: '2026-08-13T11:00:00.000Z' },
    ])
  })

  it('drops unidentified rows', () => {
    const out = collapseLookingAtByPerson([
      ev({ personId: 0, listingKey: '111', listingStreet: '1 Oak', occurredAt: '2026-08-13T12:00:00.000Z' }),
      ev({ personId: 9, listingKey: '111', listingStreet: '1 Oak', occurredAt: '2026-08-13T12:00:00.000Z' }),
    ])
    expect(out.map((r) => r.personId)).toEqual([9])
  })

  it('drops a view that cannot name a home, unless the MLS map fills the street', () => {
    const raw = [
      ev({ personId: 1, listingKey: '220224201', occurredAt: '2026-08-13T12:00:00.000Z' }),
    ]
    expect(collapseLookingAtByPerson(raw)).toEqual([])
    expect(collapseLookingAtByPerson(raw, new Map([['220224201', '123 Main St']]))).toEqual([
      {
        personId: 1,
        listingKey: '220224201',
        address: '123 Main St',
        occurredAt: '2026-08-13T12:00:00.000Z',
      },
    ])
  })
})
