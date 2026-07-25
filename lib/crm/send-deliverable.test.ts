/**
 * Contract lock for THE unified deliverable-send chokepoint (spec 03 §6.1).
 *
 * What must never regress:
 *   1. Auth runs BEFORE the ledger claim and before any engine — an
 *      unauthorized or out-of-scope caller never reaches a send rail and never
 *      burns an idempotency key.
 *   2. A double-tap (same client key) produces exactly ONE dispatch.
 *   3. A FAILED send releases the claim, so the broker's deliberate retry
 *      actually re-sends (a failed send that stayed claimed would look sent).
 *   4. Two different deliverables sharing one client key are NOT confused for
 *      each other (the key is namespaced by kind + person).
 *   5. Engine prose maps onto the stable errorKind vocabulary — suppression is
 *      never rendered as a retryable "unknown".
 */
import { describe, expect, it } from 'vitest'
import {
  DELIVERABLE_IDEMPOTENCY_SCOPE,
  DELIVERABLE_KINDS,
  classifySendError,
  deliverableIdempotencyKey,
  runSendDeliverable,
  type DeliverableDispatchResult,
  type DeliverableKind,
  type SendDeliverableDeps,
  type SendDeliverableInput,
} from './send-deliverable'

type Access = { email: string; role: string }
const ACCESS: Access = { email: 'matt@ryan-realty.com', role: 'superuser' }

/**
 * An in-memory stand-in for withSendIdempotency that reproduces its REAL
 * semantics (claim → run once → store on success → RELEASE on failure), so the
 * double-tap and retry assertions below test the behaviour that ships.
 */
function makeLedger() {
  const store = new Map<string, unknown>()
  const claims: Array<{ key: string; scope: string }> = []
  const withIdempotency = async <T extends { ok: boolean }>(
    args: { key: string; scope: string; onInFlight: T },
    run: () => Promise<T>,
  ): Promise<T> => {
    claims.push({ key: args.key, scope: args.scope })
    if (store.has(args.key)) return store.get(args.key) as T
    const result = await run()
    if (result.ok) store.set(args.key, result)
    return result
  }
  return { store, claims, withIdempotency }
}

function makeDeps(
  over: Partial<SendDeliverableDeps<Access>> & { onDispatch?: () => Promise<DeliverableDispatchResult> } = {},
) {
  const calls: DeliverableKind[] = []
  const ledger = makeLedger()
  const onDispatch = over.onDispatch ?? (async () => ({ ok: true }))
  const dispatch = {} as SendDeliverableDeps<Access>['dispatch']
  for (const k of DELIVERABLE_KINDS) {
    dispatch[k] = async () => {
      calls.push(k)
      return onDispatch()
    }
  }

  const deps: SendDeliverableDeps<Access> = {
    requireAccess: async () => ({ ok: true, access: ACCESS }),
    requireScope: async () => ({ ok: true }),
    personExists: async () => true,
    withIdempotency: ledger.withIdempotency,
    dispatch,
    ...over,
  }
  return { deps, calls, ledger }
}

const input = (over: Partial<SendDeliverableInput> = {}): SendDeliverableInput => ({
  personId: 42,
  kind: 'cma',
  ref: 'test-slug',
  idempotencyKey: 'client-uuid-1',
  ...over,
})

describe('runSendDeliverable — input validation', () => {
  it('refuses an unknown kind before touching auth', async () => {
    const { deps, calls } = makeDeps({
      requireAccess: async () => {
        throw new Error('auth must not run for a bad kind')
      },
    })
    const r = await runSendDeliverable(input({ kind: 'nope' as DeliverableKind }), deps)
    expect(r.ok).toBe(false)
    expect(r.errorKind).toBe('bad_input')
    expect(calls).toEqual([])
  })

  it('refuses a non-positive person id', async () => {
    const { deps } = makeDeps()
    for (const personId of [0, -1, Number.NaN]) {
      const r = await runSendDeliverable(input({ personId }), deps)
      expect(r.ok).toBe(false)
      expect(r.errorKind).toBe('bad_input')
    }
  })

  it('refuses a send with no idempotency key — at-most-once is not optional', async () => {
    const { deps, calls } = makeDeps()
    for (const key of ['', '   ']) {
      const r = await runSendDeliverable(input({ idempotencyKey: key }), deps)
      expect(r.ok).toBe(false)
      expect(r.errorKind).toBe('bad_input')
    }
    expect(calls).toEqual([])
  })

  it('refuses an unsupported channel', async () => {
    const { deps } = makeDeps()
    const r = await runSendDeliverable(
      input({ channel: 'carrier-pigeon' as 'email' }),
      deps,
    )
    expect(r.ok).toBe(false)
    expect(r.errorKind).toBe('bad_input')
  })
})

describe('runSendDeliverable — auth runs before the rails', () => {
  it('an unauthorized caller never reaches a send engine or the ledger', async () => {
    const { deps, calls, ledger } = makeDeps({
      requireAccess: async () => ({ ok: false, error: 'Unauthorized' }),
    })
    const r = await runSendDeliverable(input(), deps)
    expect(r).toMatchObject({ ok: false, errorKind: 'auth', kind: 'cma', personId: 42 })
    expect(calls).toEqual([])
    expect(ledger.claims).toEqual([])
  })

  it('an out-of-scope contact never reaches a send engine or the ledger', async () => {
    const { deps, calls, ledger } = makeDeps({
      requireScope: async () => ({ ok: false, error: 'Not authorized for this contact' }),
    })
    const r = await runSendDeliverable(input(), deps)
    expect(r).toMatchObject({ ok: false, errorKind: 'auth' })
    expect(calls).toEqual([])
    expect(ledger.claims).toEqual([])
  })

  it('a missing contact is refused as not_found, not as a send attempt', async () => {
    const { deps, calls } = makeDeps({ personExists: async () => false })
    const r = await runSendDeliverable(input(), deps)
    expect(r).toMatchObject({ ok: false, errorKind: 'not_found' })
    expect(calls).toEqual([])
  })
})

describe('runSendDeliverable — at-most-once', () => {
  it('claims the ledger under the deliverable scope with a kind+person key', async () => {
    const { deps, ledger } = makeDeps()
    await runSendDeliverable(input(), deps)
    expect(ledger.claims).toEqual([
      { key: 'deliverable:cma:42:client-uuid-1', scope: DELIVERABLE_IDEMPOTENCY_SCOPE },
    ])
    expect(deliverableIdempotencyKey('cma', 42, ' client-uuid-1 ')).toBe(
      'deliverable:cma:42:client-uuid-1',
    )
  })

  it('a double-tap dispatches exactly once and replays the first result', async () => {
    const { deps, calls } = makeDeps()
    const a = await runSendDeliverable(input(), deps)
    const b = await runSendDeliverable(input(), deps)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(calls).toEqual(['cma'])
  })

  it('a FAILED send releases the claim so a real retry re-sends', async () => {
    let attempt = 0
    const { deps, calls } = makeDeps({
      onDispatch: async () => {
        attempt += 1
        return attempt === 1 ? { ok: false, error: 'Email send failed: provider timeout' } : { ok: true }
      },
    })
    const first = await runSendDeliverable(input(), deps)
    expect(first.ok).toBe(false)
    const retry = await runSendDeliverable(input(), deps)
    expect(retry.ok).toBe(true)
    expect(calls).toEqual(['cma', 'cma'])
  })

  it('two kinds sharing one client key are not confused for each other', async () => {
    const { deps, calls, ledger } = makeDeps()
    await runSendDeliverable(input({ kind: 'cma' }), deps)
    await runSendDeliverable(input({ kind: 'market_report' }), deps)
    expect(calls).toEqual(['cma', 'market_report'])
    expect(ledger.claims.map((c) => c.key)).toEqual([
      'deliverable:cma:42:client-uuid-1',
      'deliverable:market_report:42:client-uuid-1',
    ])
  })

  it('the same key for two different people is two sends', async () => {
    const { deps, calls } = makeDeps()
    await runSendDeliverable(input({ personId: 42 }), deps)
    await runSendDeliverable(input({ personId: 43 }), deps)
    expect(calls).toEqual(['cma', 'cma'])
  })
})

describe('runSendDeliverable — every kind is reachable', () => {
  it('dispatches each DeliverableKind to its own entry', async () => {
    for (const kind of DELIVERABLE_KINDS) {
      const { deps, calls } = makeDeps()
      const r = await runSendDeliverable(input({ kind }), deps)
      expect(r).toMatchObject({ ok: true, kind })
      expect(calls).toEqual([kind])
    }
  })
})

describe('classifySendError — the stable vocabulary', () => {
  const cases: Array<[string, string]> = [
    ['Blocked by suppression (unsubscribed)', 'suppressed'],
    ['This contact has opted out of email and cannot be sent a CMA.', 'suppressed'],
    ['Not authorized for this CMA', 'auth'],
    ['Unauthorized', 'auth'],
    ['No email address on file', 'no_channel'],
    ['No email on file for this contact. Add one before sending.', 'no_channel'],
    ['This CMA is not ready to send (status: draft)', 'not_ready'],
    ['Could not send CMA x. Approve it at /admin/cmas/x first if it is still a draft.', 'not_ready'],
    ['Outside quiet hours policy — quiet hours', 'quiet_hours'],
    ['Number is not registered for texting (A2P)', 'a2p'],
    ['Rate limit exceeded', 'over_limit'],
    ['CMA draft not found', 'not_found'],
    ['Email send failed: provider exploded', 'unknown'],
    ['', 'unknown'],
  ]
  for (const [message, expected] of cases) {
    it(`"${message.slice(0, 48)}" → ${expected}`, () => {
      expect(classifySendError(message)).toBe(expected)
    })
  }

  it('suppression outranks a co-occurring draft word', () => {
    // A message that mentions both must never be read as a retryable state.
    expect(classifySendError('Draft blocked — contact opted out of email')).toBe('suppressed')
  })

  it('null and undefined are unknown, not a crash', () => {
    expect(classifySendError(null)).toBe('unknown')
    expect(classifySendError(undefined)).toBe('unknown')
  })
})
