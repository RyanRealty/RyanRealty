import { afterEach, describe, expect, it, vi } from 'vitest'

const getCurrentNewsletterIssue = vi.fn()
vi.mock('@/lib/data/newsletter/current-issue', () => ({
  getCurrentNewsletterIssue: () => getCurrentNewsletterIssue(),
}))

import { getLatestNewsletterIssue } from './getLatestNewsletterIssue'

afterEach(() => getCurrentNewsletterIssue.mockReset())

describe('getLatestNewsletterIssue (the send panel names what the one-click send delivers)', () => {
  it('names a sent issue with the time it finished going out', async () => {
    getCurrentNewsletterIssue.mockResolvedValue({ id: 's1', subject: 'September', status: 'sent', send_finished_at: '2026-09-03T16:10:00Z', sent_at: null })
    expect(await getLatestNewsletterIssue()).toEqual({ id: 's1', subject: 'September', status: 'sent', sentAt: '2026-09-03T16:10:00Z' })
  })

  it('names a scheduled issue as scheduled', async () => {
    getCurrentNewsletterIssue.mockResolvedValue({ id: 'o1', subject: 'October', status: 'scheduled', send_finished_at: null, sent_at: null })
    expect(await getLatestNewsletterIssue()).toEqual({ id: 'o1', subject: 'October', status: 'scheduled', sentAt: null })
  })

  it('names nothing when there is no approved issue', async () => {
    getCurrentNewsletterIssue.mockResolvedValue(null)
    expect(await getLatestNewsletterIssue()).toBeNull()
  })

  it('names nothing (the send stays disabled) when the read fails, instead of failing the person page', async () => {
    getCurrentNewsletterIssue.mockRejectedValue(new Error('timeout'))
    expect(await getLatestNewsletterIssue()).toBeNull()
  })
})
