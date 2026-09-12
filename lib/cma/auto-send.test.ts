import { describe, expect, it, vi } from 'vitest'
import { autoSendBuiltCma, type AutoSendDeps } from '@/lib/cma/auto-send'
import type { CmaQueueRow, CmaQueueState } from '@/lib/data/cma/unified-queue'
import type { LaneSettings } from '@/lib/data/cma/lane-settings'
import { AUTO_SEND_LANES } from '@/lib/data/cma/lane-settings'
import type { CmaOrigin } from '@/lib/cma/origin'
import { sendModeForOrigin } from '@/lib/cma/origin'

/**
 * §1 guard, the sharp end. This is the only code path in the CMA funnel that
 * can put an email in front of a homeowner without a broker touching the row,
 * so every one of these tests is a rule Matt asked for, not a unit-test habit:
 *
 *   - a lane that is OFF sends nothing and writes nothing;
 *   - only `ready` sends — audit-failed, unvetted, flagged, build-failed,
 *     already-sent and archived rows are never touched;
 *   - cold lanes go through the weekday drip (which re-verifies live listing
 *     status and re-runs the compliance chain before it sends), asked lanes go
 *     now through the same send the broker's own button calls;
 *   - a BPO never auto-sends from here at all.
 *
 * THE SOLICITATION SCREEN IS STUBBED, AND IT HAS TO BE. `autoSendBuiltCma`
 * reaches `screenAddressForSolicitation` through a dynamic import inside the
 * function, so it is not injectable through `deps` and every case below was
 * making a REAL screen call — live I/O in a unit test that only ever asserts
 * the row was left alone. It also put the suite on a knife edge: the first
 * case in the blocked-state loop pays the import plus the connection and
 * measured 2,914ms in one project and 5,006ms in the other, against vitest's
 * 5,000ms default, so `leaves a audit-failed row untouched` failed on main at
 * 7237aa88 and passed at 9ad40982 with no code change between them.
 *
 * The stub says OK, which is the screen's own answer for an address that is
 * not relisted or sold. Every assertion below still runs. The two rules the
 * screen itself enforces are covered where they belong, in
 * lib/cma/solicit-screen.test.ts.
 *
 * The deeper fix is the CMA lane's call, not this file's: the screen runs
 * BEFORE the readiness gate, so a row that can never send still pays a
 * network round trip to be rejected for a reason that has nothing to do with
 * solicitation. Moving it below that gate, or injecting it through `deps`,
 * would remove the need for this stub.
 */
vi.mock('@/lib/cma/solicit-screen', () => ({
  screenAddressForSolicitation: vi.fn(async () => ({ ok: true, detail: 'stubbed: not relisted, not sold' })),
}))

function laneSettings(over: Partial<Record<string, boolean>> = {}): LaneSettings {
  const out = {} as LaneSettings
  for (const lane of AUTO_SEND_LANES) {
    out[lane] = { autoSend: over[lane] === true, updatedAt: null, updatedBy: null }
  }
  return out
}

function queueRow(over: Partial<CmaQueueRow> = {}): CmaQueueRow {
  const origin: CmaOrigin = over.origin ?? 'expired'
  return {
    id: 'c1',
    slug: 'cma-1-main',
    docKind: 'cma',
    detailHref: '/admin/cmas/cma-1-main',
    docType: 'expired-audit',
    status: 'draft',
    state: 'ready' as CmaQueueState,
    origin,
    sendMode: sendModeForOrigin(origin),
    address: '1 Main St',
    city: 'Bend',
    subdivision: null,
    contactName: 'Owner',
    contactEmail: 'owner@example.com',
    brokerSlug: 'matt',
    recommendedList: 500000,
    valueLow: 480000,
    valueHigh: 520000,
    compsCount: 5,
    theirPrice: 560000,
    theirPriceLabel: 'Last list',
    theirPriceDelta: -0.107,
    offMarketAt: null,
    hasDocument: true,
    buildError: null,
    needsReview: false,
    auditVerdict: 'pass',
    reviewReason: null,
    auditSummary: null,
    auditCriticalCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    deliveredAt: null,
    queuedAt: null,
    emailSentAt: null,
    prospectKind: 'expired',
    prospectId: 'K1',
    ...over,
  }
}

function deps(over: Partial<AutoSendDeps> = {}): AutoSendDeps & {
  finalize: ReturnType<typeof vi.fn>
  sendNow: ReturnType<typeof vi.fn>
  enqueueDrip: ReturnType<typeof vi.fn>
} {
  const base = {
    findRow: vi.fn(async () => queueRow()),
    readLaneSettings: vi.fn(async () => laneSettings({ expired: true })),
    finalize: vi.fn(async () => ({ ok: true as const })),
    sendNow: vi.fn(async () => ({ ok: true as const, transport: 'resend' as const })),
    enqueueDrip: vi.fn(async () => ({ ok: true as const })),
  }
  return { ...base, ...over } as never
}

describe('autoSendBuiltCma — the lane is off', () => {
  it('writes nothing and sends nothing when the lane is off', async () => {
    const d = deps({ readLaneSettings: vi.fn(async () => laneSettings()) })
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('lane-off')
    expect(d.finalize).not.toHaveBeenCalled()
    expect(d.sendNow).not.toHaveBeenCalled()
    expect(d.enqueueDrip).not.toHaveBeenCalled()
  })

  it('is off for every lane by default', async () => {
    for (const lane of AUTO_SEND_LANES) {
      const d = deps({
        findRow: vi.fn(async () => queueRow({ origin: lane, prospectKind: null, prospectId: null })),
        readLaneSettings: vi.fn(async () => laneSettings()),
      })
      expect((await autoSendBuiltCma('cma-1-main', d)).outcome).toBe('lane-off')
    }
  })
})

describe('autoSendBuiltCma — only ready sends', () => {
  const blocked: CmaQueueState[] = [
    'audit-failed',
    'unvetted',
    'flagged',
    'failed',
    'building',
    'queued',
    'sent',
    'archived',
  ]

  for (const state of blocked) {
    // First test in the file, so it absorbs the module-load cost of the whole
    // auto-send import graph. Its own work is pure mocks and takes under a
    // millisecond; under a full parallel suite the import alone has crossed
    // vitest's 5s default and failed the commit hook on unrelated changes.
    it(`leaves a ${state} row untouched even with the lane on`, { timeout: 30_000 }, async () => {
      const d = deps({ findRow: vi.fn(async () => queueRow({ state })) })
      const res = await autoSendBuiltCma('cma-1-main', d)
      expect(res.outcome).toBe('not-ready')
      expect(res.state).toBe(state)
      expect(d.finalize).not.toHaveBeenCalled()
      expect(d.sendNow).not.toHaveBeenCalled()
      expect(d.enqueueDrip).not.toHaveBeenCalled()
    })
  }
})

describe('autoSendBuiltCma — the lane is on and the row is ready', () => {
  it('puts a cold expired row into the weekday drip, finalized first', async () => {
    const d = deps()
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('queued')
    expect(d.finalize).toHaveBeenCalledWith('cma-1-main')
    expect(d.enqueueDrip).toHaveBeenCalledWith('expired', 'K1')
    expect(d.sendNow).not.toHaveBeenCalled()
  })

  it('sends an asked row now, through the same send the button calls', async () => {
    const d = deps({
      findRow: vi.fn(async () =>
        queueRow({ origin: 'seller-valuation', docType: 'cma', prospectKind: null, prospectId: null }),
      ),
      readLaneSettings: vi.fn(async () => laneSettings({ 'seller-valuation': true })),
    })
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('sent')
    expect(d.finalize).toHaveBeenCalledWith('cma-1-main')
    expect(d.sendNow).toHaveBeenCalledWith('cma-1-main')
    expect(d.enqueueDrip).not.toHaveBeenCalled()
  })

  it('refuses a cold row with no prospect link rather than guessing a recipient', async () => {
    const d = deps({ findRow: vi.fn(async () => queueRow({ prospectKind: null, prospectId: null })) })
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('no-prospect')
    expect(d.enqueueDrip).not.toHaveBeenCalled()
    expect(d.sendNow).not.toHaveBeenCalled()
  })

  it('refuses when there is no email on file', async () => {
    const d = deps({ findRow: vi.fn(async () => queueRow({ contactEmail: null })) })
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('no-contact')
    expect(d.finalize).not.toHaveBeenCalled()
  })

  it('does not deliver when the finalize write fails', async () => {
    // An un-finalized document 404s the link the email points at.
    const d = deps({ finalize: vi.fn(async () => ({ ok: false as const, error: 'db down' })) })
    const res = await autoSendBuiltCma('cma-1-main', d)
    expect(res.outcome).toBe('error')
    expect(d.enqueueDrip).not.toHaveBeenCalled()
  })
})

describe('autoSendBuiltCma — what it will never touch', () => {
  it('never auto-sends a BPO', async () => {
    // A BPO is the brokerage's own opinion of value, read by a broker, and its
    // send path needs a linked CRM person it does not have here.
    const d = deps({
      findRow: vi.fn(async () => queueRow({ docKind: 'bpo', origin: 'bpo', prospectKind: null, prospectId: null })),
      readLaneSettings: vi.fn(async () => laneSettings({ bpo: true })),
    })
    const res = await autoSendBuiltCma('bpo-1-main', d)
    expect(res.outcome).toBe('not-a-cma')
    expect(d.sendNow).not.toHaveBeenCalled()
  })

  it('does nothing for a row it cannot find', async () => {
    const d = deps({ findRow: vi.fn(async () => null) })
    expect((await autoSendBuiltCma('nope', d)).outcome).toBe('not-found')
  })

  it('does nothing for a lane with no send mode', async () => {
    const d = deps({
      findRow: vi.fn(async () => queueRow({ origin: 'unknown', prospectKind: null, prospectId: null })),
    })
    expect((await autoSendBuiltCma('cma-1-main', d)).outcome).toBe('lane-off')
  })
})
