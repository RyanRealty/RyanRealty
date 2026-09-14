/**
 * Admin manual Build CMA must queue the worker — never await the full
 * deterministic build in this Server Action (no maxDuration; a 30–60s
 * build trips app/admin/error.tsx while work continues).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let session: { user: { email: string } } | null = null
vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(session),
}))

let adminRole: { role: string } | null = null
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: (email: string | null | undefined) =>
    Promise.resolve(email && String(email).trim() ? adminRole : null),
}))

const createCmaRequest = vi.fn()
vi.mock('@/lib/cma-request', () => ({
  createCmaRequest: (...args: unknown[]) => createCmaRequest(...args),
}))

const buildCma = vi.fn()
vi.mock('@/lib/cma/build', () => ({
  buildCma: (...args: unknown[]) => buildCma(...args),
}))

const resolveCmaSubject = vi.fn()
vi.mock('@/lib/cma/subject', () => ({
  resolveCmaSubject: (...args: unknown[]) => resolveCmaSubject(...args),
}))

vi.mock('@/lib/cma/send', () => ({
  sendCmaToLead: vi.fn(),
  prepareCmaSendPreview: vi.fn(),
}))
vi.mock('@/lib/cma/first-contact-override', () => ({
  saveCmaFirstContactOverride: vi.fn(),
}))

const attachCmaToPerson = vi.fn()
vi.mock('@/lib/data', () => ({
  attachCmaToPerson: (...args: unknown[]) => attachCmaToPerson(...args),
  getCmaAdminReviewRowBySlug: vi.fn(),
  updateCmaRowFieldsBySlug: vi.fn(),
  deleteCmaRowById: vi.fn(),
}))

const getPersonForCmaKickoff = vi.fn()
vi.mock('@/lib/data/crm/cmaKickoff', () => ({
  getPersonForCmaKickoff: (...args: unknown[]) => getPersonForCmaKickoff(...args),
}))
vi.mock('@/lib/data/crm/searchPeople', () => ({
  searchPeopleByName: vi.fn(),
}))
vi.mock('@/lib/crm/revalidate-person', () => ({
  revalidatePerson: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))

import { buildCmaAdminAction } from '@/app/actions/cma-admin'

beforeEach(() => {
  session = { user: { email: 'matt@ryan-realty.com' } }
  adminRole = { role: 'superuser' }
  createCmaRequest.mockReset().mockResolvedValue({
    ok: true,
    cmaId: 'row-1',
    actionId: 'act-1',
    slug: 'cma-1130-canter-sisters',
  })
  buildCma.mockReset()
  resolveCmaSubject.mockReset()
  attachCmaToPerson.mockReset().mockResolvedValue({
    ok: true,
    personId: 9,
    clientName: null,
    clientEmail: null,
    clientPhone: null,
  })
  getPersonForCmaKickoff.mockReset().mockResolvedValue(null)
})

describe('buildCmaAdminAction source contract', () => {
  it('does not await buildCma; it queues createCmaRequest (intake kick)', () => {
    const src = readFileSync(resolve(__dirname, 'cma-admin.ts'), 'utf8')
    const start = src.indexOf('export async function buildCmaAdminAction')
    const end = src.indexOf('export async function rebrandCmaAction')
    const fn = src.slice(start, end)
    expect(fn).toContain('createCmaRequest')
    expect(fn).toContain("requestSource: 'admin-manual'")
    expect(fn).not.toMatch(/await buildCma\(/)
  })
})

describe('buildCmaAdminAction', () => {
  it('refuses anon and report_viewer before enqueue', async () => {
    session = null
    expect((await buildCmaAdminAction({ address: '1130 Canter Ct, Sisters, OR' })).error).toBe(
      'Unauthorized',
    )
    session = { user: { email: 'viewer@ryan-realty.com' } }
    adminRole = { role: 'report_viewer' }
    expect((await buildCmaAdminAction({ address: '1130 Canter Ct, Sisters, OR' })).error).toBe(
      'Unauthorized',
    )
    expect(createCmaRequest).not.toHaveBeenCalled()
    expect(buildCma).not.toHaveBeenCalled()
  })

  it('requires an address or MLS number', async () => {
    const res = await buildCmaAdminAction({})
    expect(res.error).toBe('Enter a property address or an MLS number.')
    expect(createCmaRequest).not.toHaveBeenCalled()
  })

  it('queues intake (createCmaRequest + kick) and never calls buildCma', async () => {
    const res = await buildCmaAdminAction({
      address: '1130 Canter Ct, Sisters, OR, USA',
      brokerSlug: 'matthew-ryan',
      intent: 'sell',
    })
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ slug: 'cma-1130-canter-sisters', queued: true })
    expect(buildCma).not.toHaveBeenCalled()
    expect(createCmaRequest).toHaveBeenCalledTimes(1)
    const arg = createCmaRequest.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg.requestSource).toBe('admin-manual')
    expect(arg.notifyLead).toBe(false)
    expect(arg.notifyBroker).toBe(false)
    expect(arg.brokerSlug).toBe('matthew-ryan')
    expect(arg.rawAddress).toBe('1130 Canter Ct, Sisters, OR, USA')
  })

  it('resolves MLS to an address then queues, still without buildCma', async () => {
    resolveCmaSubject.mockResolvedValue({
      subject: {
        streetAddress: '1130 Canter Ct',
        city: 'Sisters',
        postalCode: '97759',
      },
      trace: null,
    })
    const res = await buildCmaAdminAction({ mlsNumber: '220213342' })
    expect(res.error).toBeNull()
    expect(res.data?.queued).toBe(true)
    expect(buildCma).not.toHaveBeenCalled()
    const arg = createCmaRequest.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg.mlsNumber).toBe('220213342')
    expect(arg.rawAddress).toBe('1130 Canter Ct, Sisters, OR 97759')
    expect(arg.parsedCity).toBe('Sisters')
  })
})
