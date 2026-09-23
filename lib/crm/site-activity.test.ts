import { describe, expect, it } from 'vitest'
import {
  buildVisits,
  cleanPageTitle,
  formatSecondsOnPage,
  identifiedViaLabel,
  isSuspectContact,
  sourceLabel,
  visitSource,
  type ActivityEventRow,
  type ActivitySessionRow,
} from './site-activity'

const S = 'sess-1'
const t = (min: number, sec = 0) => new Date(Date.UTC(2026, 8, 22, 17, min, sec)).toISOString()
const ev = (at: string, type: string, url: string, title: string | null = null): ActivityEventRow => ({
  sessionId: S,
  at,
  type,
  url,
  title,
  listingMls: null,
})
const SESSION: ActivitySessionRow = {
  sessionId: S,
  firstSeenAt: t(0),
  utmSource: 'google',
  utmMedium: 'organic',
  utmCampaign: null,
  referrer: 'https://www.google.com/',
  identifiedVia: 'tracked_link:email',
}

describe('buildVisits — visits, time on page, source (P7)', () => {
  it('computes time on page as the gap to the next page view, and the exit page from later in-page events', () => {
    const visits = buildVisits(
      [
        ev(t(0), 'page_view', 'https://ryan-realty.com/', 'Ryan Realty | Ryan Realty — Central Oregon'),
        ev(t(1, 30), 'listing_view', 'https://ryan-realty.com/homes-for-sale/bend/828-robin-220199976', 'Listing'),
        ev(t(4), 'scroll_depth', 'https://ryan-realty.com/homes-for-sale/bend/828-robin-220199976'),
        ev(t(5), 'page_view', 'https://ryan-realty.com/contact', 'Contact | Ryan Realty — Central Oregon'),
      ],
      [SESSION],
    )
    expect(visits).toHaveLength(1)
    const [v] = visits
    // Newest first.
    expect(v.pages.map((p) => p.path)).toEqual(['/contact', '/homes-for-sale/bend/828-robin-220199976', '/'])
    expect(v.pages[2].secondsOnPage).toBe(90)
    expect(v.pages[1].secondsOnPage).toBe(210)
    expect(v.pages[1].listingMls).toBe('220199976')
    expect(v.pages[0].secondsOnPage).toBeNull() // exit page, nothing after
    expect(v.source).toBe('Google search')
  })

  it('splits a session into visits on a gap over 30 minutes and labels a return visit', () => {
    const visits = buildVisits(
      [
        ev(t(0), 'page_view', 'https://ryan-realty.com/'),
        ev(t(40), 'page_view', 'https://ryan-realty.com/sell'),
      ],
      [SESSION],
    )
    expect(visits).toHaveLength(2)
    expect(visits[0].pages[0].path).toBe('/sell')
    expect(visits[0].source).toBe('Came back on their own')
    expect(visits[1].source).toBe('Google search')
  })

  it('reads the visit source off the landing URL campaign params (a later email click)', () => {
    const visits = buildVisits(
      [
        ev(t(0), 'page_view', 'https://ryan-realty.com/'),
        ev(t(50), 'page_view', 'https://ryan-realty.com/homes-for-sale?agent=matt&utm_source=crm&utm_medium=sms'),
      ],
      [SESSION],
    )
    expect(visits[0].source).toBe('Text from us')
  })

  it('ignores sessions with no view events and never throws on odd rows', () => {
    expect(buildVisits([ev(t(0), 'scroll_depth', 'https://ryan-realty.com/')], [SESSION])).toEqual([])
    expect(buildVisits([], [])).toEqual([])
  })
})

describe('isSuspectContact — Known people lists people, not form bots (p06 screen reused)', () => {
  const email = (value: string) => [{ value, isPrimary: true }]

  it('a quality:suspect tag is suspect', () => {
    expect(isSuspectContact({ tags: ['quality:suspect', 'quality:signal:random-token-name'], name: 'Pat Doe' })).toBe(true)
  })

  it('a broker who removed the flag (signal tag left behind) wins over the classifier', () => {
    expect(
      isSuspectContact({ tags: ['quality:signal:random-token-name'], name: 'bJSKIwsurKTralgVeDiGblO', emails: [] }),
    ).toBe(false)
  })

  it('an unscreened row (created before the screen) runs the classifier on the stored name and email', () => {
    expect(isSuspectContact({ tags: [], name: 'bJSKIwsurKTralgVeDiGblO', emails: email('x@example.com') })).toBe(true)
    expect(isSuspectContact({ tags: [], name: 'Website Lead', emails: email('k.el.v.f.ee@gmail.com') })).toBe(true)
  })

  it('an ordinary contact is not suspect, and odd rows never throw', () => {
    expect(isSuspectContact({ tags: ['source:contact-form'], first_name: 'Jane', last_name: 'Smith', emails: email('jane.smith@gmail.com') })).toBe(false)
    expect(isSuspectContact({})).toBe(false)
    expect(isSuspectContact({ tags: 'not-an-array' as unknown, emails: 'nope' as unknown })).toBe(false)
  })
})

describe('labels', () => {
  it('source labels', () => {
    expect(sourceLabel('crm', 'email', 'listing-alerts')).toBe('Listing alert email')
    expect(sourceLabel('cma', 'document', 'cma-1-main')).toBe('CMA document')
    expect(sourceLabel('gbp', 'organic', 'profile')).toBe('Google Business Profile')
    expect(sourceLabel('crm', 'personal-link', null)).toBe('Personal link from a broker')
    expect(sourceLabel('direct', 'none', null)).toBe('Direct or bookmark')
    expect(sourceLabel('chatgpt.com', null, null)).toBe('AI assistant (chatgpt.com)')
    expect(visitSource('https://ryan-realty.com/?fbclid=abc', undefined, false)).toBe('Paid ad (Meta)')
  })

  it('identified_via in plain words', () => {
    expect(identifiedViaLabel('tracked_link:sms')).toBe('clicked a text we sent')
    expect(identifiedViaLabel('form_submit')).toBe('filled in a form')
    expect(identifiedViaLabel('rr_vid_carryover')).toBe('came back on a known browser')
    expect(identifiedViaLabel(null)).toBe('identified')
  })

  it('page titles and durations', () => {
    expect(cleanPageTitle('Sell Your Home in Central Oregon | Ryan Realty — Central Oregon', '/sell')).toBe(
      'Sell Your Home in Central Oregon',
    )
    expect(cleanPageTitle(null, '/')).toBe('Home')
    expect(formatSecondsOnPage(45)).toBe('45s')
    expect(formatSecondsOnPage(190)).toBe('3m 10s')
    expect(formatSecondsOnPage(3720)).toBe('1h 2m')
    expect(formatSecondsOnPage(null)).toBe('exit page')
  })
})
