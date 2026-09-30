import { describe, it, expect } from 'vitest'
import {
  REPORT_ONE_CLICK_PATH,
  REPORT_PREFERENCES_PATH,
  REPORT_VIEW_PATH,
  reportEmailLinks,
  signReportLinkToken,
  verifyReportLinkToken,
} from './report-link-token'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token'
import { isPrivateLink, isPrivatePath } from '@/lib/analytics/private-paths'

function tokenOf(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('t') ?? '')
}

describe('report link tokens (the no-login preferences page)', () => {
  it('round-trips person, subscription, purpose, report and preview', () => {
    const t = signReportLinkToken({ personId: 64138, subscriptionId: 9016, purpose: 'manage', emailKey: 'market-report:r:64138' })
    expect(verifyReportLinkToken(t)).toEqual({
      personId: 64138,
      subscriptionId: 9016,
      purpose: 'manage',
      emailKey: 'market-report:r:64138',
      preview: false,
    })
    const p = signReportLinkToken({ personId: 5, purpose: 'stop', preview: true })
    expect(verifyReportLinkToken(p)).toEqual({ personId: 5, subscriptionId: 0, purpose: 'stop', emailKey: null, preview: true })
  })

  it('a web-view link must name the report', () => {
    expect(() => signReportLinkToken({ personId: 5, purpose: 'view' })).toThrow()
    const v = signReportLinkToken({ personId: 5, purpose: 'view', emailKey: 'k1' })
    expect(verifyReportLinkToken(v)).toMatchObject({ purpose: 'view', emailKey: 'k1' })
  })

  it('refuses a person id that is not a positive integer', () => {
    expect(() => signReportLinkToken({ personId: 0, purpose: 'manage' })).toThrow()
    expect(() => signReportLinkToken({ personId: -3, purpose: 'manage' })).toThrow()
  })

  it('rejects a tampered signature or payload, and malformed input', () => {
    const t = signReportLinkToken({ personId: 7, purpose: 'manage' })
    const [payload, sig] = t.split('.')
    expect(verifyReportLinkToken(`${payload}.AAAA${sig.slice(4)}`)).toBeNull()
    const forged = Buffer.from(JSON.stringify({ v: 1, p: 8, s: 0, u: 'manage' })).toString('base64url')
    expect(verifyReportLinkToken(`${forged}.${sig}`)).toBeNull()
    expect(verifyReportLinkToken('')).toBeNull()
    expect(verifyReportLinkToken(null)).toBeNull()
    expect(verifyReportLinkToken('a.b.c')).toBeNull()
  })

  it('is domain-separated from the global unsubscribe token', () => {
    // Both are HMAC over a base64url payload with the same secret chain; the
    // report token MACs a prefixed string, so neither verifies as the other.
    const unsub = signUnsubscribeToken(7)
    expect(verifyReportLinkToken(unsub)).toBeNull()
    const report = signReportLinkToken({ personId: 7, purpose: 'stop' })
    expect(verifyUnsubscribeToken(report)).toBeNull()
  })

  it('builds the four links a report carries, each signed for its one job', () => {
    const links = reportEmailLinks({ personId: 64138, subscriptionId: 9016, emailKey: 'k1' })
    expect(new URL(links.manageUrl).pathname).toBe(REPORT_PREFERENCES_PATH)
    expect(new URL(links.unsubscribeUrl).pathname).toBe(REPORT_PREFERENCES_PATH)
    expect(new URL(links.unsubscribeUrl).searchParams.get('stop')).toBe('1')
    expect(new URL(links.viewUrl).pathname).toBe(REPORT_VIEW_PATH)
    expect(new URL(links.oneClickUrl).pathname).toBe(REPORT_ONE_CLICK_PATH)
    expect(verifyReportLinkToken(tokenOf(links.manageUrl))?.purpose).toBe('manage')
    // The footer Unsubscribe opens the page on the stop question; a GET never stops.
    expect(verifyReportLinkToken(tokenOf(links.unsubscribeUrl))?.purpose).toBe('manage')
    expect(verifyReportLinkToken(tokenOf(links.viewUrl))?.purpose).toBe('view')
    expect(verifyReportLinkToken(tokenOf(links.oneClickUrl))?.purpose).toBe('stop')
  })

  it('the preferences page and its web view are private addresses (no tag ever sees the token)', () => {
    const links = reportEmailLinks({ personId: 1, subscriptionId: 2, emailKey: 'k' })
    expect(isPrivatePath(new URL(links.manageUrl).pathname)).toBe(true)
    expect(isPrivatePath(new URL(links.viewUrl).pathname)).toBe(true)
    expect(isPrivateLink(links.manageUrl)).toBe(true)
    expect(isPrivateLink(links.viewUrl)).toBe(true)
  })
})
