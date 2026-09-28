import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { signEmailToken } from '@/lib/email-tracking'
import { emailClickTimelineDedupeKey } from '@/lib/crm/email-events'

const upserts: Array<{ table: string; row: Record<string, unknown> }> = []
const mockRecord = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        upserts.push({ table, row })
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

vi.mock('@/lib/crm/email-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/email-events')>()
  return {
    ...actual,
    recordEmailEvent: (...args: unknown[]) => mockRecord(...args),
  }
})

vi.mock('@/lib/newsletter/track-ledger', () => ({
  recordNewsletterEngagement: vi.fn(async () => undefined),
}))

vi.mock('@/lib/identity/outbound-links', () => ({
  channelFromEmailKey: () => 'document',
  decorateOutboundUrl: (url: string) => url,
}))

import { GET } from './route'

const REPORT = 'https://ryan-realty.com/cma/cma-zz-postland-20260928?utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&utm_content=agent-matt&agent=matt'

function clickReq(token: string) {
  return new NextRequest(`https://ryan-realty.com/api/track/e/click?t=${encodeURIComponent(token)}`)
}

describe('track/e/click — link identity', () => {
  beforeEach(() => {
    upserts.length = 0
    mockRecord.mockReset()
    mockRecord.mockResolvedValue({ ok: true, inserted: true })
  })

  it('report_text and report_button produce two timeline keys and two email_events clicks; a repeat collapses; a legacy token keeps today\'s key', async () => {
    const base = { personId: 9, emailKey: 'cma:cma-zz-postland-20260928', label: 'A market analysis', url: REPORT, broker: 'matt' }
    const textTok = signEmailToken({ ...base, linkId: 'report_text', linkText: 'read it online' })
    const buttonTok = signEmailToken({ ...base, linkId: 'report_button', linkText: 'READ THE FULL REPORT' })
    const legacyTok = signEmailToken(base)

    await GET(clickReq(textTok))
    await GET(clickReq(buttonTok))
    await GET(clickReq(textTok))
    await GET(clickReq(legacyTok))

    const timeline = upserts.filter((u) => u.table === 'crm_timeline').map((u) => u.row)
    expect(timeline).toHaveLength(4)
    const keys = timeline.map((r) => r.dedupe_key as string)
    expect(keys[0]).toBe(
      emailClickTimelineDedupeKey({
        personId: 9,
        emailKey: 'cma:cma-zz-postland-20260928',
        loggedUrl: timeline[0]!.body as string,
        linkId: 'report_text',
      }),
    )
    expect(keys[1]).toContain('report_button')
    expect(keys[0]).not.toBe(keys[1])
    expect(keys[2]).toBe(keys[0])
    expect(keys[3]).not.toContain('report_text')
    expect(keys[3]).not.toContain('report_button')
    expect(keys[3]).toBe(
      emailClickTimelineDedupeKey({
        personId: 9,
        emailKey: 'cma:cma-zz-postland-20260928',
        loggedUrl: timeline[3]!.body as string,
      }),
    )

    expect(timeline[0]!.payload).toMatchObject({ linkId: 'report_text', linkText: 'read it online' })
    expect(mockRecord).toHaveBeenCalledTimes(4)
    expect(mockRecord.mock.calls[0][0].meta).toMatchObject({ linkId: 'report_text', linkText: 'read it online' })
    expect(mockRecord.mock.calls[1][0].meta).toMatchObject({ linkId: 'report_button' })
    expect(mockRecord.mock.calls[3][0].meta.linkId).toBeUndefined()
  })

  it('redirects to the original destination URL (identityCarryingTarget is unchanged)', async () => {
    const tok = signEmailToken({
      personId: 9,
      emailKey: 'cma:x',
      url: REPORT,
      linkId: 'report_text',
    })
    const res = await GET(clickReq(tok))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(REPORT)
  })
})
