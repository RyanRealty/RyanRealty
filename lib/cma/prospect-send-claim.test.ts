import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The owner's email slot for a CMA send: acquire, the refusal for every claim
 * answer, and what settling does for a send that never left, one Gmail could not
 * confirm, and one a rail took. The DAL is mocked at its module boundary; the
 * same lease is exercised end to end through sendCmaToLead in
 * lib/cma/send.prospect-claim.test.ts.
 */

const h = vi.hoisted(() => ({
  resolveProspect: vi.fn(),
  claim: vi.fn(),
  stamp: vi.fn(),
  finalize: vi.fn(),
  release: vi.fn(),
}))

vi.mock('@/lib/data/prospecting/cma-send-prospect', () => ({
  resolveProspectForCmaSend: (...a: unknown[]) => h.resolveProspect(...a),
}))
vi.mock('@/lib/data/prospecting/send-claim', () => ({
  claimProspectEmailSend: (...a: unknown[]) => h.claim(...a),
  stampProspectEmailMessageId: (...a: unknown[]) => h.stamp(...a),
  finalizeProspectEmailSend: (...a: unknown[]) => h.finalize(...a),
  releaseProspectEmailSend: (...a: unknown[]) => h.release(...a),
}))

import {
  acquireCmaProspectLease,
  CMA_SEND_FINALIZE_ATTEMPTS,
  cmaSendClaimRefusal,
  cmaSendIdempotencyKey,
} from '@/lib/cma/prospect-send-claim'

const SLUG = 'cma-1109-yapoah-crater-sisters'
const OWNER = 'ashley.kuczek@gmail.com'
const EXPIRED = { kind: 'expired', id: '20250721160438499620000000', via: 'cma_id' } as const

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.resolveProspect.mockReset().mockResolvedValue(EXPIRED)
  h.claim.mockReset().mockResolvedValue('claimed')
  h.stamp.mockReset().mockResolvedValue(undefined)
  h.finalize.mockReset().mockResolvedValue(undefined)
  h.release.mockReset().mockResolvedValue(undefined)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

function acquire(over: Partial<Parameters<typeof acquireCmaProspectLease>[0]> = {}) {
  return acquireCmaProspectLease({ slug: SLUG, recipientEmail: OWNER, personId: 64127, origin: 'expired', ...over })
}

async function held() {
  const res = await acquire()
  if (!res.ok) throw new Error(`expected a lease, got refusal: ${res.error}`)
  return res.lease
}

describe('cmaSendIdempotencyKey', () => {
  it('is cma-send:<slug>', () => {
    expect(cmaSendIdempotencyKey(SLUG)).toBe(`cma-send:${SLUG}`)
  })
})

describe('acquireCmaProspectLease: when there is no slot to take', () => {
  it('takes nothing when the caller already holds the claim, and does not even look the owner up', async () => {
    const res = await acquire({ callerHoldsClaim: true })
    expect(res.ok).toBe(true)
    expect(h.resolveProspect).not.toHaveBeenCalled()
    expect(h.claim).not.toHaveBeenCalled()
    if (res.ok) {
      expect(res.lease.prospect).toBeNull()
      await res.lease.markAccepted({ messageId: 'msg-1' })
      await res.lease.settle()
    }
    expect(h.stamp).not.toHaveBeenCalled()
    expect(h.finalize).not.toHaveBeenCalled()
    expect(h.release).not.toHaveBeenCalled()
  })

  it.each([
    'matt@ryan-realty.com',
    'Matt@Ryan-Realty.com',
    'marketing+dana@ryan-realty.com',
    'anyone@placeholder.ryan-realty.com',
  ])('takes nothing for the internal recipient %s (a test send never marks a real owner)', async (email) => {
    const res = await acquire({ recipientEmail: email })
    expect(res.ok).toBe(true)
    expect(h.resolveProspect).not.toHaveBeenCalled()
    expect(h.claim).not.toHaveBeenCalled()
    if (res.ok) {
      await res.lease.markAccepted({ messageId: 'msg-1' })
      await res.lease.settle()
    }
    expect(h.stamp).not.toHaveBeenCalled()
    expect(h.finalize).not.toHaveBeenCalled()
    expect(h.release).not.toHaveBeenCalled()
  })

  it('takes nothing when no prospect row resolves (an ordinary seller or lead CMA)', async () => {
    h.resolveProspect.mockResolvedValue(null)
    const res = await acquire()
    expect(res.ok).toBe(true)
    expect(h.resolveProspect).toHaveBeenCalledWith(SLUG)
    expect(h.claim).not.toHaveBeenCalled()
    if (res.ok) expect(res.lease.prospect).toBeNull()
  })

  it.each(['seller-valuation', 'place-page', 'lead-form', 'broker', 'bpo'] as const)(
    'takes nothing for an asked origin (%s), even when the house is a cold-emailed prospect',
    async (origin) => {
      // The owner row resolves and is already stamped. An owner who asks for a
      // valuation after our cold email must still get it: no lookup, no claim,
      // no refusal, and the owner's row is left exactly as it was.
      h.claim.mockResolvedValue('already_sent')
      const res = await acquire({ origin })
      expect(res.ok).toBe(true)
      expect(h.resolveProspect).not.toHaveBeenCalled()
      expect(h.claim).not.toHaveBeenCalled()
      if (res.ok) {
        expect(res.lease.prospect).toBeNull()
        await res.lease.markAccepted({ messageId: 'msg-1' })
        await res.lease.settle()
      }
      expect(h.stamp).not.toHaveBeenCalled()
      expect(h.finalize).not.toHaveBeenCalled()
      expect(h.release).not.toHaveBeenCalled()
    },
  )

  it.each(['expired', 'fsbo', 'unknown', 'internal'] as const)(
    'still holds a %s CMA to the one-first-contact rule',
    async (origin) => {
      h.claim.mockResolvedValue('already_sent')
      const res = await acquire({ origin })
      expect(h.resolveProspect).toHaveBeenCalledWith(SLUG)
      expect(h.claim).toHaveBeenCalledTimes(1)
      expect(res.ok).toBe(false)
    },
  )
})

describe('acquireCmaProspectLease: claiming', () => {
  it('claims the resolved expired owner under cma-send:<slug>', async () => {
    const res = await acquire()
    expect(res.ok).toBe(true)
    expect(h.claim).toHaveBeenCalledTimes(1)
    expect(h.claim).toHaveBeenCalledWith('expired', EXPIRED.id, `cma-send:${SLUG}`)
    if (res.ok) expect(res.lease.prospect).toEqual({ kind: 'expired', id: EXPIRED.id })
  })

  it('claims an FSBO owner by its fsbo_url', async () => {
    h.resolveProspect.mockResolvedValue({ kind: 'fsbo', id: 'https://fsbo.example.com/7', via: 'cma_id' })
    await acquire()
    expect(h.claim).toHaveBeenCalledWith('fsbo', 'https://fsbo.example.com/7', `cma-send:${SLUG}`)
  })

  it('claims the owner an orphan CMA resolves to through the MLS key', async () => {
    h.resolveProspect.mockResolvedValue({ kind: 'expired', id: 'LK-ORPHAN', via: 'listing_key' })
    await acquire({ slug: 'cma-1109-yapoah-crater-sisters--v2' })
    expect(h.claim).toHaveBeenCalledWith('expired', 'LK-ORPHAN', 'cma-send:cma-1109-yapoah-crater-sisters--v2')
  })

  it.each([
    ['already_sent', /already emailed for this home[\s\S]*use your own inbox/i],
    ['replay', /already went to the owner[\s\S]*use your own inbox/i],
    ['claimed_elsewhere', /another send to this owner is in progress/i],
    ['not_found', /prospect record could not be found/i],
    ['not_deployed', /not set up.*migration 20260722010100/i],
    ['something_new', /answer this app does not know \(something_new\)/i],
  ])('refuses on %s and names the reason', async (status, message) => {
    h.claim.mockResolvedValue(status)
    const res = await acquire()
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/^Not sent\./)
      expect(res.error).toMatch(message)
    }
    expect(h.release).not.toHaveBeenCalled()
    expect(h.finalize).not.toHaveBeenCalled()
  })

  it('refuses, and says nothing went out, when the owner lookup fails', async () => {
    h.resolveProspect.mockRejectedValue(new Error('expired_listings cma_id read failed: connection reset'))
    const res = await acquire()
    expect(res).toEqual({
      ok: false,
      error: 'Not sent. Could not check whether this owner was already emailed, so nothing went out. Try again in a minute.',
    })
    expect(h.claim).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  it('refuses, and says nothing went out, when the claim call itself fails', async () => {
    h.claim.mockRejectedValue(new Error('prospect_email_send_claim failed: 57014'))
    const res = await acquire()
    expect(res).toEqual({
      ok: false,
      error: "Not sent. Could not reserve this owner's email slot, so nothing went out. Try again in a minute.",
    })
    expect(consoleError).toHaveBeenCalled()
  })

  it('uses no em dash in any refusal a broker can read', () => {
    for (const status of ['already_sent', 'replay', 'claimed_elsewhere', 'not_found', 'not_deployed', 'x']) {
      expect(cmaSendClaimRefusal(status)).not.toMatch(/—|–/)
    }
  })
})

describe('the lease once held', () => {
  it('releases the claim when nothing left (the default state)', async () => {
    const lease = await held()
    await lease.settle()
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release).toHaveBeenCalledWith('expired', EXPIRED.id)
    expect(h.stamp).not.toHaveBeenCalled()
    expect(h.finalize).not.toHaveBeenCalled()
  })

  it('keeps the claim once a rail has been handed the message and has not refused (Gmail never answered, or something threw)', async () => {
    const lease = await held()
    lease.markSending()
    await lease.settle()
    expect(h.release).not.toHaveBeenCalled()
    expect(h.finalize).not.toHaveBeenCalled()
    expect(h.stamp).not.toHaveBeenCalled()
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('the message may be out'))
  })

  it('releases the claim after all: every rail refused for certain', async () => {
    const lease = await held()
    lease.markSending()
    lease.markNotSent()
    await lease.settle()
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release).toHaveBeenCalledWith('expired', EXPIRED.id)
    expect(h.finalize).not.toHaveBeenCalled()
  })

  it('stamps the provider id the instant a rail takes the message, then finalizes with the same key, id and person', async () => {
    const order: string[] = []
    h.stamp.mockImplementation(async () => void order.push('stamp'))
    h.finalize.mockImplementation(async () => void order.push('finalize'))
    const lease = await held()
    await lease.markAccepted({ messageId: '1a0e99ca1a0bab22' })
    expect(order).toEqual(['stamp'])
    await lease.settle()
    expect(order).toEqual(['stamp', 'finalize'])
    expect(h.stamp).toHaveBeenCalledWith('expired', EXPIRED.id, '1a0e99ca1a0bab22')
    expect(h.finalize).toHaveBeenCalledWith('expired', EXPIRED.id, {
      idempotencyKey: `cma-send:${SLUG}`,
      messageId: '1a0e99ca1a0bab22',
      personId: 64127,
    })
    expect(h.release).not.toHaveBeenCalled()
  })

  it('finalizes without a stamp when the rail gave no provider id', async () => {
    const lease = await held()
    await lease.markAccepted({ messageId: null })
    await lease.settle()
    expect(h.stamp).not.toHaveBeenCalled()
    expect(h.finalize).toHaveBeenCalledWith('expired', EXPIRED.id, {
      idempotencyKey: `cma-send:${SLUG}`,
      messageId: null,
      personId: 64127,
    })
  })

  it('a failed stamp is logged and swallowed, and finalize still runs', async () => {
    h.stamp.mockRejectedValue(new Error('rpc down'))
    const lease = await held()
    await expect(lease.markAccepted({ messageId: 'msg-1' })).resolves.toBeUndefined()
    await lease.settle()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('message-id stamp'), 'rpc down')
    expect(h.finalize).toHaveBeenCalledTimes(1)
  })

  it('retries a failed finalize and stops at the first success', async () => {
    h.finalize.mockRejectedValueOnce(new Error('blip')).mockResolvedValueOnce(undefined)
    const lease = await held()
    await lease.markAccepted({ messageId: 'msg-1' })
    await expect(lease.settle()).resolves.toBeUndefined()
    expect(h.finalize).toHaveBeenCalledTimes(2)
  })

  it('never throws when finalize fails every time: it logs the manual-reconcile line and stops', async () => {
    h.finalize.mockRejectedValue(new Error('db down'))
    const lease = await held()
    await lease.markAccepted({ messageId: 'msg-1' })
    await expect(lease.settle()).resolves.toBeUndefined()
    expect(h.finalize).toHaveBeenCalledTimes(CMA_SEND_FINALIZE_ATTEMPTS)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('SENT but finalize FAILED'),
      expect.objectContaining({ kind: 'expired', id: EXPIRED.id, messageId: 'msg-1' }),
    )
    expect(h.release).not.toHaveBeenCalled()
  })

  it('a failed release is logged and swallowed', async () => {
    h.release.mockRejectedValue(new Error('rpc down'))
    const lease = await held()
    await expect(lease.settle()).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()
  })

  it('settles once: a second settle does nothing', async () => {
    const lease = await held()
    await lease.settle()
    await lease.settle()
    expect(h.release).toHaveBeenCalledTimes(1)
  })
})

// ── the callers list ────────────────────────────────────────────────────────

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

describe('who may tell the rail "I already hold the claim"', () => {
  const root = process.cwd()

  it('only sendProspectingEmailIntro sets callerHoldsProspectClaim', () => {
    const users = ['app', 'lib', 'components', 'scripts']
      .flatMap((d) => sourceFiles(join(root, d)))
      .filter((f) => readFileSync(f, 'utf8').includes('callerHoldsProspectClaim'))
      .map((f) => relative(root, f))
      .sort()
    expect(users).toEqual(['app/actions/prospecting.ts', 'lib/cma/send.ts'])

    const action = readFileSync(join(root, 'app/actions/prospecting.ts'), 'utf8')
    const start = action.indexOf('export async function sendProspectingEmailIntro')
    const end = action.indexOf('\nexport async function ', start + 1)
    expect(start).toBeGreaterThan(-1)
    const body = end === -1 ? action.slice(start) : action.slice(start, end)
    expect(body).toMatch(/callerHoldsProspectClaim: true/)
    // ...and only after that action has taken the claim itself.
    expect(body.indexOf('claimProspectEmailSend(')).toBeGreaterThan(-1)
    expect(body.indexOf('callerHoldsProspectClaim: true')).toBeGreaterThan(body.indexOf('claimProspectEmailSend('))
  })

  it('the rail itself claims through the lease and nowhere else', () => {
    const send = readFileSync(join(root, 'lib/cma/send.ts'), 'utf8')
    expect(send).toMatch(/acquireCmaProspectLease\(/)
    expect(send).not.toMatch(/claimProspectEmailSend/)
    expect(send).not.toMatch(/finalizeProspectEmailSend/)
    expect(send).not.toMatch(/releaseProspectEmailSend/)
  })
})
