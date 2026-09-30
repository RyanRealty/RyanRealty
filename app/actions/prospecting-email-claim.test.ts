/**
 * sendProspectingEmailIntro at the claim and at the rail (2026-09-29 drip fix).
 *
 *   - A claim another run holds is 'in-progress', never 'already-sent': the
 *     drip dequeued on 'already-sent' while the first run was still sending.
 *   - A send Gmail took and never confirmed keeps its claim. Releasing it would
 *     put a drip member back in the queue for the next tick to send again; the
 *     drip's stuck-send recovery settles it from Gmail Sent instead.
 *   - Any other rail refusal still releases (nothing left the building).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getProspect: vi.fn(),
  updateCmaRowFieldsBySlug: vi.fn(),
  getLatestClientReadyCmaRowForBaseSlug: vi.fn(),
  verifyNotRelisted: vi.fn(),
  verifyFsboStillActive: vi.fn(),
  ensureNativeLead: vi.fn(),
  enrichNativeLead: vi.fn(),
  isSuppressed: vi.fn(),
  isSuppressedByEmail: vi.fn(),
  claimProspectEmailSend: vi.fn(),
  releaseProspectEmailSend: vi.fn(),
  stampProspectEmailMessageId: vi.fn(),
  finalizeProspectEmailSend: vi.fn(),
  sendCmaToLead: vi.fn(),
}))

// Matt's 80% line (lib/cma/send-floor.ts) reads the CMA row; not held unless a test says so.
const floorMock = vi.hoisted(() => ({
  getCmaSendFloorBySlug: vi.fn(async (_slug: string) => ({ held: false as boolean, ratio: null as number | null, reason: null as string | null })),
}))
vi.mock('@/lib/data/cma/send-floor', () => floorMock)

vi.mock('next/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/cache')>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/crm/revalidate-person', () => ({ revalidatePerson: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({ getSession: vi.fn() }))
vi.mock('@/app/actions/admin-roles', () => ({ getAdminRoleForEmail: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    throw new Error('no database in this unit test')
  },
}))
vi.mock('@/lib/data', () => ({
  getProspect: h.getProspect,
  getProspectDetail: vi.fn(),
  updateCmaRowFieldsBySlug: h.updateCmaRowFieldsBySlug,
}))
vi.mock('@/lib/data/prospecting/batch', () => ({
  verifyNotRelisted: h.verifyNotRelisted,
  verifyFsboStillActive: h.verifyFsboStillActive,
}))
vi.mock('@/lib/data/prospecting/drip', () => ({ resolveDripSequenceForKind: vi.fn() }))
vi.mock('@/lib/data/prospecting/send-claim', () => ({
  claimProspectSend: vi.fn(),
  finalizeProspectSend: vi.fn(),
  releaseProspectSend: vi.fn(),
  stampProspectSid: vi.fn(),
  linkProspectCma: vi.fn(),
  claimProspectEmailSend: h.claimProspectEmailSend,
  finalizeProspectEmailSend: h.finalizeProspectEmailSend,
  releaseProspectEmailSend: h.releaseProspectEmailSend,
  stampProspectEmailMessageId: h.stampProspectEmailMessageId,
}))
vi.mock('@/lib/cma/versions', () => ({
  getLatestClientReadyCmaRowForBaseSlug: h.getLatestClientReadyCmaRowForBaseSlug,
  resolveWritableCmaSlot: vi.fn(),
}))
vi.mock('@/lib/cma/build', () => ({ buildCma: vi.fn() }))
vi.mock('@/lib/cma/send', () => ({ sendCmaToLead: h.sendCmaToLead, prepareCmaSendPreview: vi.fn() }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: h.ensureNativeLead,
  enrichNativeLead: h.enrichNativeLead,
}))
vi.mock('@/lib/data/crm/searchPeople', () => ({ searchPeopleByName: vi.fn() }))
vi.mock('@/lib/data/cma/crm', () => ({ attachCmaToPerson: vi.fn() }))
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: h.isSuppressed,
  isSuppressedByPhone: vi.fn(),
  isSuppressedByEmail: h.isSuppressedByEmail,
}))
vi.mock('@/lib/crm/twilio', () => ({ sendSmsViaMessagingService: vi.fn(), toE164: vi.fn() }))
vi.mock('@/app/actions/crm-template-test', () => ({ sendTemplateSelfTestAction: vi.fn() }))

import { sendProspectingEmailIntro } from './prospecting'

const OWNER = 'owner@example.com'
const ID = '20260819192123649950000000'
const ARGS = { idempotencyKey: `drip:expired:${ID}:2026-09-29T22:53:48.909Z`, actor: 'drip-cron' as const }
const UNCONFIRMED =
  'Gmail did not confirm the send from matt@ryan-realty.com (The operation was aborted). It may have gone out, so check Sent in that mailbox before sending again.'

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.getProspect.mockResolvedValue({
    kind: 'expired',
    id: ID,
    ownerName: 'Owner',
    streetAddress: '3153 Cromwell',
    city: 'Bend',
    contactEmail: OWNER,
    contactPhone: null,
    expiredAt: '2026-08-19T19:21:23.000Z',
    detectedAt: '2026-08-19T19:21:23.000Z',
    doc: { state: 'ready', slug: 'cma-3153-cromwell', docType: 'cma', status: 'finalized', recommendedList: null },
    compliance: { offMarket: false, relisted: false, channels: { email: { blocked: false, reason: null } } },
  })
  h.getLatestClientReadyCmaRowForBaseSlug.mockResolvedValue({
    slug: 'cma-3153-cromwell',
    row: { client_email: OWNER },
  })
  h.verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
  h.ensureNativeLead.mockResolvedValue({ personId: 5, created: false })
  h.enrichNativeLead.mockResolvedValue(undefined)
  h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
  h.isSuppressedByEmail.mockResolvedValue({ suppressed: false, reasons: [] })
  h.claimProspectEmailSend.mockResolvedValue('claimed')
  h.releaseProspectEmailSend.mockResolvedValue(undefined)
  h.stampProspectEmailMessageId.mockResolvedValue(undefined)
  h.finalizeProspectEmailSend.mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendProspectingEmailIntro — claim held elsewhere', () => {
  it("returns 'in-progress', not 'already-sent', and sends nothing", async () => {
    h.claimProspectEmailSend.mockResolvedValue('claimed_elsewhere')
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toEqual({
      ok: false,
      error: 'Another send to this owner is in progress. Check back in a few minutes before sending again.',
      code: 'in-progress',
    })
    expect(h.sendCmaToLead).not.toHaveBeenCalled()
    expect(h.releaseProspectEmailSend).not.toHaveBeenCalled()
  })

  it("still returns 'already-sent' when a different send finished", async () => {
    h.claimProspectEmailSend.mockResolvedValue('already_sent')
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toMatchObject({ ok: false, code: 'already-sent' })
  })

  it('claims with the base slug rule shared with the recovery', async () => {
    h.claimProspectEmailSend.mockResolvedValue('claimed_elsewhere')
    await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(h.getLatestClientReadyCmaRowForBaseSlug).toHaveBeenCalledWith('cma-3153-cromwell')
    expect(h.claimProspectEmailSend).toHaveBeenCalledWith('expired', ID, ARGS.idempotencyKey)
  })
})

describe('sendProspectingEmailIntro — rail failure', () => {
  it('keeps the claim when Gmail took the message and never confirmed it', async () => {
    h.sendCmaToLead.mockResolvedValue({ ok: false, error: UNCONFIRMED })
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toEqual({ ok: false, error: UNCONFIRMED, code: 'send-failed' })
    expect(h.releaseProspectEmailSend).not.toHaveBeenCalled()
    expect(h.finalizeProspectEmailSend).not.toHaveBeenCalled()
  })

  it('releases the claim when the rail refused before anything left', async () => {
    h.sendCmaToLead.mockResolvedValue({ ok: false, error: 'PDF render failed: Chromium exited' })
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toEqual({ ok: false, error: 'PDF render failed: Chromium exited', code: 'send-failed' })
    expect(h.releaseProspectEmailSend).toHaveBeenCalledWith('expired', ID)
  })

  it('stamps and finalizes a send that went out', async () => {
    h.sendCmaToLead.mockResolvedValue({ ok: true, transport: 'gmail', gmailMessageId: 'g-1' })
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toMatchObject({ ok: true, messageId: 'g-1', personId: 5, transport: 'gmail' })
    expect(h.stampProspectEmailMessageId).toHaveBeenCalledWith('expired', ID, 'g-1')
    expect(h.finalizeProspectEmailSend).toHaveBeenCalledTimes(1)
    expect(h.releaseProspectEmailSend).not.toHaveBeenCalled()
  })
})

describe("sendProspectingEmailIntro — Matt's 80% line (2026-09-30)", () => {
  it("refuses a held CMA with code 'price-floor' before the owner's claim is taken, so the drip dequeues it", async () => {
    floorMock.getCmaSendFloorBySlug.mockResolvedValueOnce({
      held: true,
      ratio: 0.727,
      reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000. Expired CMAs under 80% of the last list never send (Matt 2026-09-30).',
    })
    const out = await sendProspectingEmailIntro('expired', ID, ARGS)
    expect(out).toMatchObject({ ok: false, code: 'price-floor' })
    expect(floorMock.getCmaSendFloorBySlug).toHaveBeenCalledWith('cma-3153-cromwell')
    expect(h.claimProspectEmailSend).not.toHaveBeenCalled()
    expect(h.sendCmaToLead).not.toHaveBeenCalled()
  })
})
