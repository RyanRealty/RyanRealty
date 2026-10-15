import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = {
  sendEvent: vi.fn(),
  enrichNativeLead: vi.fn(),
  createCmaRequest: vi.fn(),
  kickCmaBuild: vi.fn(),
  applySarahPersonStage: vi.fn(),
  getSarahDeskBroker: vi.fn(),
  lookupSarahAssignedBroker: vi.fn(),
}

vi.mock('@/lib/crm/send-event', () => ({ sendEvent: (...a: unknown[]) => h.sendEvent(...a) }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  enrichNativeLead: (...a: unknown[]) => h.enrichNativeLead(...a),
}))
vi.mock('@/lib/cma-request', () => ({
  createCmaRequest: (...a: unknown[]) => h.createCmaRequest(...a),
}))
vi.mock('@/lib/cma/kick', () => ({ kickCmaBuild: (...a: unknown[]) => h.kickCmaBuild(...a) }))
vi.mock('@/lib/cma/build', () => ({ buildCma: vi.fn() }))
vi.mock('@/lib/data/crm/sarah-stage', () => ({
  applySarahPersonStage: (...a: unknown[]) => h.applySarahPersonStage(...a),
}))
vi.mock('@/app/actions/sarah-desk', () => ({
  getSarahDeskBroker: (...a: unknown[]) => h.getSarahDeskBroker(...a),
}))
vi.mock('@/lib/data/sarah/desk-broker', () => ({
  lookupSarahAssignedBroker: (...a: unknown[]) => h.lookupSarahAssignedBroker(...a),
}))

import { captureSarahLead } from './sarah-capture'

const SRC = readFileSync(resolve('app/actions/sarah-capture.ts'), 'utf8')

describe('captureSarahLead CRM writes', () => {
  beforeEach(() => {
    for (const fn of Object.values(h)) fn.mockReset()
    h.getSarahDeskBroker.mockResolvedValue({
      data: {
        slug: 'paul',
        firstName: 'Paul',
        fullName: 'Paul Stevenson',
        photoSrc: '/images/brokers/stevenson-paul.png',
        photoAlt: 'Paul Stevenson',
        phoneDisplay: '541.703.3095',
        phoneTel: '+15417033095',
        email: 'paul@ryan-realty.com',
        contactHref: '/contact?agent=paul',
      },
      error: null,
    })
    h.sendEvent.mockResolvedValue({ ok: true, status: 200, personId: 44, suspect: false })
    h.enrichNativeLead.mockResolvedValue(undefined)
    h.applySarahPersonStage.mockResolvedValue('Seller Prospect')
    h.createCmaRequest.mockResolvedValue({ ok: true, cmaId: 'c1', actionId: 'a1', slug: '123-main' })
    h.kickCmaBuild.mockResolvedValue(undefined)
    h.lookupSarahAssignedBroker.mockResolvedValue(null)
  })

  it('writes a buyer through sendEvent with existing stage/tags and by-Sarah audit', async () => {
    const res = await captureSarahLead({
      intent: 'buyer',
      answers: {
        area: 'Bend',
        budget: '700k',
        timeline: 'this year',
        name: 'Alex Rivera',
        email: 'alex@example.com',
      },
    })
    expect(res.error).toBeNull()
    expect(res.data?.personId).toBe(44)
    expect(h.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Property Search',
        source: 'sarah-chat',
        brokerAttribution: { brokerSlug: 'paul', brokerEmail: 'paul@ryan-realty.com' },
        person: expect.objectContaining({
          firstName: 'Alex',
          lastName: 'Rivera',
          emails: [{ value: 'alex@example.com' }],
          tags: expect.arrayContaining(['captured:by-sarah', 'audience:buyer', 'source:sarah-chat']),
        }),
      }),
    )
    expect(h.enrichNativeLead).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 44,
        assignedBroker: 'paul',
        originNote: expect.objectContaining({ title: 'Captured by Sarah' }),
      }),
    )
    expect(h.applySarahPersonStage).toHaveBeenCalledWith(44, 'Lead')
    expect(h.createCmaRequest).not.toHaveBeenCalled()
    expect(res.data?.brokerSlug).toBe('paul')
  })

  it('keeps an existing CRM assignment and does not downgrade the broker', async () => {
    h.lookupSarahAssignedBroker.mockResolvedValue('rebecca')
    const res = await captureSarahLead({
      intent: 'buyer',
      answers: { name: 'Alex', email: 'alex@example.com' },
    })
    expect(res.data?.brokerSlug).toBe('rebecca')
    expect(h.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerAttribution: { brokerSlug: 'rebecca', brokerEmail: 'rebeccapeterson@ryan-realty.com' },
      }),
    )
    expect(h.enrichNativeLead.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ personId: 44 }),
    )
    expect(h.enrichNativeLead.mock.calls[0]?.[0]).not.toHaveProperty('assignedBroker')
  })

  it('starts a draft CMA through createCmaRequest and the build factory, without sending', async () => {
    const res = await captureSarahLead({
      intent: 'home-worth',
      startCma: true,
      answers: {
        address: '8 NW Awbrey Rd',
        name: 'Sam',
        phone: '5415550100',
        cmaWanted: true,
      },
    })
    expect(res.data?.cmaSlug).toBe('123-main')
    expect(h.sendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'Seller Inquiry' }))
    expect(h.createCmaRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        rawAddress: '8 NW Awbrey Rd',
        requestSource: 'sarah-chat',
        notifyLead: false,
        notifyBroker: false,
        crmPersonId: 44,
        brokerSlug: 'paul',
      }),
    )
    expect(h.kickCmaBuild).toHaveBeenCalledWith('123-main')
    expect(SRC).toContain("from '@/lib/cma/build'")
    expect(SRC).toContain('notifyLead: false')
  })

  it('refuses a capture with no name or contact', async () => {
    const res = await captureSarahLead({ intent: 'question', answers: {} })
    expect(res.data).toBeNull()
    expect(h.sendEvent).not.toHaveBeenCalled()
  })
})
