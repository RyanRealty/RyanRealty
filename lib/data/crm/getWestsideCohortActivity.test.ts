import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_WEIGHTS,
  clampSinceDays,
  rankCohortActivity,
  type CohortEmailEventRow,
  type CohortInboundRow,
  type CohortSessionRow,
  type WestsideParcelRow,
} from './getWestsideCohortActivity'

const parcel = (apn: string, personId: number, street = '123 NW Test St'): WestsideParcelRow => ({
  apn,
  site_street: street,
  site_city: 'Bend',
  person_id: personId,
})

const session = (personId: number, sessionId: string, lastSeen: string): CohortSessionRow => ({
  crm_person_id: personId,
  session_id: sessionId,
  last_seen_at: lastSeen,
  engagement_score: 10,
})

const email = (personId: number, event: string, at: string): CohortEmailEventRow => ({
  person_id: personId,
  event,
  occurred_at: at,
})

const inbound = (personId: number, kind: string, ts: string): CohortInboundRow => ({
  person_id: personId,
  kind,
  ts,
})

describe('clampSinceDays', () => {
  it('defaults to 7 and clamps to [1, 90]', () => {
    expect(clampSinceDays(undefined)).toBe(7)
    expect(clampSinceDays(0)).toBe(7)
    expect(clampSinceDays(NaN)).toBe(7)
    expect(clampSinceDays(-3)).toBe(1)
    expect(clampSinceDays(365)).toBe(90)
    expect(clampSinceDays(14.9)).toBe(14)
  })
})

describe('rankCohortActivity', () => {
  it('returns empty people and zeroed rollup for an empty cohort', () => {
    const out = rankCohortActivity({ parcels: [], sessions: [], emailEvents: [], inbound: [] })
    expect(out.people).toEqual([])
    expect(out.rollup).toEqual({
      identifiedPeople: 0,
      linkedParcels: 0,
      activePeople: 0,
      siteVisits: 0,
      opens: 0,
      clicks: 0,
      inboundMessages: 0,
    })
  })

  it('drops activity from people who are not parcel-linked', () => {
    const out = rankCohortActivity({
      parcels: [parcel('101', 1)],
      sessions: [session(999, 's-x', '2026-07-20T10:00:00Z')],
      emailEvents: [email(999, 'open', '2026-07-20T10:00:00Z')],
      inbound: [inbound(999, 'sms_in', '2026-07-20T10:00:00Z')],
    })
    expect(out.people).toEqual([])
    expect(out.rollup.identifiedPeople).toBe(1)
    expect(out.rollup.activePeople).toBe(0)
    expect(out.rollup.siteVisits).toBe(0)
    expect(out.rollup.opens).toBe(0)
    expect(out.rollup.inboundMessages).toBe(0)
  })

  it('counts signals, dedupes sessions, and computes the weighted score', () => {
    const out = rankCohortActivity({
      parcels: [parcel('101', 1), parcel('102', 1)], // multi-property owner
      sessions: [
        session(1, 's-1', '2026-07-19T10:00:00Z'),
        session(1, 's-1', '2026-07-19T11:00:00Z'), // duplicate session_id — ignored
        session(1, 's-2', '2026-07-20T09:00:00Z'),
      ],
      emailEvents: [
        email(1, 'open', '2026-07-18T08:00:00Z'),
        email(1, 'click', '2026-07-18T08:05:00Z'),
        email(1, 'sent', '2026-07-18T08:00:00Z'), // not open/click — ignored
      ],
      inbound: [inbound(1, 'sms_in', '2026-07-21T07:00:00Z')],
    })
    expect(out.people).toHaveLength(1)
    const p = out.people[0]
    expect(p.personId).toBe(1)
    expect(p.parcels).toHaveLength(2)
    expect(p.visits).toBe(2)
    expect(p.opens).toBe(1)
    expect(p.clicks).toBe(1)
    expect(p.inbound).toBe(1)
    expect(p.score).toBe(
      2 * ACTIVITY_WEIGHTS.visit +
        1 * ACTIVITY_WEIGHTS.click +
        1 * ACTIVITY_WEIGHTS.open +
        1 * ACTIVITY_WEIGHTS.inbound,
    )
    // Last seen is the max timestamp across every signal source.
    expect(p.lastSeenIso).toBe('2026-07-21T07:00:00Z')
    expect(out.rollup).toEqual({
      identifiedPeople: 1,
      linkedParcels: 2,
      activePeople: 1,
      siteVisits: 2,
      opens: 1,
      clicks: 1,
      inboundMessages: 1,
    })
  })

  it('ranks by score desc with lastSeen desc then personId asc tiebreaks', () => {
    const out = rankCohortActivity({
      parcels: [parcel('101', 1), parcel('102', 2), parcel('103', 3), parcel('104', 4)],
      sessions: [
        session(2, 's-a', '2026-07-20T10:00:00Z'), // 4 pts, newer
        session(3, 's-b', '2026-07-19T10:00:00Z'), // 4 pts, older
        session(4, 's-c', '2026-07-19T10:00:00Z'), // 4 pts, same ts as 3
      ],
      emailEvents: [],
      inbound: [inbound(1, 'email_in', '2026-07-18T10:00:00Z')], // 6 pts
    })
    expect(out.people.map((p) => p.personId)).toEqual([1, 2, 3, 4])
  })

  it('excludes cohort members with zero window activity from people but keeps them in identifiedPeople', () => {
    const out = rankCohortActivity({
      parcels: [parcel('101', 1), parcel('102', 2)],
      sessions: [session(2, 's-1', '2026-07-20T10:00:00Z')],
      emailEvents: [],
      inbound: [],
    })
    expect(out.rollup.identifiedPeople).toBe(2)
    expect(out.rollup.activePeople).toBe(1)
    expect(out.people.map((p) => p.personId)).toEqual([2])
  })
})
