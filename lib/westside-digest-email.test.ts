import { describe, it, expect } from 'vitest'
import {
  DIGEST_MAX_PEOPLE,
  buildWestsideDigestSubject,
  escapeHtml,
  renderWestsideDigestHtml,
} from './westside-digest-email'
import type { WestsideCohortActivity, RankedCohortPerson } from '@/lib/data/crm/getWestsideCohortActivity'

function person(partial: Partial<RankedCohortPerson>): RankedCohortPerson {
  return {
    personId: 1,
    parcels: [{ apn: '101', siteStreet: '123 NW Test St', siteCity: 'Bend' }],
    visits: 1,
    opens: 0,
    clicks: 0,
    inbound: 0,
    score: 4,
    lastSeenIso: '2026-07-20T10:00:00Z',
    name: 'Test Owner',
    stage: 'Lead',
    assignedBroker: 'matt-ryan',
    ...partial,
  }
}

function activity(partial: Partial<WestsideCohortActivity>): WestsideCohortActivity {
  return {
    sinceDays: 7,
    windowStartIso: '2026-07-14T00:00:00Z',
    fetchedAtIso: '2026-07-21T15:00:00Z',
    rollup: {
      identifiedPeople: 40,
      linkedParcels: 52,
      activePeople: 2,
      siteVisits: 5,
      opens: 3,
      clicks: 1,
      inboundMessages: 0,
    },
    people: [person({ personId: 1 }), person({ personId: 2, name: 'Second Owner' })],
    ...partial,
  }
}

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">O'Brien & Co</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;O&#39;Brien &amp; Co&lt;/a&gt;',
    )
  })
})

describe('buildWestsideDigestSubject', () => {
  it('carries the active/visit/open/click counts with singular/plural forms', () => {
    const s = buildWestsideDigestSubject(activity({}))
    expect(s).toBe('West Side cohort, last 7 days: 2 active, 5 visits, 3 opens, 1 click')
  })

  it('pluralizes correctly when every count is 1', () => {
    const s = buildWestsideDigestSubject(
      activity({
        rollup: {
          identifiedPeople: 40, linkedParcels: 52, activePeople: 1,
          siteVisits: 1, opens: 1, clicks: 1, inboundMessages: 1,
        },
      }),
    )
    expect(s).toBe('West Side cohort, last 7 days: 1 active, 1 visit, 1 open, 1 click')
  })

  it('uses the quiet-week form when nobody was active', () => {
    const s = buildWestsideDigestSubject(
      activity({
        people: [],
        rollup: {
          identifiedPeople: 40, linkedParcels: 52, activePeople: 0,
          siteVisits: 0, opens: 0, clicks: 0, inboundMessages: 0,
        },
      }),
    )
    expect(s).toBe('West Side cohort, last 7 days: quiet week, 40 identified owners')
  })

  it('never contains an em-dash or semicolon', () => {
    for (const d of [activity({}), activity({ people: [] })]) {
      const s = buildWestsideDigestSubject(d)
      expect(s).not.toMatch(/[–—;]/)
    }
  })
})

describe('renderWestsideDigestHtml', () => {
  it('renders KPI values, person links, and the report link', () => {
    const html = renderWestsideDigestHtml(activity({}))
    expect(html).toContain('Identified owners')
    expect(html).toContain('>40<')
    expect(html).toContain('https://ryan-realty.com/admin/people/1')
    expect(html).toContain('https://ryan-realty.com/admin/people/2')
    expect(html).toContain('Test Owner')
    expect(html).toContain('/admin/crm/reporting/westside')
    expect(html).toContain('tabular-nums')
  })

  it('escapes person names and addresses', () => {
    const html = renderWestsideDigestHtml(
      activity({
        people: [
          person({
            name: '<script>alert(1)</script>',
            parcels: [{ apn: 'x', siteStreet: '1 & 2 "Odd" St', siteCity: 'Bend' }],
          }),
        ],
      }),
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('1 &amp; 2 &quot;Odd&quot; St')
  })

  it('renders the quiet empty state when there are no active people', () => {
    const html = renderWestsideDigestHtml(
      activity({
        people: [],
        rollup: {
          identifiedPeople: 40, linkedParcels: 52, activePeople: 0,
          siteVisits: 0, opens: 0, clicks: 0, inboundMessages: 0,
        },
      }),
    )
    expect(html).toContain('No parcel-linked owner visited')
    expect(html).toContain('40 identified owners')
    expect(html).not.toContain('Active people')
  })

  it('caps the listed people at DIGEST_MAX_PEOPLE and notes the overflow', () => {
    const many = Array.from({ length: DIGEST_MAX_PEOPLE + 5 }, (_, i) =>
      person({ personId: i + 1, name: `Owner ${i + 1}` }),
    )
    const html = renderWestsideDigestHtml(activity({ people: many }))
    expect(html).toContain(`Showing ${DIGEST_MAX_PEOPLE} of ${DIGEST_MAX_PEOPLE + 5} active people`)
    expect(html).toContain('/admin/people/15')
    expect(html).not.toContain('/admin/people/16"')
  })

  it('falls back to Person #id when the crm_people name is missing', () => {
    const html = renderWestsideDigestHtml(activity({ people: [person({ name: null })] }))
    expect(html).toContain('Person #1')
  })
})
