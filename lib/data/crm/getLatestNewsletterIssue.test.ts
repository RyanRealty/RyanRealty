import { afterEach, describe, expect, it, vi } from 'vitest'

const getCurrentNewsletterIssueRef = vi.fn()
vi.mock('@/lib/data/newsletter/current-issue', () => ({
  getCurrentNewsletterIssueRef: () => getCurrentNewsletterIssueRef(),
}))

import { getLatestNewsletterIssue } from './getLatestNewsletterIssue'

afterEach(() => getCurrentNewsletterIssueRef.mockReset())

describe('getLatestNewsletterIssue (the send panel names what the one-click send delivers)', () => {
  it('names a sent issue with the time it finished going out', async () => {
    getCurrentNewsletterIssueRef.mockResolvedValue({ id: 's1', subject: 'September', status: 'sent', sendStartedAt: '2026-09-03T16:00:00Z', sendFinishedAt: '2026-09-09T16:10:00Z' })
    expect(await getLatestNewsletterIssue()).toEqual({ id: 's1', subject: 'September', status: 'sent', sentAt: '2026-09-09T16:10:00Z' })
  })

  it('names an issue still going out as sent, from when it started', async () => {
    getCurrentNewsletterIssueRef.mockResolvedValue({ id: 'o1', subject: 'October', status: 'sending', sendStartedAt: '2026-10-08T16:00:00Z', sendFinishedAt: null })
    expect(await getLatestNewsletterIssue()).toEqual({ id: 'o1', subject: 'October', status: 'sent', sentAt: '2026-10-08T16:00:00Z' })
  })

  it('names a scheduled issue as scheduled', async () => {
    getCurrentNewsletterIssueRef.mockResolvedValue({ id: 'o1', subject: 'October', status: 'scheduled', sendStartedAt: null, sendFinishedAt: null })
    expect(await getLatestNewsletterIssue()).toEqual({ id: 'o1', subject: 'October', status: 'scheduled', sentAt: null })
  })

  it('names nothing when there is no current approved issue', async () => {
    getCurrentNewsletterIssueRef.mockResolvedValue(null)
    expect(await getLatestNewsletterIssue()).toBeNull()
  })

  it('names nothing (the send stays disabled) when the read fails, instead of failing the person page', async () => {
    getCurrentNewsletterIssueRef.mockRejectedValue(new Error('timeout'))
    expect(await getLatestNewsletterIssue()).toBeNull()
  })
})
