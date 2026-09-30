import { describe, expect, it, vi } from 'vitest'

/** The CRM composer never attaches a held expired CMA (Matt 2026-09-30). */

const h = vi.hoisted(() => ({
  renderCmaPdfBuffer: vi.fn(async () => ({ buffer: Buffer.from('pdf') })),
  uploadAttachmentBytes: vi.fn(),
  floor: vi.fn(async (_slug: string, _ctx?: unknown) => ({
    held: true as boolean,
    ratio: 0.727 as number | null,
    reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000.' as string | null,
    unreadable: undefined as true | undefined,
  })),
}))

vi.mock('@/app/actions/crm', () => ({
  requireCrmAccess: vi.fn(async () => ({ ok: true, access: { email: 'matt@ryan-realty.com' } })),
  requirePersonInScope: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/data/cma/compose-target', () => ({
  getCmaComposeTarget: vi.fn(async () => ({ status: 'finalized', subjectAddress: '3759 SW 45th St' })),
}))
vi.mock('@/lib/data/cma/send-floor', () => ({ getCmaSendFloorBySlug: h.floor }))
vi.mock('@/lib/cma-pdf', () => ({ renderCmaPdfBuffer: h.renderCmaPdfBuffer }))
vi.mock('@/lib/crm/attachments', () => ({ uploadAttachmentBytes: h.uploadAttachmentBytes }))
vi.mock('@/lib/data/crm/getRecipientOptionsForContact', () => ({ getRecipientOptionsForContact: vi.fn(async () => []) }))
vi.mock('@/lib/data/brokers/getBrokers', () => ({ getBrokerSelfRecordByEmail: vi.fn(async () => null) }))

import { stageCmaPdfForComposeAction } from './cma-compose'

describe('stageCmaPdfForComposeAction and the 80% line', () => {
  it('refuses a held CMA before the PDF renders or uploads', async () => {
    const res = await stageCmaPdfForComposeAction({ personId: 63800, slug: 'cma-3759-45th-redmond-97756', channel: 'email' })
    expect(res.ok).toBe(false)
    expect(res.ok ? '' : res.error).toContain('Held for Matt')
    expect(h.renderCmaPdfBuffer).not.toHaveBeenCalled()
    expect(h.uploadAttachmentBytes).not.toHaveBeenCalled()
  })
})
