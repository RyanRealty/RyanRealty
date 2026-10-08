import { describe, expect, it } from 'vitest'
import {
  BROWSER_VERSION_SESSION_START_LIMIT,
  evaluateInternalTrafficQa,
  flagForeignHostnames,
  flagFormStartWithoutLead,
  flagHotBrowserVersions,
  foldBrowserRows,
  foldFormLeadRows,
  foldHostRows,
  yesterdayInPropertyTz,
} from './ga4-internal-traffic-qa'

describe('ga4 internal-traffic QA flagging', () => {
  it('flags every hostName other than ryan-realty.com', () => {
    const flags = flagForeignHostnames([
      { hostName: 'ryan-realty.com', sessions: 40 },
      { hostName: '127.0.0.1', sessions: 12 },
      { hostName: 'www.ryan-realty.com', sessions: 3 },
    ])
    expect(flags.map((f) => f.detail.hostName)).toEqual(['127.0.0.1', 'www.ryan-realty.com'])
    expect(flagForeignHostnames([{ hostName: 'ryan-realty.com', sessions: 9 }])).toEqual([])
  })

  it('flags a browserVersion with more than 20 session_starts', () => {
    const flags = flagHotBrowserVersions([
      { browserVersion: '124.0.0.0', sessionStarts: 21 },
      { browserVersion: '141.0.0.0', sessionStarts: 20 },
      { browserVersion: '18.5', sessionStarts: 4 },
    ])
    expect(flags).toHaveLength(1)
    expect(flags[0]?.detail).toMatchObject({ browserVersion: '124.0.0.0', sessionStarts: 21, limit: BROWSER_VERSION_SESSION_START_LIMIT })
    expect(flagHotBrowserVersions([{ browserVersion: '124.0.0.0', sessionStarts: 20 }])).toEqual([])
  })

  it('flags form_start with no generate_lead', () => {
    expect(flagFormStartWithoutLead({ formStart: 3, generateLead: 0 })).toHaveLength(1)
    expect(flagFormStartWithoutLead({ formStart: 3, generateLead: 1 })).toEqual([])
    expect(flagFormStartWithoutLead({ formStart: 0, generateLead: 0 })).toEqual([])
  })

  it('evaluateInternalTrafficQa is ok only when nothing flags', () => {
    const clean = evaluateInternalTrafficQa({
      date: '2026-10-07',
      hosts: [{ hostName: 'ryan-realty.com', sessions: 12 }],
      browserVersions: [{ browserVersion: '141.0.0.0', sessionStarts: 8 }],
      formLead: { formStart: 2, generateLead: 1 },
    })
    expect(clean.ok).toBe(true)
    expect(clean.flags).toEqual([])

    const dirty = evaluateInternalTrafficQa({
      date: '2026-10-07',
      hosts: [{ hostName: '127.0.0.1', sessions: 2 }],
      browserVersions: [{ browserVersion: '124.0.0.0', sessionStarts: 30 }],
      formLead: { formStart: 4, generateLead: 0 },
    })
    expect(dirty.ok).toBe(false)
    expect(dirty.flags.map((f) => f.code)).toEqual([
      'foreign-hostname',
      'hot-browser-version',
      'form-start-without-lead',
    ])
  })

  it('folds Data API rows the cron will see', () => {
    expect(
      foldHostRows([
        { dimensionValues: [{ value: 'ryan-realty.com' }], metricValues: [{ value: '11' }] },
        { dimensionValues: [{ value: '127.0.0.1' }], metricValues: [{ value: '4' }] },
      ]),
    ).toEqual([
      { hostName: 'ryan-realty.com', sessions: 11 },
      { hostName: '127.0.0.1', sessions: 4 },
    ])
    expect(
      foldBrowserRows([{ dimensionValues: [{ value: '124.0.0.0' }], metricValues: [{ value: '23' }] }]),
    ).toEqual([{ browserVersion: '124.0.0.0', sessionStarts: 23 }])
    expect(
      foldFormLeadRows([
        { dimensionValues: [{ value: 'form_start' }], metricValues: [{ value: '2' }] },
        { dimensionValues: [{ value: 'generate_lead' }], metricValues: [{ value: '0' }] },
      ]),
    ).toEqual({ formStart: 2, generateLead: 0 })
  })

  it('yesterdayInPropertyTz is the Pacific calendar day before today', () => {
    // 2026-10-08 07:00 UTC is still 2026-10-08 00:00 in America/Los_Angeles.
    expect(yesterdayInPropertyTz(new Date('2026-10-08T07:00:00Z'))).toBe('2026-10-07')
    // 2026-10-08 06:59 UTC is still 2026-10-07 in America/Los_Angeles (PDT, UTC-7).
    expect(yesterdayInPropertyTz(new Date('2026-10-08T06:59:00Z'))).toBe('2026-10-06')
  })
})
