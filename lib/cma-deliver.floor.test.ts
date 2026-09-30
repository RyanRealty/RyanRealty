import { beforeEach, describe, expect, it, vi } from 'vitest'

/** finalizeAndDeliverCma (legacy path) holds Matt's 80% line before any mail (2026-09-30). */

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ id: 'resend-1' })),
  createGmailDraft: vi.fn(),
  getCmaBySlug: vi.fn(async () => ({
    slug: 'cma-3759-45th-redmond-97756',
    subject_address: '3759 SW 45th St, Redmond, OR 97756',
    client_email: 'owner@example.com',
    client_name: 'Owner',
    broker_slug: 'matthew-ryan',
  })),
  floor: vi.fn(async (_slug: string, _ctx?: unknown) => ({
    held: true as boolean,
    ratio: 0.727 as number | null,
    reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000.' as string | null,
    unreadable: undefined as true | undefined,
  })),
}))

vi.mock('@/lib/resend', () => ({ sendEmail: h.sendEmail }))
vi.mock('@/lib/gmail-draft', () => ({ createGmailDraft: h.createGmailDraft }))
vi.mock('@/lib/data', () => ({ getCmaBySlug: h.getCmaBySlug }))
vi.mock('@/lib/data/cma/send-floor', () => ({ getCmaSendFloorBySlug: h.floor }))
vi.mock('@/lib/crm/attributed-links', () => ({ attributeOutbound: vi.fn() }))
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })),
  isSuppressedByEmail: vi.fn(async () => ({ suppressed: false, reasons: [] })),
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({ personIdsByEmailCi: vi.fn(async () => []) }))

import { finalizeAndDeliverCma } from '@/lib/cma-deliver'

beforeEach(() => {
  h.sendEmail.mockClear()
  h.createGmailDraft.mockClear()
})

describe('finalizeAndDeliverCma and the 80% line', () => {
  it('refuses a held expired CMA before any draft or email', async () => {
    const res = await finalizeAndDeliverCma({ slug: 'cma-3759-45th-redmond-97756' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Held for Matt')
    expect(h.floor).toHaveBeenCalledWith('cma-3759-45th-redmond-97756')
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.createGmailDraft).not.toHaveBeenCalled()
  })
})
